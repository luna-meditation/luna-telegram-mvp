-- Prepared only. No change to existing payments, rights, balances or $100 cost baseline.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create table if not exists public.luna34_commercial_settings(
 id boolean primary key default true check(id),catalog jsonb not null check(catalog->>'version'='luna-3.4'),
 checkout_enabled boolean not null default false,quotas_enabled boolean not null default false,
 rewards_enabled boolean not null default false,referrals_enabled boolean not null default false,
 live_payment_verified boolean not null default false,owner_approved boolean not null default false,
 updated_at timestamptz not null default now(),
 check(not checkout_enabled or(live_payment_verified and owner_approved)),
 check(not quotas_enabled or owner_approved),
 check(not rewards_enabled or(checkout_enabled and owner_approved))
);
insert into public.luna34_commercial_settings(id,catalog) values(true,'{"version":"luna-3.4","currency":"XTR","free":{"aiSuccessfulRepliesPerUtcDay":5,"meditations":3,"dailyCard":1},"premium":{"monthlyStars":500,"periodDays":30,"ordinaryAiRepliesPerBillingMonth":300,"meditations":8,"threeCardReadings":8,"fiveCardReadings":4,"compatibilityReports":2,"renewalSeeds":100},"annual":{"stars":3500,"days":365,"recurring":false,"allocation":"monthly_anniversary"},"lifetime":{"onSale":false,"policy":"preserve_legacy","ordinaryAllowance":"existing_daily_quota","allPromisedContent":true},"seeds":{"single":15,"three":40,"five":70,"compatibility":100},"packages":[{"id":"seeds_100","seeds":100,"stars":100},{"id":"seeds_300","seeds":300,"stars":270},{"id":"seeds_700","seeds":700,"stars":590},{"id":"seeds_1500","seeds":1500,"stars":1190}],"ordinaryRewards":{"meditation":3,"breath":2,"journal":1,"dailyCap":6,"sevenDays":10},"referrals":{"inviter":30,"newUser":20,"maxMonthly":5},"supportStars":[10,50,100,500],"achievementRewardsEnabled":false}'::jsonb) on conflict do nothing;
alter table public.luna34_commercial_settings enable row level security;
alter table public.luna34_commercial_settings force row level security;
revoke all on public.luna34_commercial_settings from public,anon,authenticated,service_role;
grant select,insert,update on public.luna34_commercial_settings to service_role;

