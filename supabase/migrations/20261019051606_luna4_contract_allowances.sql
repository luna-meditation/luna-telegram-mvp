-- Finite benefits for immutable NEW contracts. No catalog activation/backfill.
-- Existing reservations, grants, global cost guard and settlement are reused.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
alter table public.luna30_usage_reservations drop constraint if exists luna30_usage_reservations_bucket_check;
alter table public.luna30_usage_reservations add constraint luna30_usage_reservations_bucket_check check(bucket in('ai','three','five','compatibility','deep'));

create or replace function public.luna4_contract_window(p_plan text,p_start timestamptz,p_end timestamptz,p_at timestamptz)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare i integer:=0;s timestamptz;e timestamptz;
begin
 if coalesce(p_plan not in('weekly','monthly','annual','lifetime') or not isfinite(p_start) or not isfinite(p_at) or p_start>=p_end or p_at<p_start or p_at>=p_end or (p_plan<>'lifetime' and not isfinite(p_end)),true) then raise exception 'Inactive contract';end if;
 if p_plan in('weekly','monthly') then
  s:=p_start;e:=least(p_end,p_start+make_interval(hours=>case when p_plan='weekly' then 168 else 720 end));
 else
  i:=(extract(year from p_at at time zone 'UTC')::integer-extract(year from p_start at time zone 'UTC')::integer)*12+extract(month from p_at at time zone 'UTC')::integer-extract(month from p_start at time zone 'UTC')::integer;
  if (((p_start at time zone 'UTC')+make_interval(months=>i)) at time zone 'UTC')>p_at then i:=i-1;end if;
  s:=((p_start at time zone 'UTC')+make_interval(months=>i)) at time zone 'UTC';
  e:=least(p_end,((p_start at time zone 'UTC')+make_interval(months=>i+1)) at time zone 'UTC');
 end if;
 if p_at>=e then raise exception 'Inactive contract';end if;
 return jsonb_build_object('start',s,'end',e,'index',i,'scope',case when p_plan='weekly' then 'subscription_week' else 'billing_month' end);
end $$;

create or replace function public.luna4_membership_contract(p_owner bigint,p_at timestamptz default now())
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare u public.users%rowtype;e public.luna30_entitlement_periods%rowtype;t public.luna4_order_terms%rowtype;w jsonb;plan text;
begin
 if p_owner is null or not isfinite(p_at) then raise exception 'Invalid owner/time';end if;
 select * into strict u from public.users where telegram_id=p_owner;
 -- Historical promises (including unclassified old paid periods) win. New
 -- Lifetime periods are NOT legacy unlimited access merely due to infinity.
 if u.lifetime_access or u.active_until>p_at or exists(select 1 from public.luna30_entitlement_periods ep where ep.telegram_id=p_owner and ep.revoked_at is null and ep.period_start<=p_at and ep.period_end>p_at and not exists(select 1 from public.luna30_commercial_receipts r join public.luna30_commercial_orders o on o.id=r.order_id and o.telegram_id=r.telegram_id where r.period_id=ep.id and r.telegram_id=p_owner and o.catalog_version='luna-4.0-completion-v1')) then
  return jsonb_build_object('paid',true,'preserveLegacy',true,'kind',case when u.lifetime_access or u.active_until='infinity'::timestamptz or exists(select 1 from public.luna30_entitlement_periods ep where ep.telegram_id=p_owner and ep.revoked_at is null and ep.period_start<=p_at and ep.period_end='infinity'::timestamptz) then 'lifetime' else 'legacy_fixed_term' end);
 end if;
 select ep.* into e from public.luna30_entitlement_periods ep join public.luna30_commercial_receipts r on r.period_id=ep.id and r.telegram_id=ep.telegram_id and r.state='paid' join public.luna30_commercial_orders o on o.id=r.order_id and o.telegram_id=ep.telegram_id and o.catalog_version='luna-4.0-completion-v1' where ep.telegram_id=p_owner and ep.revoked_at is null and ep.period_start<=p_at and ep.period_end>p_at order by ep.period_start,ep.id limit 1;
 if not found then return jsonb_build_object('paid',false,'preserveLegacy',false,'kind','free');end if;
 select ot.* into t from public.luna4_order_terms ot join public.luna30_commercial_receipts r on r.order_id=ot.order_id and r.telegram_id=ot.telegram_id where r.period_id=e.id and ot.telegram_id=p_owner and r.state='paid';
 if not found or t.catalog_version<>'luna-4.0-completion-v1' or jsonb_typeof(t.snapshot->'allowances')<>'object' then raise exception 'Original contract benefits unavailable';end if;
 plan:=t.snapshot->>'plan';w:=public.luna4_contract_window(plan,e.period_start,e.period_end,p_at);
 return jsonb_build_object('paid',true,'preserveLegacy',false,'kind',plan,'contractVersion',t.catalog_version,'contractRevision',t.catalog_revision,'periodId',e.id,'periodKey','v4:'||e.id::text||':'||(w->>'index'),'until',case when isfinite(e.period_end) then to_jsonb(e.period_end) else 'null'::jsonb end,'window',w,'allowances',t.snapshot->'allowances');
