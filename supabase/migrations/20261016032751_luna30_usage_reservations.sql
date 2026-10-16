-- PREPARED / LOCAL TEST ONLY. No live quota/price/entitlement changes.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
-- Depends on luna30_referral_foundation's shared release settings; do not apply out of order.
create table if not exists public.luna30_entitlement_periods (
 id uuid primary key default gen_random_uuid(),telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 source_charge_id text not null unique,period_start timestamptz not null,period_end timestamptz not null,
 revoked_at timestamptz,created_at timestamptz not null default now(),check(period_start<period_end),unique(telegram_id,id)
);
create index if not exists luna30_entitlement_owner_period on public.luna30_entitlement_periods(telegram_id,period_start,period_end) where revoked_at is null;
create table if not exists public.luna30_usage_reservations (
 id uuid primary key default gen_random_uuid(),telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 request_id uuid not null,request_hash text not null check(length(request_hash)=64),bucket text not null check(bucket in ('ai','three','five','compatibility')),
 period_key text not null,allowance integer not null check(allowance>0),state text not null check(state in ('reserved','success','failed','cancelled')),
 usage_id uuid unique references public.ai_usage(id) on delete set null,created_at timestamptz not null default now(),settled_at timestamptz,
 unique(telegram_id,request_id)
);
create index if not exists luna30_usage_owner_period on public.luna30_usage_reservations(telegram_id,period_key,bucket,state);
do $$declare t text;begin foreach t in array array['luna30_release_settings','luna30_entitlement_periods','luna30_usage_reservations'] loop
 execute format('alter table public.%I enable row level security',t);execute format('alter table public.%I force row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select,insert,update on public.%I to service_role',t);
end loop;end $$;

create or replace function public.luna30_reserve_usage(p_owner bigint,p_request_id uuid,p_bucket text,p_request_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.luna30_release_settings%rowtype;r public.luna30_usage_reservations%rowtype;e public.luna30_entitlement_periods%rowtype;
 v_period text;v_allowance integer;v_used integer;v_legacy boolean;
begin
 select * into strict s from public.luna30_release_settings where id;
 if not s.quotas_enabled or s.catalog_version<>'luna-3.0-proposed' then return jsonb_build_object('status','disabled');end if;
 if p_bucket not in ('ai','three','five','compatibility') or p_request_id is null or p_request_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid usage request';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_usage:'||p_owner::text,0));
 select * into r from public.luna30_usage_reservations where telegram_id=p_owner and request_id=p_request_id;
 if found then
  if r.request_hash<>p_request_hash or r.bucket<>p_bucket then return jsonb_build_object('status','request_conflict');end if;
  return jsonb_build_object('status',r.state,'reservationId',r.id,'replay',true);
 end if;
 select * into e from public.luna30_entitlement_periods where telegram_id=p_owner and revoked_at is null and now()>=period_start and now()<period_end order by period_start desc limit 1;
 if found then
  v_period:=e.id::text;v_allowance:=case p_bucket when 'ai' then 150 when 'three' then 8 when 'five' then 4 else 2 end;
 else
  select lifetime_access or coalesce(active_until>now(),false) into v_legacy from public.users where telegram_id=p_owner;
  if not found then raise exception 'Unknown owner';end if;
  -- Never silently downgrade a Lifetime/fixed-term user because a v3 period is absent.
  if v_legacy then return jsonb_build_object('status','legacy_period_required');end if;
  if p_bucket<>'ai' then return jsonb_build_object('status','no_included_allowance');end if;
  v_period:='free:'||to_char(now() at time zone 'UTC','YYYY-MM');v_allowance:=10;
 end if;
 select count(*) into v_used from public.luna30_usage_reservations where telegram_id=p_owner and period_key=v_period and bucket=p_bucket and state in ('reserved','success');
 if v_used>=v_allowance then return jsonb_build_object('status','limit','remaining',0);end if;
 insert into public.luna30_usage_reservations(telegram_id,request_id,request_hash,bucket,period_key,allowance,state)
 values(p_owner,p_request_id,p_request_hash,p_bucket,v_period,v_allowance,'reserved') returning * into r;
 return jsonb_build_object('status','reserved','reservationId',r.id,'remaining',v_allowance-v_used-1,'replay',false);
end $$;

create or replace function public.luna30_settle_usage(p_owner bigint,p_request_id uuid,p_success boolean,p_usage_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.luna30_usage_reservations%rowtype;
begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_usage:'||p_owner::text,0));
 select * into r from public.luna30_usage_reservations where telegram_id=p_owner and request_id=p_request_id for update;
 if not found then return jsonb_build_object('status','not_found');end if;
 if r.state<>'reserved' then return jsonb_build_object('status',r.state,'replay',true);end if;
 if p_success and (p_usage_id is null or not exists(select 1 from public.ai_usage where id=p_usage_id and telegram_id=p_owner and request_status='success' and output_tokens>0)) then raise exception 'Verified successful provider usage is required';end if;
 update public.luna30_usage_reservations set state=case when p_success then 'success' else 'failed' end,usage_id=case when p_success then p_usage_id else null end,settled_at=now() where id=r.id;
 return jsonb_build_object('status',case when p_success then 'success' else 'failed' end,'replay',false);
end $$;
revoke all on function public.luna30_reserve_usage(bigint,uuid,text,text),public.luna30_settle_usage(bigint,uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.luna30_reserve_usage(bigint,uuid,text,text),public.luna30_settle_usage(bigint,uuid,boolean,uuid) to service_role;
commit;
-- Rollback: turn all v3 flags/settings off. Retain financial periods and usage audit records.
-- Never reset legacy subscription fields or replay a successfully settled request.
