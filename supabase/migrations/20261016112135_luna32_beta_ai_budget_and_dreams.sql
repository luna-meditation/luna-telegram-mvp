-- Luna-only additive foundation. Nothing is activated by applying this file.
-- No alterations to existing balances, payments, subscriptions or other apps.
set local lock_timeout='5s';
set local statement_timeout='30s';
create table if not exists public.luna32_runtime_settings (
 id boolean primary key default true check(id),
 public_beta boolean not null default false,
 beta_starts_at timestamptz,
 beta_expires_at timestamptz,
 beta_features jsonb not null default '["ai","tarot","astrology","meditations","breathwork","dreams"]',
 free_daily_limit integer check(free_daily_limit between 1 and 200),
 premium_daily_limit integer check(premium_daily_limit between 1 and 500),
 monthly_cap_microusd bigint not null default 30000000 check(monthly_cap_microusd>=0),
 legacy_monthly_cost_microusd bigint not null default 0 check(legacy_monthly_cost_microusd>=0),
 baseline_month date,
 cost_baseline_verified boolean not null default false,
 generation_enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 check(not public_beta or (beta_starts_at is not null and beta_expires_at>beta_starts_at)),
 check(jsonb_typeof(beta_features)='array')
);
insert into public.luna32_runtime_settings(id) values(true) on conflict(id) do nothing;

create table if not exists public.luna32_ai_operations (
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 operation_key text not null check(length(operation_key) between 1 and 180),
 request_day date not null default (now() at time zone 'UTC')::date,
 state text not null check(state in ('processing','succeeded','failed')),
 lease uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(telegram_id,operation_key)
);
create index if not exists luna32_ai_operation_quota on public.luna32_ai_operations(telegram_id,request_day,state);

create table if not exists public.luna32_ai_attempts (
 id uuid primary key,
 telegram_id bigint not null,
 operation_key text not null,
 lease uuid not null,
 call_index integer not null check(call_index between 1 and 2),
 model text not null check(model in ('gpt-5-mini','gpt-5-mini-2025-08-07')),
 state text not null default 'reserved' check(state in ('reserved','settled','unknown')),
 reserved_cost_microusd bigint not null check(reserved_cost_microusd>0),
 actual_cost_microusd bigint check(actual_cost_microusd>=0),
 input_tokens integer check(input_tokens>=0),
 cached_input_tokens integer check(cached_input_tokens>=0),
 output_tokens integer check(output_tokens>=0),
 provider_status text check(length(provider_status)<=40),
 created_at timestamptz not null default now(),
 settled_at timestamptz,
 foreign key(telegram_id,operation_key) references public.luna32_ai_operations(telegram_id,operation_key) on delete cascade,
 unique(telegram_id,operation_key,lease,call_index)
);
create index if not exists luna32_ai_attempt_month on public.luna32_ai_attempts(created_at);

-- Anonymous monthly aggregate survives an account erasure: deleting personal
-- audit records must never make already spent provider money available again.
create table if not exists public.luna32_ai_month_totals(
 month date primary key,
 held_cost_microusd bigint not null default 0 check(held_cost_microusd>=0),
 spent_cost_microusd bigint not null default 0 check(spent_cost_microusd>=0)
);

