-- New-order contracts only. No activation, prices, balances or old rights change.
-- Depends on the reviewed draft validator and immutable order-term sidecar.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
alter table public.luna34_commercial_settings add column if not exists luna4_activation_verified boolean not null default false;
alter table public.luna34_commercial_settings add column if not exists luna4_cutover_at timestamptz;
alter table public.luna34_commercial_settings drop constraint if exists luna34_commercial_settings_catalog_check;
alter table public.luna34_commercial_settings add constraint luna34_commercial_settings_catalog_check
 check(catalog->>'version' in('luna-3.4','luna-4.3') or (public.luna4_valid_economy_catalog(catalog) and luna4_activation_verified and luna4_cutover_at is not null));

create or replace function public.luna4_prepare_order(p_owner bigint,p_request uuid,p_product text,p_expected integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;o public.luna30_commercial_orders%rowtype;
 stars_value integer;seeds_value integer:=0;days_value integer:=0;plan text;terms jsonb;
begin
 if coalesce(p_request is null or p_expected not between 1 and 10000 or p_product is null,true) then return jsonb_build_object('status','invalid');end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_order:'||p_owner::text,0));
 -- A catalog edit never changes or discards an already accepted invoice.
 select * into o from public.luna30_commercial_orders where telegram_id=p_owner and request_id=p_request;
 if found then
  if o.product<>p_product or o.stars<>p_expected then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('status','duplicate','order',to_jsonb(o)-'telegram_id');
 end if;
 select * into strict cfg from public.luna34_commercial_settings where id;
 if not(cfg.checkout_enabled and cfg.owner_approved and cfg.live_payment_verified and cfg.luna4_activation_verified) or cfg.catalog->>'version'<>'luna-4.0-completion-v1' or cfg.luna4_cutover_at is null or cfg.luna4_cutover_at>now() then return jsonb_build_object('status','disabled');end if;
 case p_product
  when 'premium_week' then plan:='weekly';days_value:=7;
  when 'premium_month' then plan:='monthly';days_value:=30;
  when 'premium_year' then plan:='annual';days_value:=365;
  when 'premium_lifetime' then plan:='lifetime';
  when 'support' then stars_value:=p_expected;
  else select (p->>'stars')::integer,(p->>'seeds')::integer into stars_value,seeds_value from jsonb_array_elements(cfg.catalog->'packages') p where p->>'id'=p_product;
 end case;
 if plan is not null then stars_value:=(cfg.catalog#>>array['premiumStars',plan])::integer;end if;
 if stars_value is null or stars_value<>p_expected then return jsonb_build_object('status','price_changed');end if;
 if p_product like 'premium_%' and(exists(select 1 from public.users where telegram_id=p_owner and(lifetime_access or active_until>now())) or exists(select 1 from public.luna30_entitlement_periods where telegram_id=p_owner and revoked_at is null and period_end>now())) then return jsonb_build_object('status','already_premium');end if;
 if (seeds_value>0 or plan is not null) and not exists(select 1 from public.luna21_settings where id and wallet_enabled) then return jsonb_build_object('status','wallet_disabled');end if;
 if plan is not null and exists(select 1 from public.luna30_commercial_orders where telegram_id=p_owner and product like 'premium_%' and state in('pending','accepted')) then return jsonb_build_object('status','pending_subscription');end if;
 insert into public.luna30_commercial_orders(telegram_id,request_id,product,stars,seeds,days,catalog_version)
 values(p_owner,p_request,p_product,stars_value,seeds_value,days_value,cfg.catalog->>'version') returning * into o;
 terms:=jsonb_build_object('product',p_product,'stars',stars_value,'seeds',seeds_value,'days',days_value,'recurring',false,'plan',plan,'allowances',case when plan is null then null else cfg.catalog#>array['premiumAllowances',plan] end,'allowanceScope',case when plan='weekly' then 'subscription_week' when plan is not null then 'subscription_month' else null end);
 perform public.luna4_capture_order_terms(p_owner,o.id,cfg.catalog->>'version',cfg.catalog_revision,terms);
 return jsonb_build_object('status','pending','order',to_jsonb(o)-'telegram_id','terms',terms);
end $$;

create or replace function public.luna4_accept_order(p_owner bigint,p_order uuid,p_stars integer,p_query text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare o public.luna30_commercial_orders%rowtype;t public.luna4_order_terms%rowtype;
begin
 select * into o from public.luna30_commercial_orders where id=p_order and telegram_id=p_owner for update;
 if not found then return false;end if;
 if o.catalog_version<>'luna-4.0-completion-v1' then return public.luna34_accept_order(p_owner,p_order,p_stars,p_query);end if;
 if not exists(select 1 from public.luna34_commercial_settings where id and checkout_enabled and owner_approved and live_payment_verified and luna4_activation_verified) then return false;end if;
 select * into t from public.luna4_order_terms where order_id=o.id and telegram_id=p_owner;
 if not found or (t.snapshot->>'stars')::integer is distinct from p_stars or o.stars is distinct from p_stars or o.state not in('pending','accepted') or p_query is null or length(p_query) not between 1 and 512 then return false;end if;
 if o.checkout_query_id is not null then return o.checkout_query_id=p_query;end if;
 update public.luna30_commercial_orders set state='accepted',checkout_query_id=p_query,accepted_at=now() where id=o.id;
 return true;
end $$;

-- Extend the EXISTING verified receipt engine, not a second payment system.
-- All legacy branches/amounts stay unchanged. New prepaid orders additionally
-- require their original immutable term snapshot, even after sales are paused.
create or replace function public.luna30_fulfill_order(p_owner bigint,p_order uuid,p_charge text,p_stars integer,p_expires timestamptz default null,p_recurring boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.luna30_commercial_orders%rowtype;r public.luna30_commercial_receipts%rowtype;v_period uuid;v_start timestamptz;v_end timestamptz;g public.moon_gardens%rowtype;t public.luna4_order_terms%rowtype;
begin
 if p_charge is null or length(p_charge) not between 1 and 512 then raise exception 'Invalid charge';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_charge:'||p_charge,0));
 select * into r from public.luna30_commercial_receipts where charge_id=p_charge;
 if found then
  if r.telegram_id<>p_owner or r.order_id<>p_order or r.stars<>p_stars then raise exception 'Receipt conflict';end if;
  return jsonb_build_object('status','duplicate');
 end if;
 select * into strict o from public.luna30_commercial_orders where id=p_order and telegram_id=p_owner for update;
 if o.stars is distinct from p_stars or o.accepted_at is null or o.state not in('accepted','paid') then raise exception 'Unaccepted or mismatched receipt';end if;
 if o.state='paid' and (o.product<>'premium_month' or not p_recurring) then raise exception 'Unexpected duplicate purchase';end if;
 if o.catalog_version='luna-4.0-completion-v1' then
  select * into t from public.luna4_order_terms where telegram_id=p_owner and order_id=o.id;
  if not found or t.catalog_version<>o.catalog_version or (t.snapshot->>'stars')::integer is distinct from o.stars or (t.snapshot->>'seeds')::integer is distinct from o.seeds or (t.snapshot->>'days')::integer is distinct from o.days or t.snapshot->>'product' is distinct from o.product then raise exception 'Original verified terms required';end if;
  if p_recurring or p_expires is not null then raise exception 'New access is prepaid, not recurring';end if;
  if o.days>0 or o.product='premium_lifetime' then
   select greatest(now(),case when isfinite(u.active_until) then u.active_until end,(select max(e.period_end) from public.luna30_entitlement_periods e where e.telegram_id=p_owner and e.revoked_at is null and e.period_end<>'infinity'::timestamptz)) into v_start from public.users u where u.telegram_id=p_owner;
   v_end:=case when o.product='premium_lifetime' then 'infinity'::timestamptz else v_start+make_interval(hours=>o.days*24) end;
  end if;
 elsif o.catalog_version='luna-4.3' and (o.days=7 or o.product='premium_lifetime') then
  if p_recurring or p_expires is not null then raise exception 'Prepaid access cannot recur';end if;
  v_start:=now();v_end:=case when o.product='premium_lifetime' then 'infinity'::timestamptz else v_start+interval '168 hours' end;
 elsif o.days=30 and o.catalog_version='luna-4.3' then
  if p_recurring or p_expires is not null then raise exception 'Luna 4.3 monthly access is prepaid, not recurring';end if;
  v_start:=now();v_end:=v_start+interval '720 hours';
 elsif o.days=30 then
  if p_expires is null or p_expires<o.accepted_at or p_expires>now()+interval '35 days' then raise exception 'Invalid subscription expiry';end if;
  v_end:=p_expires;v_start:=v_end-interval '720 hours';
  if exists(select 1 from public.luna30_entitlement_periods where telegram_id=p_owner and revoked_at is null and period_start<v_end and period_end>v_start) then raise exception 'Overlapping subscription receipt';end if;
 elsif o.days=365 then
  if p_recurring or p_expires is not null then raise exception 'Annual access is prepaid, not recurring';end if;
  v_start:=now();v_end:=v_start+interval '8760 hours';
 elsif p_recurring or p_expires is not null then raise exception 'Unexpected recurring receipt';end if;
 if o.days>0 or o.product='premium_lifetime' then
  insert into public.luna30_entitlement_periods(telegram_id,source_charge_id,period_start,period_end) values(p_owner,p_charge,v_start,v_end) returning id into v_period;
 end if;
 if o.seeds>0 then
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_owner::text,0));
  insert into public.moon_gardens(telegram_id) values(p_owner) on conflict do nothing;
  select * into strict g from public.moon_gardens where telegram_id=p_owner for update;
  insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_owner,'luna30:charge:'||encode(sha256(convert_to(p_charge,'UTF8')),'hex'),case when o.days>0 then 'premium_renewal' else 'stars_package' end,o.seeds,g.moon_seeds_available+o.seeds);
  update public.moon_gardens set moon_seeds_available=moon_seeds_available+o.seeds,moon_seeds_earned_total=moon_seeds_earned_total+o.seeds,updated_at=now() where telegram_id=p_owner;
 end if;
 insert into public.luna30_commercial_receipts(charge_id,telegram_id,order_id,stars,state,seeds_granted,period_id,subscription_expires_at) values(p_charge,p_owner,o.id,p_stars,'paid',o.seeds,v_period,p_expires);
 update public.luna30_commercial_orders set state='paid' where id=o.id;
 return jsonb_build_object('status','paid');
end $$;
revoke all on function public.luna4_prepare_order(bigint,uuid,text,integer),public.luna4_accept_order(bigint,uuid,integer,text),public.luna30_fulfill_order(bigint,uuid,text,integer,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.luna4_prepare_order(bigint,uuid,text,integer),public.luna4_accept_order(bigint,uuid,integer,text),public.luna30_fulfill_order(bigint,uuid,text,integer,timestamptz,boolean) to service_role;
notify pgrst,'reload schema';commit;
-- Rollback closes new preparation/acceptance only. Keep verified new receipt
-- fulfillment and immutable terms until every accepted invoice has settled.
