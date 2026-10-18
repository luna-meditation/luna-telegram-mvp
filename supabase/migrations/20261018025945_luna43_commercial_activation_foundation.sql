-- Luna 4.3 preparation only: does not activate sales, quotas or rewards.
-- Dependencies: existing Luna 3.4 orders/receipts/ledger + Admin 4.0 quota grants.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
-- New sales only. Stored amounts/durations and legacy invoice verification
-- remain unchanged, including accepted pre-release receipts.
alter table public.luna30_commercial_orders drop constraint if exists luna30_commercial_orders_product_check;
alter table public.luna30_commercial_orders add constraint luna30_commercial_orders_product_check check(product in('premium_week','premium_month','premium_year','premium_lifetime','seeds_100','seeds_300','seeds_700','seeds_1500','support'));
alter table public.luna30_commercial_orders drop constraint if exists luna30_commercial_orders_days_check;
alter table public.luna30_commercial_orders add constraint luna30_commercial_orders_days_check check(days in(0,7,30,365));
create unique index if not exists luna43_one_pending_premium on public.luna30_commercial_orders(telegram_id) where product like 'premium_%' and state in('pending','accepted');
alter table public.luna34_commercial_settings drop constraint if exists luna34_commercial_settings_catalog_check;
alter table public.luna34_commercial_settings add constraint luna34_commercial_settings_catalog_check check(catalog->>'version' in ('luna-3.4','luna-4.3'));
alter table public.luna34_commercial_settings add column if not exists catalog_revision integer not null default 0;