create table if not exists public.luna32_dream_entries (
 id uuid primary key default gen_random_uuid(),
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 client_id uuid not null,
 title text not null check(length(title) between 1 and 100),
 description text not null check(length(description) between 1 and 6000),
 language text not null check(language in ('en','ru')),
 dream_date date not null,
 consent_version text not null check(consent_version='luna32-dream-v1'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(telegram_id,client_id)
);
create index if not exists luna32_dream_owner_history on public.luna32_dream_entries(telegram_id,created_at desc,id);

alter table public.luna32_runtime_settings enable row level security;
alter table public.luna32_runtime_settings force row level security;
alter table public.luna32_ai_operations enable row level security;
alter table public.luna32_ai_operations force row level security;
alter table public.luna32_ai_attempts enable row level security;
alter table public.luna32_ai_attempts force row level security;
alter table public.luna32_dream_entries enable row level security;
alter table public.luna32_dream_entries force row level security;
alter table public.luna32_ai_month_totals enable row level security;
alter table public.luna32_ai_month_totals force row level security;
-- Telegram identities are validated by the existing server, not auth.uid().
revoke all on public.luna32_runtime_settings,public.luna32_ai_operations,public.luna32_ai_attempts,public.luna32_ai_month_totals,public.luna32_dream_entries from public,anon,authenticated;
grant select,insert,update,delete on public.luna32_runtime_settings,public.luna32_ai_operations,public.luna32_ai_attempts,public.luna32_ai_month_totals,public.luna32_dream_entries to service_role;

-- A single allowance across legacy chat, chart reports and Tarot, including
-- requests already made today before this release. UNION deduplicates the new
-- ledger and its legacy idempotency record; the caller excludes its own turn.
create or replace function public.luna32_ai_used(p_owner bigint,p_exclude text default null)
returns integer language sql stable security invoker set search_path='' as $$
 select count(*)::integer from (
  select operation_key k from public.luna32_ai_operations
   where telegram_id=p_owner and request_day=(now() at time zone 'UTC')::date and state in ('processing','succeeded')
  union
  select case when client_request_id like 'astro\_%' escape '\' then 'report:'||substr(client_request_id,7) else 'chat:'||client_request_id end
   from public.ai_chat_requests where telegram_id=p_owner and quota_charged=true
   and created_at>=((now() at time zone 'UTC')::date at time zone 'UTC')
  union
  select 'tarot:'||client_reading_id::text from public.luna_tarot_readings
   where telegram_id=p_owner and (status='processing' or (status='ready' and interpretation is not null))
   and created_at>=((now() at time zone 'UTC')::date at time zone 'UTC')
 ) used where p_exclude is null or used.k<>p_exclude
$$;

create or replace function public.luna32_reserve_ai_attempt(p_owner bigint,p_operation text,p_lease uuid,p_call integer,p_attempt uuid,p_model text,p_ceiling bigint,p_limit integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna32_runtime_settings%rowtype; op public.luna32_ai_operations%rowtype;
 spent bigint; used integer; day date:=(now() at time zone 'UTC')::date; month_start timestamptz:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
begin
 if p_owner is null or p_operation is null or length(p_operation) not between 1 and 180 or p_lease is null or p_attempt is null or p_call is null or p_call not between 1 and 2 or p_ceiling is null or p_ceiling not between 1 and 100000 or p_limit is null or p_limit not between 1 and 500 or p_model is null or p_model not in ('gpt-5-mini','gpt-5-mini-2025-08-07') then raise exception 'Invalid AI reservation';end if;
 -- One global budget lock gives conservative, serial reservations across workers.
 -- It is held for SQL only, never for an external provider request.
 perform pg_advisory_xact_lock(3272001);
 select * into strict cfg from public.luna32_runtime_settings where id=true;
 if not cfg.generation_enabled or not cfg.cost_baseline_verified or cfg.baseline_month is null or cfg.baseline_month>month_start::date or cfg.monthly_cap_microusd<=0 then return jsonb_build_object('status','budget_unconfigured');end if;
 select * into op from public.luna32_ai_operations where telegram_id=p_owner and operation_key=p_operation for update;
 if found then
  if op.state='succeeded' then return jsonb_build_object('status','already_completed');end if;
  if op.state='processing' and op.lease<>p_lease and op.updated_at>now()-interval '3 minutes' then return jsonb_build_object('status','in_progress');end if;
 end if;
 used:=public.luna32_ai_used(p_owner,p_operation);
 -- Failed answers do not spend successful-answer quota, but cannot allow
 -- unlimited provider attempts. Tool continuations count toward this bound.
 if (select count(*) from public.luna32_ai_attempts where telegram_id=p_owner and created_at>=((now() at time zone 'UTC')::date at time zone 'UTC'))>=greatest(12,p_limit*3) then return jsonb_build_object('status','attempt_limit');end if;
 if used>=p_limit then return jsonb_build_object('status','daily_limit');end if;
 insert into public.luna32_ai_month_totals(month) values(month_start::date) on conflict do nothing;
 select (case when cfg.baseline_month=month_start::date then cfg.legacy_monthly_cost_microusd else 0 end)+held_cost_microusd+spent_cost_microusd into spent from public.luna32_ai_month_totals where month=month_start::date;
 if spent+p_ceiling>cfg.monthly_cap_microusd then return jsonb_build_object('status','global_budget');end if;
 if exists(select 1 from public.luna32_ai_attempts where telegram_id=p_owner and operation_key=p_operation and lease=p_lease and call_index=p_call) then return jsonb_build_object('status','duplicate_attempt');end if;
 insert into public.luna32_ai_operations(telegram_id,operation_key,state,lease,request_day) values(p_owner,p_operation,'processing',p_lease,day)
 on conflict(telegram_id,operation_key) do update set state='processing',lease=excluded.lease,request_day=excluded.request_day,updated_at=now();
 insert into public.luna32_ai_attempts(id,telegram_id,operation_key,lease,call_index,model,reserved_cost_microusd) values(p_attempt,p_owner,p_operation,p_lease,p_call,p_model,p_ceiling);
 update public.luna32_ai_month_totals set held_cost_microusd=held_cost_microusd+p_ceiling where month=month_start::date;
 return jsonb_build_object('status','reserved','remaining',p_limit-used-1);
end $$;

create or replace function public.luna32_settle_ai_attempt(p_owner bigint,p_attempt uuid,p_cost bigint,p_input integer,p_cached integer,p_output integer,p_status text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare changed integer; prior public.luna32_ai_attempts%rowtype;
begin
 if p_cost<0 or p_input<0 or p_cached<0 or p_cached>p_input or p_output<0 or p_status is null or length(p_status)>40 or (p_cost is not null and (p_input is null or p_cached is null or p_output is null)) then raise exception 'Invalid usage';end if;
 perform pg_advisory_xact_lock(3272001);
 select * into prior from public.luna32_ai_attempts where id=p_attempt and telegram_id=p_owner and state='reserved' for update;
 if not found then return false;end if;
 update public.luna32_ai_attempts set state=case when p_cost is null then 'unknown' else 'settled' end,
 actual_cost_microusd=p_cost,input_tokens=p_input,cached_input_tokens=p_cached,output_tokens=p_output,provider_status=p_status,settled_at=now()
 where id=p_attempt and telegram_id=p_owner and state='reserved';get diagnostics changed=row_count;
 if changed=1 and p_cost is not null then
  update public.luna32_ai_month_totals set held_cost_microusd=held_cost_microusd-prior.reserved_cost_microusd,spent_cost_microusd=spent_cost_microusd+p_cost where month=(date_trunc('month',prior.created_at at time zone 'UTC'))::date;
  -- A provider price/model anomaly must stop new spending, not just log it.
  if p_cost>prior.reserved_cost_microusd then update public.luna32_runtime_settings set generation_enabled=false,updated_at=now() where id=true;end if;
 end if;
 return changed=1;
end $$;

create or replace function public.luna32_finish_ai_operation(p_owner bigint,p_operation text,p_lease uuid,p_success boolean)
returns boolean language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
 if p_success is null then raise exception 'Missing outcome';end if;
 update public.luna32_ai_operations set state=case when p_success then 'succeeded' else 'failed' end,updated_at=now()
 where telegram_id=p_owner and operation_key=p_operation and lease=p_lease and state='processing';get diagnostics changed=row_count;return changed=1;
end $$;

revoke all on function public.luna32_ai_used(bigint,text),public.luna32_reserve_ai_attempt(bigint,text,uuid,integer,uuid,text,bigint,integer),public.luna32_settle_ai_attempt(bigint,uuid,bigint,integer,integer,integer,text),public.luna32_finish_ai_operation(bigint,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.luna32_ai_used(bigint,text),public.luna32_reserve_ai_attempt(bigint,text,uuid,integer,uuid,text,bigint,integer),public.luna32_settle_ai_attempt(bigint,uuid,bigint,integer,integer,integer,text),public.luna32_finish_ai_operation(bigint,text,uuid,boolean) to service_role;

notify pgrst,'reload schema';