end $$;

create or replace function public.luna4_allowance_status(p_owner bigint,p_bucket text,p_exclude uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;contract jsonb;runtime public.luna32_runtime_settings%rowtype;
 base_limit integer;used_value integer;extra_value integer:=0;key_value text;start_value timestamptz;end_value timestamptz;scope_value text;
begin
 select * into strict cfg from public.luna34_commercial_settings where id;
 if cfg.catalog->>'version'<>'luna-4.0-completion-v1' then return public.luna34_allowance_status(p_owner,p_bucket,p_exclude);end if;
 if p_bucket not in('ai','three','five','compatibility','deep') then raise exception 'Invalid allowance bucket';end if;
 if not(cfg.quotas_enabled and cfg.owner_approved and cfg.luna4_activation_verified) then return jsonb_build_object('enabled',false);end if;
 contract:=public.luna4_membership_contract(p_owner);
 if (contract->>'preserveLegacy')::boolean then return jsonb_build_object('enabled',false,'preserveLegacy',true);end if;
 select * into strict runtime from public.luna32_runtime_settings where id;
 -- Do not end the existing free Beta early or burn new included benefits.
 if runtime.public_beta and runtime.beta_starts_at<=now() and runtime.beta_expires_at>now() and runtime.beta_features ? (case when p_bucket='compatibility' then 'astrology' when p_bucket in('three','five') then 'tarot' else 'ai' end) then return jsonb_build_object('enabled',false,'preserveBeta',true);end if;
 if (contract->>'paid')::boolean then
  base_limit:=case p_bucket when 'ai' then (contract#>>'{allowances,standard}')::integer when 'three' then (contract#>>'{allowances,three}')::integer when 'deep' then (contract#>>'{allowances,deep}')::integer else 0 end;
  key_value:=contract->>'periodKey';start_value:=(contract#>>'{window,start}')::timestamptz;end_value:=(contract#>>'{window,end}')::timestamptz;scope_value:=contract#>>'{window,scope}';
 else
  base_limit:=case when p_bucket='ai' then coalesce(runtime.free_daily_limit,5) else 0 end;
  start_value:=((now() at time zone 'UTC')::date) at time zone 'UTC';end_value:=start_value+interval '24 hours';key_value:='v4:free:'||to_char(start_value at time zone 'UTC','YYYY-MM-DD');scope_value:='utc_day';
 end if;
 if base_limit is null or base_limit not between 0 and 10000 then raise exception 'Invalid original allowance';end if;
 select count(*) into used_value from public.luna30_usage_reservations where telegram_id=p_owner and bucket=p_bucket and period_key=key_value and state in('reserved','success') and(p_exclude is null or request_id<>p_exclude);
 if p_bucket='ai' then select coalesce(sum(greatest(0,g.quantity-(select count(*) from public.luna40_quota_uses qu where qu.grant_id=g.id and qu.state in('held','consumed')))),0)::integer into extra_value from public.luna40_quota_grants g where g.telegram_id=p_owner and g.revoked_at is null and g.expires_at>now();end if;
 return jsonb_build_object('enabled',true,'contractVersion','luna-4.0-completion-v1','status',case when base_limit+extra_value=0 then 'no_included_allowance' else 'available' end,'kind',contract->>'kind','scope',scope_value,'periodKey',key_value,'periodStart',start_value,'resetAt',end_value,'limit',base_limit+extra_value,'baseLimit',base_limit,'used',used_value,'includedRemaining',greatest(0,base_limit-used_value),'additionalRemaining',extra_value,'remaining',greatest(0,base_limit-used_value)+extra_value);
end $$;

create or replace function public.luna4_reserve_allowance(p_owner bigint,p_request uuid,p_bucket text,p_hash text,p_operation text,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare available jsonb;r public.luna30_usage_reservations%rowtype;grant_value uuid;grant_use public.luna40_quota_uses%rowtype;
begin
 if coalesce(p_request is null or p_hash !~ '^[a-f0-9]{64}$' or p_lease is null or p_operation is null or p_hash<>encode(sha256(convert_to('luna34:'||p_owner::text||':'||p_operation,'UTF8')),'hex'),true) then raise exception 'Invalid operation identity';end if;
 -- Match the existing extra-message allocator lock order. Grant row locks
 -- alone are insufficient when two paths count uses without updating grants.
 perform pg_advisory_xact_lock(3272001);
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna34_allowance:'||p_owner::text,0));
 if not exists(select 1 from public.luna32_ai_operations o where o.telegram_id=p_owner and o.operation_key=p_operation and o.lease=p_lease and o.state='processing') then return jsonb_build_object('enabled',true,'status','invalid_lease');end if;
 select * into r from public.luna30_usage_reservations where telegram_id=p_owner and request_id=p_request for update;
 if found then
  if r.bucket<>p_bucket or r.request_hash<>p_hash then return jsonb_build_object('enabled',true,'status','request_conflict');end if;
  if r.state in('reserved','success') then
   update public.luna40_quota_uses set lease=p_lease where telegram_id=p_owner and operation_key=p_operation and state='held';
   return jsonb_build_object('enabled',true,'status',r.state,'replay',true);
  end if;
 end if;
 available:=public.luna4_allowance_status(p_owner,p_bucket,p_request);
 if available->>'contractVersion' is distinct from 'luna-4.0-completion-v1' or not coalesce((available->>'enabled')::boolean,false) then return available;end if;
 if available->>'status'<>'available' then return available;end if;
 if (available->>'includedRemaining')::integer<=0 then
  if p_bucket<>'ai' or p_operation not like 'chat:%' then return available||jsonb_build_object('status','limit');end if;
  select g.id into grant_value from public.luna40_quota_grants g where g.telegram_id=p_owner and g.revoked_at is null and g.expires_at>now() and g.quantity>(select count(*) from public.luna40_quota_uses qu where qu.grant_id=g.id and qu.state in('held','consumed')) order by g.expires_at,g.id limit 1 for update;
  if grant_value is null then return available||jsonb_build_object('status','limit');end if;
  select * into grant_use from public.luna40_quota_uses where telegram_id=p_owner and operation_key=p_operation;
  if found and grant_use.state<>'released' then return available||jsonb_build_object('status','request_conflict');end if;
  insert into public.luna40_quota_uses(telegram_id,operation_key,grant_id,lease,state) values(p_owner,p_operation,grant_value,p_lease,'held') on conflict(telegram_id,operation_key) do update set grant_id=excluded.grant_id,lease=excluded.lease,state='held';
 end if;
 insert into public.luna30_usage_reservations(telegram_id,request_id,request_hash,bucket,period_key,allowance,state)
 values(p_owner,p_request,p_hash,p_bucket,available->>'periodKey',greatest(1,(available->>'baseLimit')::integer),'reserved')
 on conflict(telegram_id,request_id) do update set period_key=excluded.period_key,allowance=excluded.allowance,state='reserved',usage_id=null,settled_at=null;
 return available||jsonb_build_object('status','reserved','replay',false,'remaining',greatest(0,(available->>'remaining')::integer-1));
end $$;

create or replace function public.luna4_settle_allowance(p_owner bigint,p_request uuid,p_operation text,p_lease uuid,p_success boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result_value jsonb;
begin
 perform pg_advisory_xact_lock(3272001);
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna34_allowance:'||p_owner::text,0));
 if not exists(select 1 from public.luna32_ai_operations o where o.telegram_id=p_owner and o.operation_key=p_operation and o.lease=p_lease and o.state=case when p_success then 'succeeded' else 'failed' end) then raise exception 'Owned final operation lease required';end if;
 if p_success and not exists(select 1 from public.luna32_ai_attempts a where a.telegram_id=p_owner and a.operation_key=p_operation and a.lease=p_lease and a.provider_status='completed' and a.state='settled' and a.output_tokens>0 and a.actual_cost_microusd is not null) then raise exception 'Verified successful AI result for this lease required';end if;
 result_value:=public.luna34_settle_allowance(p_owner,p_request,p_operation,p_success);
 if result_value->>'status' in('success','failed') then update public.luna40_quota_uses set state=case when p_success then 'consumed' else 'released' end where telegram_id=p_owner and operation_key=p_operation and lease=p_lease and state='held';end if;
 return result_value;
end $$;
revoke all on function public.luna4_contract_window(text,timestamptz,timestamptz,timestamptz),public.luna4_membership_contract(bigint,timestamptz),public.luna4_allowance_status(bigint,text,uuid),public.luna4_reserve_allowance(bigint,uuid,text,text,text,uuid),public.luna4_settle_allowance(bigint,uuid,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.luna4_contract_window(text,timestamptz,timestamptz,timestamptz),public.luna4_membership_contract(bigint,timestamptz),public.luna4_allowance_status(bigint,text,uuid),public.luna4_reserve_allowance(bigint,uuid,text,text,text,uuid),public.luna4_settle_allowance(bigint,uuid,text,uuid,boolean) to service_role;
notify pgrst,'reload schema';commit;
-- Rollback: disable commercial quota env/db gates. Keep original contracts,
-- successful usage, held/unknown provider costs and purchased message grants.
-- Do not reclassify new Lifetime as legacy or reset already consumed benefits.