create or replace function public.luna34_prepare_order(p_owner bigint,p_request uuid,p_product text,p_expected integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;o public.luna30_commercial_orders%rowtype;v_stars integer;v_seeds integer:=0;v_days integer:=0;
begin
 select * into strict cfg from public.luna34_commercial_settings where id;
 if not(cfg.checkout_enabled and cfg.owner_approved and cfg.live_payment_verified) then return jsonb_build_object('status','disabled');end if;
 if p_request is null or p_expected is null or p_expected not between 1 and 10000 then return jsonb_build_object('status','invalid');end if;
 case p_product
 when 'premium_week' then if cfg.catalog->>'version'='luna-4.3' then v_stars:=(cfg.catalog#>>'{weekly,stars}')::integer;v_days:=7;end if;
 when 'premium_month' then v_stars:=(cfg.catalog#>>'{premium,monthlyStars}')::integer;v_days:=30;v_seeds:=100;
 when 'premium_year' then v_stars:=(cfg.catalog#>>'{annual,stars}')::integer;v_days:=365;
 when 'premium_lifetime' then if cfg.catalog->>'version'='luna-4.3' and (cfg.catalog#>>'{lifetime,onSale}')::boolean then v_stars:=(cfg.catalog#>>'{lifetime,stars}')::integer;end if;
 when 'support' then v_stars:=p_expected;
 else select (x->>'stars')::integer,(x->>'seeds')::integer into v_stars,v_seeds from jsonb_array_elements(cfg.catalog->'packages') x where x->>'id'=p_product;
 end case;
 if v_stars is null or v_stars<>p_expected then return jsonb_build_object('status','price_changed');end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_order:'||p_owner::text,0));
 select * into o from public.luna30_commercial_orders where telegram_id=p_owner and request_id=p_request;
 if found then
  if o.product<>p_product or o.stars<>p_expected or o.catalog_version<>cfg.catalog->>'version' then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('status','duplicate','order',to_jsonb(o)-'telegram_id');
 end if;
 if p_product like 'premium_%' and(exists(select 1 from public.users where telegram_id=p_owner and(lifetime_access or active_until>now())) or exists(select 1 from public.luna30_entitlement_periods where telegram_id=p_owner and revoked_at is null and period_end>now())) then return jsonb_build_object('status','already_premium');end if;
 if(v_seeds>0 or v_days>0) and not exists(select 1 from public.luna21_settings where id and wallet_enabled) then return jsonb_build_object('status','wallet_disabled');end if;
 if p_product like 'premium_%' and exists(select 1 from public.luna30_commercial_orders where telegram_id=p_owner and product like 'premium_%' and state in('pending','accepted')) then return jsonb_build_object('status','pending_subscription');end if;
 insert into public.luna30_commercial_orders(telegram_id,request_id,product,stars,seeds,days,catalog_version) values(p_owner,p_request,p_product,v_stars,v_seeds,v_days,cfg.catalog->>'version') returning * into o;
 return jsonb_build_object('status','pending','order',to_jsonb(o)-'telegram_id');
end $$;

create or replace function public.luna34_accept_order(p_owner bigint,p_order uuid,p_stars integer,p_query text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare o public.luna30_commercial_orders%rowtype;
begin
 if not exists(select 1 from public.luna34_commercial_settings where id and checkout_enabled and owner_approved and live_payment_verified) then return false;end if;
 select * into o from public.luna30_commercial_orders where telegram_id=p_owner and id=p_order for update;
 if not found or o.catalog_version not in ('luna-3.4','luna-4.3') or o.stars is distinct from p_stars or o.state not in('pending','accepted') or p_query is null or length(p_query) not between 1 and 512 then return false;end if;
 if o.checkout_query_id is not null then return o.checkout_query_id=p_query;end if;
 update public.luna30_commercial_orders set state='accepted',checkout_query_id=p_query,accepted_at=now() where id=o.id;return true;
end $$;

create or replace function public.luna30_fulfill_order(p_owner bigint,p_order uuid,p_charge text,p_stars integer,p_expires timestamptz default null,p_recurring boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.luna30_commercial_orders%rowtype;r public.luna30_commercial_receipts%rowtype;v_period uuid;v_start timestamptz;v_end timestamptz;g public.moon_gardens%rowtype;
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
 if o.catalog_version='luna-4.3' and (o.days=7 or o.product='premium_lifetime') then
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

-- Paid analyses use the same dollar ledger, but not a second ordinary reply.
create or replace function public.luna32_ai_used(p_owner bigint,p_exclude text default null)
returns integer language sql stable security invoker set search_path='' as $$
 select count(*)::integer from (
  select operation_key k from public.luna32_ai_operations where telegram_id=p_owner and request_day=(now() at time zone 'UTC')::date and state in ('processing','succeeded') and operation_key not like 'deep:%'
  union
  select case when client_request_id like 'astro\_%' escape '\' then 'report:'||substr(client_request_id,7) else 'chat:'||client_request_id end from public.ai_chat_requests where telegram_id=p_owner and quota_charged=true and created_at>=((now() at time zone 'UTC')::date at time zone 'UTC')
  union
  select 'tarot:'||client_reading_id::text from public.luna_tarot_readings where telegram_id=p_owner and(status='processing' or(status='ready' and interpretation is not null)) and created_at>=((now() at time zone 'UTC')::date at time zone 'UTC')
 ) used where p_exclude is null or used.k<>p_exclude
$$;

create or replace function public.luna34_allocate_period(p_owner bigint,p_period uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.luna30_entitlement_periods%rowtype;r public.luna30_commercial_receipts%rowtype;o public.luna30_commercial_orders%rowtype;g public.moon_gardens%rowtype;i integer;due timestamptz;awarded integer:=0;inserted boolean;
begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna34_allocation:'||p_owner::text,0));
 select * into e from public.luna30_entitlement_periods where telegram_id=p_owner and id=p_period and revoked_at is null;
 if not found then return jsonb_build_object('awarded',0);end if;
 select * into r from public.luna30_commercial_receipts where telegram_id=p_owner and period_id=e.id and state='paid' for update;
 if not found then return jsonb_build_object('awarded',0);end if;
 select * into strict o from public.luna30_commercial_orders where telegram_id=p_owner and id=r.order_id;
 if o.catalog_version not in ('luna-3.4','luna-4.3') or o.days not in(30,365) then return jsonb_build_object('awarded',0);end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_owner::text,0));
 insert into public.moon_gardens(telegram_id) values(p_owner) on conflict do nothing;
 select * into strict g from public.moon_gardens where telegram_id=p_owner for update;
 for i in 0..case when o.days=365 then 11 else 0 end loop
  due:=((e.period_start at time zone 'UTC')+make_interval(months=>i)) at time zone 'UTC';
  if due>=e.period_end or due>now() then exit;end if;
  insert into public.luna34_period_allocations(telegram_id,period_id,month_index,seeds,due_at) values(p_owner,e.id,i,100,due) on conflict do nothing;inserted:=found;
  if not inserted or(i=0 and r.seeds_granted>=100) then continue;end if;
  insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_owner,'luna34:allocation:'||e.id::text||':'||i::text,'premium_renewal',100,g.moon_seeds_available+100);
  update public.moon_gardens set moon_seeds_available=moon_seeds_available+100,moon_seeds_earned_total=moon_seeds_earned_total+100,updated_at=now() where telegram_id=p_owner returning * into g;
  awarded:=awarded+100;
 end loop;
 return jsonb_build_object('awarded',awarded);
end $$;

create or replace function public.luna34_claim_due_allocations(p_owner bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare period record;amount integer:=0;result jsonb;
begin
 for period in select e.id from public.luna30_entitlement_periods e join public.luna30_commercial_receipts r on r.period_id=e.id and r.telegram_id=e.telegram_id join public.luna30_commercial_orders o on o.id=r.order_id and o.telegram_id=r.telegram_id where e.telegram_id=p_owner and e.revoked_at is null and r.state='paid' and o.catalog_version in ('luna-3.4','luna-4.3') and e.period_start<=now() order by e.period_start loop
  result:=public.luna34_allocate_period(p_owner,period.id);amount:=amount+(result->>'awarded')::integer;
 end loop;return jsonb_build_object('awarded',amount);
end $$;

create table if not exists public.luna43_seed_purchases (
 id uuid primary key default gen_random_uuid(), telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 request_id uuid not null, request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
 product text not null check(product in ('ai_messages','deep_analysis')), seeds integer not null check(seeds>0),
 quantity integer not null check(quantity between 1 and 100), catalog_revision integer not null,
 parameters jsonb not null default '{}', state text not null check(state in ('entitled','processing','ready','failed_refunded')),
 lease uuid, result jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(telegram_id,request_id)
);
create index if not exists luna43_seed_purchases_owner_created on public.luna43_seed_purchases(telegram_id,created_at desc);
alter table public.luna43_seed_purchases enable row level security;
alter table public.luna43_seed_purchases force row level security;
revoke all on public.luna43_seed_purchases from public,anon,authenticated,service_role;
grant select,insert,update on public.luna43_seed_purchases to service_role;
alter table public.luna40_quota_grants add column if not exists purchase_id uuid unique references public.luna43_seed_purchases(id);
alter table public.luna_seed_ledger drop constraint if exists luna_seed_ledger_kind_check;
alter table public.luna_seed_ledger add constraint luna_seed_ledger_kind_check check(kind in ('meditation','breath','checkin','seven_days','reading_purchase','stars_package','referral','premium_renewal','refund','journal','ai_allowance_purchase','deep_analysis_purchase','admin_adjustment'));

-- Existing audited Admin adjustments join the same wallet journal atomically.
-- No retroactive balance rewrite or unrelated trigger/function replacement.
create or replace function public.luna43_journal_admin_adjustment()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after)
 values(new.telegram_id,'luna43:admin:'||new.request_id::text,'admin_adjustment',new.delta,new.balance_after);
 return new;
end $$;
revoke all on function public.luna43_journal_admin_adjustment() from public,anon,authenticated;
grant execute on function public.luna43_journal_admin_adjustment() to service_role;
drop trigger if exists luna43_admin_wallet_journal on public.luna40_wallet_adjustments;
create trigger luna43_admin_wallet_journal after insert on public.luna40_wallet_adjustments for each row execute function public.luna43_journal_admin_adjustment();

create or replace function public.luna43_purchase_seed_product(p_owner bigint,p_request uuid,p_hash text,p_product text,p_expected integer,p_revision integer,p_parameters jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype; prior public.luna43_seed_purchases%rowtype; row_value public.luna43_seed_purchases%rowtype; price integer; amount integer; enabled boolean; balance integer;
begin
 if coalesce(p_request is null or p_hash !~ '^[a-f0-9]{64}$' or p_product not in ('ai_messages','deep_analysis') or p_expected is null or p_expected<1 or p_revision is null or p_parameters is null or jsonb_typeof(p_parameters)<>'object' or octet_length(p_parameters::text)>16000,true) then raise exception 'Invalid purchase' using errcode='22023';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_owner::text,0));
 select * into prior from public.luna43_seed_purchases where telegram_id=p_owner and request_id=p_request;
 if found then if prior.request_hash<>p_hash then raise exception 'Purchase identity conflict' using errcode='23505';end if;return jsonb_build_object('status','duplicate','purchase',to_jsonb(prior)-'telegram_id'-'request_hash');end if;
 select * into strict cfg from public.luna34_commercial_settings where id;
 if not(cfg.checkout_enabled and cfg.owner_approved and cfg.live_payment_verified) or cfg.catalog->>'version'<>'luna-4.3' or not exists(select 1 from public.luna21_settings where id and wallet_enabled) then return jsonb_build_object('status','disabled');end if;
 if p_revision<>cfg.catalog_revision then return jsonb_build_object('status','price_changed');end if;
 if p_product='ai_messages' then price:=(cfg.catalog#>>'{seedProducts,aiMessages,seeds}')::integer;amount:=(cfg.catalog#>>'{seedProducts,aiMessages,quantity}')::integer;enabled:=(cfg.catalog#>>'{seedProducts,aiMessages,enabled}')::boolean;
 else price:=(cfg.catalog#>>'{seedProducts,deepAnalysis,seeds}')::integer;amount:=1;enabled:=(cfg.catalog#>>'{seedProducts,deepAnalysis,enabled}')::boolean;end if;
 if enabled is distinct from true then return jsonb_build_object('status','disabled');end if;
 if price is null or price not between 1 and 10000 or amount is null or amount not between 1 and 100 or price<>p_expected then return jsonb_build_object('status','price_changed');end if;
 select moon_seeds_available into balance from public.moon_gardens where telegram_id=p_owner for update;
 if not found or balance<price then return jsonb_build_object('status','insufficient');end if;
 insert into public.luna43_seed_purchases(telegram_id,request_id,request_hash,product,seeds,quantity,catalog_revision,parameters,state) values(p_owner,p_request,p_hash,p_product,price,amount,cfg.catalog_revision,p_parameters,'entitled') returning * into row_value;
 insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_owner,'luna43:purchase:'||row_value.id::text,case when p_product='ai_messages' then 'ai_allowance_purchase' else 'deep_analysis_purchase' end,-price,balance-price);
 update public.moon_gardens set moon_seeds_available=balance-price,updated_at=now() where telegram_id=p_owner;
 if p_product='ai_messages' then
  insert into public.luna40_quota_grants(telegram_id,quantity,expires_at,actor,reason,purchase_id) values(p_owner,amount,'infinity'::timestamptz,p_owner,'Purchased standard AI messages',row_value.id);
  update public.luna43_seed_purchases set state='ready',result=jsonb_build_object('quantity',amount,'expiresAt',null),updated_at=now() where id=row_value.id returning * into row_value;
 end if;
 return jsonb_build_object('status','purchased','balance',balance-price,'purchase',to_jsonb(row_value)-'telegram_id'-'request_hash');
end $$;

create or replace function public.luna43_claim_deep_analysis(p_owner bigint,p_purchase uuid,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.luna43_seed_purchases%rowtype;
begin
 if p_lease is null then raise exception 'Missing lease' using errcode='22023';end if;
 select * into p from public.luna43_seed_purchases where id=p_purchase and telegram_id=p_owner and product='deep_analysis' for update;
 if not found then return jsonb_build_object('status','not_found');end if;
 if p.state<>'entitled' then return jsonb_build_object('status',p.state,'purchase',to_jsonb(p)-'telegram_id'-'request_hash');end if;
 update public.luna43_seed_purchases set state='processing',lease=p_lease,updated_at=now() where id=p.id returning * into p;
 return jsonb_build_object('status','claimed','purchase',to_jsonb(p)-'telegram_id'-'request_hash');
end $$;

create or replace function public.luna43_finish_deep_analysis(p_owner bigint,p_purchase uuid,p_lease uuid,p_result jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare p public.luna43_seed_purchases%rowtype; balance integer;
begin
 -- Always wallet → purchase lock order, identical to purchase and refund.
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_owner::text,0));
 select * into p from public.luna43_seed_purchases where id=p_purchase and telegram_id=p_owner and product='deep_analysis' for update;
 if not found or p.state<>'processing' or p.lease is distinct from p_lease then return false;end if;
 if p_result is null then
  select moon_seeds_available into strict balance from public.moon_gardens where telegram_id=p_owner for update;
  insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_owner,'luna43:deep_refund:'||p.id::text,'refund',p.seeds,balance+p.seeds);
  update public.moon_gardens set moon_seeds_available=balance+p.seeds,updated_at=now() where telegram_id=p_owner;
  update public.luna43_seed_purchases set state='failed_refunded',updated_at=now() where id=p.id;
 else
  if jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>30000 then raise exception 'Invalid result' using errcode='22023';end if;
  update public.luna43_seed_purchases set state='ready',result=p_result,updated_at=now() where id=p.id;
 end if;return true;
end $$;

create or replace function public.luna43_update_seed_catalog(p_actor bigint,p_request uuid,p_expected integer,p_body jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype; prior public.luna40_admin_audit%rowtype; result_value jsonb;
begin
 if coalesce(p_actor is null or p_actor<=0 or p_request is null or p_expected is null or p_reason is null or length(btrim(p_reason)) not between 3 and 500 or p_body is null or jsonb_typeof(p_body)<>'object' or p_body-'aiMessages'-'deepAnalysis'<>'{}'::jsonb or not(p_body ?& array['aiMessages','deepAnalysis']) or (p_body->'aiMessages')-'seeds'-'quantity'-'enabled'<>'{}'::jsonb or (p_body->'deepAnalysis')-'seeds'-'enabled'<>'{}'::jsonb or (p_body#>>'{aiMessages,seeds}')::integer not between 1 and 10000 or (p_body#>>'{aiMessages,quantity}')::integer not between 1 and 100 or (p_body#>>'{deepAnalysis,seeds}')::integer not between 1 and 10000 or jsonb_typeof(p_body#>'{aiMessages,enabled}')<>'boolean' or jsonb_typeof(p_body#>'{deepAnalysis,enabled}')<>'boolean',true) then raise exception 'Invalid catalog' using errcode='22023';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna43_catalog:'||p_actor::text||':'||p_request::text,0));
 select * into prior from public.luna40_admin_audit where actor=p_actor and request_id=p_request;
 if found then if prior.action<>'catalog.seed_products.update' or prior.input<>p_body or prior.reason<>p_reason then raise exception 'Catalog identity conflict' using errcode='23505';end if;return prior.result;end if;
 select * into strict cfg from public.luna34_commercial_settings where id for update;
 if cfg.catalog->>'version'<>'luna-4.3' or cfg.catalog_revision<>p_expected then raise exception 'Catalog changed' using errcode='PT409';end if;
 update public.luna34_commercial_settings set catalog=jsonb_set(catalog,'{seedProducts}',p_body),catalog_revision=catalog_revision+1,updated_at=now() where id;
 result_value:=jsonb_build_object('seedProducts',p_body,'revision',p_expected+1);
 insert into public.luna40_admin_audit(actor,request_id,action,reason,input,previous,result) values(p_actor,p_request,'catalog.seed_products.update',p_reason,p_body,cfg.catalog->'seedProducts',result_value);
 return result_value;
end $$;
revoke all on function public.luna43_purchase_seed_product(bigint,uuid,text,text,integer,integer,jsonb),public.luna43_claim_deep_analysis(bigint,uuid,uuid),public.luna43_finish_deep_analysis(bigint,uuid,uuid,jsonb),public.luna43_update_seed_catalog(bigint,uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.luna43_purchase_seed_product(bigint,uuid,text,text,integer,integer,jsonb),public.luna43_claim_deep_analysis(bigint,uuid,uuid),public.luna43_finish_deep_analysis(bigint,uuid,uuid,jsonb),public.luna43_update_seed_catalog(bigint,uuid,integer,jsonb,text) to service_role;
create or replace function public.luna40_reserve_ai_attempt(p_owner bigint,p_operation text,p_lease uuid,p_call integer,p_attempt uuid,p_model text,p_ceiling bigint,p_limit integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare used integer; selected_grant uuid; held public.luna40_quota_uses%rowtype; result_value jsonb;begin
 perform pg_advisory_xact_lock(3272001);
 if p_limit is null or p_limit not between 1 and 500 then raise exception 'Invalid base limit' using errcode='22023';end if;
 used:=public.luna32_ai_used(p_owner,p_operation);
 if used<p_limit then return public.luna32_reserve_ai_attempt(p_owner,p_operation,p_lease,p_call,p_attempt,p_model,p_ceiling,p_limit);end if;
 if used>=500 then return jsonb_build_object('status','daily_limit');end if;
 select * into held from public.luna40_quota_uses where telegram_id=p_owner and operation_key=p_operation;
 if found and held.state='held' and held.lease=p_lease then selected_grant:=held.grant_id;
 else
  select g.id into selected_grant from public.luna40_quota_grants g where g.telegram_id=p_owner and g.revoked_at is null and g.expires_at>now() and (g.purchase_id is null or p_operation like 'chat:%') and g.quantity>(select count(*) from public.luna40_quota_uses u where u.grant_id=g.id and u.state in ('held','consumed')) order by g.expires_at,g.id limit 1 for update;
 end if;
 if selected_grant is null then return jsonb_build_object('status','daily_limit');end if;
 result_value:=public.luna32_reserve_ai_attempt(p_owner,p_operation,p_lease,p_call,p_attempt,p_model,p_ceiling,used+1);
 if result_value->>'status'='reserved' then
  insert into public.luna40_quota_uses(telegram_id,operation_key,grant_id,lease,state) values(p_owner,p_operation,selected_grant,p_lease,'held') on conflict(telegram_id,operation_key) do update set grant_id=excluded.grant_id,lease=excluded.lease,state='held';
 end if;return result_value;
end;$$;
commit;
-- Fix-forward rollback: close checkout/seed products/referrals and retain all
-- accepted orders, paid rights, grants and ledger. Never restore old code over
-- new paid data or reverse legitimate purchases by deleting records.
