-- Additive private report queue. No balance, entitlement or payment changes.
begin;
set local lock_timeout='5s'; set local statement_timeout='30s';
alter table public.luna30_release_settings add column if not exists astrology_ai_enabled boolean not null default false;
create table if not exists public.luna30_astrology_jobs (
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 cache_key text not null check(cache_key ~ '^[a-f0-9]{64}$'),
 first_chart_id uuid not null,second_chart_id uuid,report_kind text not null check(report_kind in ('portrait','compatibility')),
 language text not null check(language in ('en','ru')),state text not null check(state in ('processing','completed','failed')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(telegram_id,cache_key),
 foreign key(telegram_id,first_chart_id) references public.luna30_chart_cache(telegram_id,id) on delete cascade,
 foreign key(telegram_id,second_chart_id) references public.luna30_chart_cache(telegram_id,id) on delete cascade,
 check((report_kind='portrait' and second_chart_id is null) or (report_kind='compatibility' and second_chart_id is not null and first_chart_id<>second_chart_id))
);
create index if not exists luna30_astrology_jobs_day on public.luna30_astrology_jobs(created_at,telegram_id);
alter table public.luna30_astrology_jobs enable row level security;
alter table public.luna30_astrology_jobs force row level security;
revoke all on public.luna30_astrology_jobs from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.luna30_astrology_jobs to service_role;
create or replace function public.luna30_claim_astrology_report(p_owner bigint,p_first uuid,p_second uuid,p_kind text,p_language text,p_key text,p_daily_chat_limit integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.luna30_astrology_jobs%rowtype;r record;v_start timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
 if not exists(select 1 from public.luna30_release_settings where id and astrology_enabled and astrology_ai_enabled) then return jsonb_build_object('status','disabled','acquired',false);end if;
 if p_key is null or p_key !~ '^[a-f0-9]{64}$' or p_kind not in ('portrait','compatibility') or p_language not in ('en','ru') or p_daily_chat_limit not between 1 and 100 then raise exception 'Invalid report request';end if;
 -- A single short global lock makes both owner and global cost limits atomic.
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_astrology_budget',0));
 select * into j from public.luna30_astrology_jobs where telegram_id=p_owner and cache_key=p_key;
 if found then return jsonb_build_object('status',j.state,'acquired',false);end if;
 -- Count durable existing AI audit requests, not deletable private chart jobs.
 -- Deleting a birth profile must not reset the daily provider-spend boundary.
 if (select count(*) from public.ai_chat_requests where left(client_request_id,6)='astro_' and created_at>=v_start)>=20 or (select count(*) from public.ai_chat_requests where telegram_id=p_owner and left(client_request_id,6)='astro_' and created_at>=v_start)>=2 then return jsonb_build_object('status','limit','acquired',false);end if;
 -- Preserve the existing Free/Premium daily chat allowance, not a replacement quota.
 select * into r from public.reserve_luna_chat_request(p_owner,'astro_'||p_key,p_daily_chat_limit,null);
 if not r.acquired then return jsonb_build_object('status','limit','acquired',false);end if;
 insert into public.luna30_astrology_jobs(telegram_id,cache_key,first_chart_id,second_chart_id,report_kind,language,state) values(p_owner,p_key,p_first,p_second,p_kind,p_language,'processing');
 return jsonb_build_object('status','processing','acquired',true);
end $$;
create or replace function public.luna30_finish_astrology_report(p_owner bigint,p_key text,p_report jsonb,p_model text,p_input integer,p_output integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.luna30_astrology_jobs%rowtype;r public.luna30_astrology_reports%rowtype;
begin
 select * into strict j from public.luna30_astrology_jobs where telegram_id=p_owner and cache_key=p_key for update;
 if j.state='completed' then select * into strict r from public.luna30_astrology_reports where telegram_id=p_owner and cache_key=p_key;return to_jsonb(r)-'telegram_id'-'cache_key'-'input_tokens'-'output_tokens'-'model';end if;
 if j.state<>'processing' or jsonb_typeof(p_report)<>'object' or p_input<0 or p_output<=0 or not exists(select 1 from public.ai_usage where telegram_id=p_owner and request_id='astro:'||p_key and request_status='success' and input_tokens=p_input and output_tokens=p_output and model=p_model) then raise exception 'Verified successful usage required';end if;
 insert into public.luna30_astrology_reports(telegram_id,first_chart_id,second_chart_id,report_kind,language,cache_key,report,model,input_tokens,output_tokens) values(p_owner,j.first_chart_id,j.second_chart_id,j.report_kind,j.language,p_key,p_report,p_model,p_input,p_output) returning * into r;
 update public.luna30_astrology_jobs set state='completed',updated_at=now() where telegram_id=p_owner and cache_key=p_key;
 update public.ai_chat_requests set status='completed',quota_charged=true,updated_at=now() where telegram_id=p_owner and client_request_id='astro_'||p_key;
 return to_jsonb(r)-'telegram_id'-'cache_key'-'input_tokens'-'output_tokens'-'model';
end $$;
revoke all on function public.luna30_claim_astrology_report(bigint,uuid,uuid,text,text,text,integer),public.luna30_finish_astrology_report(bigint,text,jsonb,text,integer,integer) from public,anon,authenticated;
grant execute on function public.luna30_claim_astrology_report(bigint,uuid,uuid,text,text,text,integer),public.luna30_finish_astrology_report(bigint,text,jsonb,text,integer,integer) to service_role;
notify pgrst,'reload schema';
commit;
-- Rollback: turn LUNA30_ASTROLOGY_AI_ENABLED and astrology_ai_enabled off.
-- Keep reports/private jobs for owner deletion/export. Never retry an uncertain
-- provider outcome automatically or delete a charged audit record to reset a cap.
