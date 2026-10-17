-- Additive private transcription lifecycle. Requires the existing 3.2 global
-- budget tables. No raw audio is stored and no wallet/entitlement is changed.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create table if not exists public.luna42_voice_requests(
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 request_id uuid not null, audio_hash text not null check(audio_hash~'^[0-9a-f]{64}$'),
 language text not null check(language in ('ru','en')),
 duration_ms integer not null check(duration_ms between 250 and 45000),
 state text not null check(state in ('reserved','ready','unknown','failed')),
 reserved_cost_microusd bigint not null default 20000 check(reserved_cost_microusd=20000),
 actual_cost_microusd bigint check(actual_cost_microusd>=0),
 input_tokens integer,output_tokens integer,latency_ms integer,
 transcript text check(char_length(transcript)<=2000),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '24 hours',
 primary key(telegram_id,request_id)
);
create index if not exists luna42_voice_owner_day on public.luna42_voice_requests(telegram_id,created_at desc);
alter table public.luna42_voice_requests enable row level security;
alter table public.luna42_voice_requests force row level security;
revoke all on public.luna42_voice_requests from public,anon,authenticated;
grant select,insert,update,delete on public.luna42_voice_requests to service_role;
create or replace function public.luna42_reserve_voice(p_owner bigint,p_request uuid,p_hash text,p_language text,p_duration integer)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare prior public.luna42_voice_requests;cfg public.luna32_runtime_settings;v_month date=(date_trunc('month',now() at time zone 'UTC'))::date;v_spent bigint;
begin
 if p_owner is null or p_owner<=0 or p_request is null or p_hash is null or p_hash!~'^[0-9a-f]{64}$' or p_language is null or p_language not in ('ru','en') or p_duration is null or p_duration not between 250 and 45000 then raise exception 'invalid_voice_request' using errcode='22023';end if;
 perform pg_advisory_xact_lock(3272001);
 update public.luna42_voice_requests set transcript=null where telegram_id=p_owner and expires_at<now() and transcript is not null;
 select * into prior from public.luna42_voice_requests where telegram_id=p_owner and request_id=p_request;
 if found then
  if prior.audio_hash<>p_hash or prior.language<>p_language or prior.duration_ms<>p_duration then return jsonb_build_object('status','conflict');end if;
  if prior.state='ready' and prior.expires_at>now() then return jsonb_build_object('status','cached','text',prior.transcript,'costMicrousd',prior.actual_cost_microusd);end if;
  return jsonb_build_object('status',case when prior.state='reserved' then 'in_progress' else 'review_required' end);
 end if;
 select * into strict cfg from public.luna32_runtime_settings where id=true;
 if not cfg.generation_enabled or not cfg.cost_baseline_verified or cfg.baseline_month is null or cfg.baseline_month>v_month or cfg.monthly_cap_microusd<=0 then return jsonb_build_object('status','budget_unconfigured');end if;
 if (select count(*) from public.luna42_voice_requests where telegram_id=p_owner and created_at>=((now() at time zone 'UTC')::date at time zone 'UTC'))>=5 then return jsonb_build_object('status','daily_limit');end if;
 insert into public.luna32_ai_month_totals(month) values(v_month) on conflict do nothing;
 select held_cost_microusd+spent_cost_microusd+case when cfg.baseline_month=v_month then cfg.legacy_monthly_cost_microusd else 0 end into v_spent from public.luna32_ai_month_totals where month=v_month;
 if v_spent+20000>cfg.monthly_cap_microusd then return jsonb_build_object('status','global_budget');end if;
 insert into public.luna42_voice_requests(telegram_id,request_id,audio_hash,language,duration_ms,state) values(p_owner,p_request,p_hash,p_language,p_duration,'reserved');
 update public.luna32_ai_month_totals set held_cost_microusd=held_cost_microusd+20000 where month=v_month;
 return jsonb_build_object('status','reserved');
end $$;
create or replace function public.luna42_settle_voice(p_owner bigint,p_request uuid,p_text text,p_cost bigint,p_input integer,p_output integer,p_latency integer)
returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
declare prior public.luna42_voice_requests;
begin
 if p_owner is null or p_request is null or p_text is not null and char_length(p_text)>2000 or p_cost<0 or p_input<0 or p_output<0 or p_latency<0 or p_cost is not null and (p_input is null or p_output is null) then raise exception 'invalid_voice_settlement' using errcode='22023';end if;
 perform pg_advisory_xact_lock(3272001);
 select * into prior from public.luna42_voice_requests where telegram_id=p_owner and request_id=p_request and state='reserved' for update;
 if not found then return false;end if;
 update public.luna42_voice_requests set state=case when p_cost is null then 'unknown' when p_text is null or p_text='' then 'failed' else 'ready' end,actual_cost_microusd=p_cost,input_tokens=p_input,output_tokens=p_output,latency_ms=p_latency,transcript=p_text where telegram_id=p_owner and request_id=p_request;
 if p_cost is not null then
  update public.luna32_ai_month_totals set held_cost_microusd=held_cost_microusd-prior.reserved_cost_microusd,spent_cost_microusd=spent_cost_microusd+p_cost where month=(date_trunc('month',prior.created_at at time zone 'UTC'))::date;
  if p_cost>prior.reserved_cost_microusd then update public.luna32_runtime_settings set generation_enabled=false,updated_at=now() where id=true;end if;
 end if;
 return true;
end $$;
revoke all on function public.luna42_reserve_voice(bigint,uuid,text,text,integer),public.luna42_settle_voice(bigint,uuid,text,bigint,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.luna42_reserve_voice(bigint,uuid,text,text,integer),public.luna42_settle_voice(bigint,uuid,text,bigint,integer,integer,integer) to service_role;
comment on table public.luna42_voice_requests is 'Private transient transcripts, no audio. Hidden after 24h; deleted at next owner request. Costs remain in anonymous monthly budget on account erasure.';
notify pgrst,'reload schema';
commit;
-- Rollback: disable FEATURE_AI_VOICE_INPUT and VITE_FEATURE_AI_VOICE_INPUT;
-- retain audit rows and held/settled amounts. Do not release unknown holds or
-- reset global totals. Revoke new RPC grants to quarantine, reapply to restore.