create or replace function public.luna34_allowance_status(p_owner bigint,p_bucket text,p_exclude uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;u public.users%rowtype;e public.luna30_entitlement_periods%rowtype;
 v_start timestamptz;v_end timestamptz;v_index integer:=0;v_limit integer;v_used integer;v_key text;v_kind text;
begin
 select * into strict cfg from public.luna34_commercial_settings where id;
 if not cfg.quotas_enabled or not cfg.owner_approved then return jsonb_build_object('enabled',false);end if;
 if p_bucket not in('ai','three','five','compatibility') then raise exception 'Invalid allowance bucket';end if;
 select * into strict u from public.users where telegram_id=p_owner;
 if u.lifetime_access or u.active_until>now() then return jsonb_build_object('enabled',false,'preserveLegacy',true);end if;
 select * into e from public.luna30_entitlement_periods where telegram_id=p_owner and revoked_at is null and period_start<=now() and period_end>now() order by period_start desc limit 1;
 if found then
  v_start:=e.period_start;v_end:=e.period_end;v_kind:='monthly';
  if e.period_end-e.period_start>interval '35 days' then
   v_kind:='annual';
   v_index:=(extract(year from now() at time zone 'UTC')::integer-extract(year from e.period_start at time zone 'UTC')::integer)*12+extract(month from now() at time zone 'UTC')::integer-extract(month from e.period_start at time zone 'UTC')::integer;
   if (((e.period_start at time zone 'UTC')+make_interval(months=>v_index)) at time zone 'UTC')>now() then v_index:=v_index-1;end if;
   v_start:=((e.period_start at time zone 'UTC')+make_interval(months=>v_index)) at time zone 'UTC';
   v_end:=least(e.period_end,((e.period_start at time zone 'UTC')+make_interval(months=>v_index+1)) at time zone 'UTC');
  end if;
  v_limit:=case p_bucket when 'ai' then (cfg.catalog#>>'{premium,ordinaryAiRepliesPerBillingMonth}')::integer when 'three' then (cfg.catalog#>>'{premium,threeCardReadings}')::integer when 'five' then (cfg.catalog#>>'{premium,fiveCardReadings}')::integer else (cfg.catalog#>>'{premium,compatibilityReports}')::integer end;
  v_key:='v34:'||e.id::text||':'||v_index::text;
 else
  if p_bucket<>'ai' then return jsonb_build_object('enabled',true,'status','no_included_allowance','limit',0,'remaining',0);end if;
  v_start:=((now() at time zone 'UTC')::date) at time zone 'UTC';v_end:=v_start+interval '24 hours';v_kind:='free';
  v_limit:=(cfg.catalog#>>'{free,aiSuccessfulRepliesPerUtcDay}')::integer;v_key:='v34:free:'||to_char(v_start at time zone 'UTC','YYYY-MM-DD');
 end if;
 select count(*) into v_used from public.luna30_usage_reservations where telegram_id=p_owner and bucket=p_bucket and period_key=v_key and state in('reserved','success') and(p_exclude is null or request_id<>p_exclude);
 return jsonb_build_object('enabled',true,'status','available','kind',v_kind,'scope',case when v_kind='free' then 'utc_day' else 'billing_month' end,'periodKey',v_key,'periodStart',v_start,'resetAt',v_end,'limit',v_limit,'used',v_used,'remaining',greatest(0,v_limit-v_used));
end $$;
create or replace function public.luna34_reserve_allowance(p_owner bigint,p_request uuid,p_bucket text,p_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare available jsonb;r public.luna30_usage_reservations%rowtype;
begin
 if p_request is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid allowance identity';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna34_allowance:'||p_owner::text,0));
 select * into r from public.luna30_usage_reservations where telegram_id=p_owner and request_id=p_request for update;
 if found then
  if r.bucket<>p_bucket or r.request_hash<>p_hash then return jsonb_build_object('enabled',true,'status','request_conflict');end if;
  if r.state in('reserved','success') then return jsonb_build_object('enabled',true,'status',r.state,'replay',true);end if;
 end if;
 available:=public.luna34_allowance_status(p_owner,p_bucket,p_request);
 if not coalesce((available->>'enabled')::boolean,false) then return available;end if;
 if available->>'status'<>'available' then return available;end if;
 if(available->>'remaining')::integer<=0 then return available||jsonb_build_object('status','limit');end if;
 insert into public.luna30_usage_reservations(telegram_id,request_id,request_hash,bucket,period_key,allowance,state)
 values(p_owner,p_request,p_hash,p_bucket,available->>'periodKey',(available->>'limit')::integer,'reserved')
 on conflict(telegram_id,request_id) do update set period_key=excluded.period_key,allowance=excluded.allowance,state='reserved',usage_id=null,settled_at=null;
 return available||jsonb_build_object('status','reserved','replay',false,'remaining',(available->>'remaining')::integer-1);
end $$;
create or replace function public.luna34_settle_allowance(p_owner bigint,p_request uuid,p_operation text,p_success boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.luna30_usage_reservations%rowtype;
begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna34_allowance:'||p_owner::text,0));
 select * into r from public.luna30_usage_reservations where telegram_id=p_owner and request_id=p_request for update;
 if not found then return jsonb_build_object('status','not_found');end if;
 if r.request_hash<>encode(sha256(convert_to('luna34:'||p_owner::text||':'||p_operation,'UTF8')),'hex') then raise exception 'Operation identity mismatch';end if;
 if r.state<>'reserved' then return jsonb_build_object('status',r.state,'replay',true);end if;
 if p_success and not exists(select 1 from public.luna32_ai_operations o where o.telegram_id=p_owner and o.operation_key=p_operation and o.state='succeeded'
 and exists(select 1 from public.luna32_ai_attempts a where a.telegram_id=p_owner and a.operation_key=p_operation and a.provider_status='completed' and a.state='settled' and a.output_tokens>0 and a.actual_cost_microusd is not null)) then raise exception 'Verified successful AI result required';end if;
 update public.luna30_usage_reservations set state=case when p_success then 'success' else 'failed' end,settled_at=now() where id=r.id;
 return jsonb_build_object('status',case when p_success then 'success' else 'failed' end,'replay',false);
end $$;
create or replace function public.luna34_operating_metrics()
returns jsonb language sql stable security invoker set search_path='' as $$
 with attempts as(select a.*,case when operation_key like 'tarot:%' then 'tarot' when operation_key like 'report:%' then 'astrology_report' when operation_key like 'chat:%' then 'conversation' else 'other' end feature,date_trunc('month',created_at at time zone 'UTC')::date billing_month from public.luna32_ai_attempts a),
 groups as(select billing_month,feature,model,count(*) requests,count(distinct telegram_id) active_users,count(distinct(telegram_id,operation_key)) operations,greatest(0,count(distinct(telegram_id,operation_key,lease))-count(distinct(telegram_id,operation_key))) retry_leases,count(*) filter(where provider_status='completed') completed,count(*) filter(where provider_status<>'completed' or provider_status is null) failed_or_unknown,coalesce(sum(input_tokens),0) input_tokens,coalesce(sum(output_tokens),0) output_tokens,coalesce(sum(cached_input_tokens),0) cached_input_tokens,coalesce(sum(actual_cost_microusd),0) cost_microusd,coalesce(sum(reserved_cost_microusd) filter(where state in('reserved','unknown')),0) held_microusd,count(*) filter(where call_index>1) additional_provider_calls,min(created_at) first_recorded_at from attempts group by 1,2,3),
 projected as(select g.*,round(cost_microusd::numeric/greatest(1,active_users)) average_per_active_user_microusd,case when billing_month=date_trunc('month',now() at time zone 'UTC')::date then round(cost_microusd::numeric/greatest(86400,extract(epoch from now()-first_recorded_at))*extract(epoch from((billing_month::timestamp+interval '1 month') at time zone 'UTC')-first_recorded_at)) else null end recorded_run_rate_projection_microusd from groups g)
 select jsonb_build_object('groups',(select coalesce(jsonb_agg(to_jsonb(g) order by billing_month desc,feature,model),'[]') from projected g),'catalog_version','luna-3.4','financial_activation',(select to_jsonb(s)-'catalog' from public.luna34_commercial_settings s where id),'progress_settings',(select to_jsonb(s) from public.luna34_progress_settings s where id),'achievement_count',(select count(*) from public.luna34_achievement_catalog),'event_volume_last_hour',(select count(*) from public.luna34_progress_events where created_at>now()-interval '1 hour'),'stale_allowance_reservations',(select count(*) from public.luna30_usage_reservations where period_key like 'v34:%' and state='reserved' and created_at<now()-interval '1 hour'),'pricing_basis','Provider token-usage estimate, not an invoice. Unknown outcomes stay held. Projection extrapolates recorded activity only, not pre-ledger spending. Additional calls are not automatically classified as tools.','stars_revenue_usd',null,'settlement_required',true);
$$;
revoke all on function public.luna34_allowance_status(bigint,text,uuid),public.luna34_reserve_allowance(bigint,uuid,text,text),public.luna34_settle_allowance(bigint,uuid,text,boolean),public.luna34_operating_metrics() from public,anon,authenticated;
grant execute on function public.luna34_allowance_status(bigint,text,uuid),public.luna34_reserve_allowance(bigint,uuid,text,text),public.luna34_settle_allowance(bigint,uuid,text,boolean),public.luna34_operating_metrics() to service_role;
notify pgrst,'reload schema';
commit;
-- Rollback: disable the four new gates; retain ledger, periods and reservations.
-- Never restore stale balances, remove history or reset the $100 cost baseline.
