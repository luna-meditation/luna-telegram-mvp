-- Future commercial lifecycle only. All product approvals default OFF.
-- Does not rewrite users.active_until, lifetime_access, existing payments or balances.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create table if not exists public.luna30_commercial_orders(
 id uuid primary key default gen_random_uuid(),telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 request_id uuid not null,product text not null check(product in('premium_month','premium_year','seeds_100','seeds_300','seeds_700','seeds_1500','support')),
 stars integer not null check(stars between 1 and 10000),seeds integer not null default 0 check(seeds>=0),days integer not null default 0 check(days in(0,30,365)),
 catalog_version text not null default 'luna-3.0-proposed',state text not null default 'pending' check(state in('pending','accepted','paid','cancelled','failed')),
 checkout_query_id text unique,accepted_at timestamptz,created_at timestamptz not null default now(),unique(telegram_id,request_id),unique(telegram_id,id)
);
create table if not exists public.luna30_commercial_receipts(
 charge_id text primary key check(length(charge_id) between 1 and 512),telegram_id bigint not null,order_id uuid not null,
 stars integer not null check(stars>0),state text not null check(state in('paid','refunded','refund_review')),
 seeds_granted integer not null default 0 check(seeds_granted>=0),period_id uuid references public.luna30_entitlement_periods(id),
 subscription_expires_at timestamptz,cancelled_at timestamptz,created_at timestamptz not null default now(),refunded_at timestamptz,
 foreign key(telegram_id,order_id) references public.luna30_commercial_orders(telegram_id,id)
);
create index if not exists luna30_commercial_receipts_owner on public.luna30_commercial_receipts(telegram_id,created_at desc);
create unique index if not exists luna30_one_pending_subscription on public.luna30_commercial_orders(telegram_id) where days>0 and state in('pending','accepted');
alter table public.luna_seed_ledger drop constraint if exists luna_seed_ledger_kind_check;
alter table public.luna_seed_ledger add constraint luna_seed_ledger_kind_check check(kind in('meditation','breath','checkin','seven_days','reading_purchase','stars_package','referral','premium_renewal','refund'));
do $$declare t text;begin foreach t in array array['luna30_commercial_orders','luna30_commercial_receipts'] loop
 execute format('alter table public.%I enable row level security',t);execute format('alter table public.%I force row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);execute format('grant select,insert,update on public.%I to service_role',t);
end loop;end $$;
create or replace function public.luna30_prepare_order(p_owner bigint,p_request uuid,p_product text,p_expected integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.luna30_release_settings%rowtype;o public.luna30_commercial_orders%rowtype;v_stars integer;v_seeds integer:=0;v_days integer:=0;v_enabled boolean:=false;
begin
 select * into strict s from public.luna30_release_settings where id;
 if s.catalog_version<>'luna-3.0-proposed' then return jsonb_build_object('status','disabled');end if;
 case p_product
 when 'premium_month' then v_stars:=500;v_days:=30;v_seeds:=100;v_enabled:=s.premium_enabled;
 when 'premium_year' then v_stars:=3500;v_days:=365;v_enabled:=s.annual_enabled;
 when 'seeds_100' then v_stars:=100;v_seeds:=100;v_enabled:=s.seed_packages_enabled;
 when 'seeds_300' then v_stars:=270;v_seeds:=300;v_enabled:=s.seed_packages_enabled;
 when 'seeds_700' then v_stars:=590;v_seeds:=700;v_enabled:=s.seed_packages_enabled;
 when 'seeds_1500' then v_stars:=1190;v_seeds:=1500;v_enabled:=s.seed_packages_enabled;
 when 'support' then v_stars:=p_expected;v_enabled:=s.support_enabled;
 else raise exception 'Unknown product';end case;
 if not v_enabled then return jsonb_build_object('status','disabled');end if;
 if p_request is null or p_expected is null or p_expected not between 1 and 10000 or p_expected<>v_stars then return jsonb_build_object('status','price_changed');end if;
 -- Existing paid users must not be sold a duplicate subscription or lose rights.
 if v_days>0 and (exists(select 1 from public.users where telegram_id=p_owner and (lifetime_access or active_until>now())) or exists(select 1 from public.luna30_entitlement_periods where telegram_id=p_owner and revoked_at is null and period_end>now())) then return jsonb_build_object('status','already_premium');end if;
 if v_seeds>0 and not exists(select 1 from public.luna21_settings where id and wallet_enabled) then return jsonb_build_object('status','wallet_disabled');end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_order:'||p_owner::text,0));
 select * into o from public.luna30_commercial_orders where telegram_id=p_owner and request_id=p_request;
 if found then
  if o.product<>p_product or o.stars<>p_expected then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('status','duplicate','order',to_jsonb(o)-'telegram_id');
 end if;
 if v_days>0 and exists(select 1 from public.luna30_commercial_orders where telegram_id=p_owner and days>0 and state in('pending','accepted')) then return jsonb_build_object('status','pending_subscription');end if;
 insert into public.luna30_commercial_orders(telegram_id,request_id,product,stars,seeds,days) values(p_owner,p_request,p_product,v_stars,v_seeds,v_days) returning * into o;
 return jsonb_build_object('status','pending','order',to_jsonb(o)-'telegram_id');
end $$;
create or replace function public.luna30_accept_order(p_owner bigint,p_order uuid,p_stars integer,p_query text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare o public.luna30_commercial_orders%rowtype;s public.luna30_release_settings%rowtype;v_enabled boolean;
begin
 select * into strict s from public.luna30_release_settings where id;
 select * into o from public.luna30_commercial_orders where id=p_order and telegram_id=p_owner for update;
 if not found or o.stars is distinct from p_stars or o.catalog_version<>s.catalog_version or p_query is null or length(p_query) not between 1 and 512 then return false;end if;
 v_enabled:=case when o.product='premium_month' then s.premium_enabled when o.product='premium_year' then s.annual_enabled when o.product='support' then s.support_enabled else s.seed_packages_enabled end;
 if not v_enabled or o.state not in('pending','accepted') then return false;end if;
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
 if o.days=30 then
  if p_expires is null or p_expires<o.accepted_at or p_expires>now()+interval '35 days' then raise exception 'Invalid subscription expiry';end if;
  v_end:=p_expires;v_start:=v_end-interval '720 hours';
  if exists(select 1 from public.luna30_entitlement_periods where telegram_id=p_owner and revoked_at is null and period_start<v_end and period_end>v_start) then raise exception 'Overlapping subscription receipt';end if;
 elsif o.days=365 then
  if p_recurring or p_expires is not null then raise exception 'Annual access is prepaid, not recurring';end if;
  v_start:=now();v_end:=v_start+interval '8760 hours';
 elsif p_recurring or p_expires is not null then raise exception 'Unexpected recurring receipt';end if;
 if o.days>0 then
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
create or replace function public.luna30_record_refund(p_owner bigint,p_charge text,p_stars integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.luna30_commercial_receipts%rowtype;g public.moon_gardens%rowtype;v_review boolean:=false;
begin
 select * into strict r from public.luna30_commercial_receipts where telegram_id=p_owner and charge_id=p_charge for update;
 if r.stars is distinct from p_stars then raise exception 'Refund mismatch';end if;
 if r.state<>'paid' then return jsonb_build_object('status',r.state,'duplicate',true);end if;
 if r.period_id is not null then update public.luna30_entitlement_periods set revoked_at=now() where id=r.period_id and telegram_id=p_owner;end if;
 if r.seeds_granted>0 then
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_owner::text,0));
  select * into strict g from public.moon_gardens where telegram_id=p_owner for update;
  if g.moon_seeds_available<r.seeds_granted then v_review:=true;else
   insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_owner,'luna30:refund:'||encode(sha256(convert_to(p_charge,'UTF8')),'hex'),'refund',-r.seeds_granted,g.moon_seeds_available-r.seeds_granted);
   update public.moon_gardens set moon_seeds_available=moon_seeds_available-r.seeds_granted,updated_at=now() where telegram_id=p_owner;
  end if;
 end if;
 update public.luna30_commercial_receipts set state=case when v_review then 'refund_review' else 'refunded' end,refunded_at=now() where charge_id=p_charge;
 return jsonb_build_object('status',case when v_review then 'refund_review' else 'refunded' end);
end $$;
do $$declare f regprocedure;begin foreach f in array array['public.luna30_prepare_order(bigint,uuid,text,integer)'::regprocedure,'public.luna30_accept_order(bigint,uuid,integer,text)'::regprocedure,'public.luna30_fulfill_order(bigint,uuid,text,integer,timestamptz,boolean)'::regprocedure,'public.luna30_record_refund(bigint,text,integer)'::regprocedure] loop
 execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);
end loop;end $$;
create or replace function public.luna30_commercial_metrics()
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'ai',(select coalesce(jsonb_agg(x),'[]') from(select case when left(request_id,6)='astro:' then 'astrology' when request_id like 'tarot:%' then 'tarot' else 'conversation' end category,count(*) requests,coalesce(sum(input_tokens),0) input_tokens,coalesce(sum(output_tokens),0) output_tokens,coalesce(sum(estimated_cost),0) known_cost_usd,count(*) filter(where estimated_cost is null) unknown_cost_requests from public.ai_usage group by 1)x),
 'legacy_paid_stars',(select coalesce(sum(amount_stars),0) from public.payments where status='paid' and currency='XTR'),
 'new_paid_stars',(select coalesce(sum(stars),0) from public.luna30_commercial_receipts where state='paid'),
 'refund_stars',(select coalesce(sum(stars),0) from public.luna30_commercial_receipts where state in('refunded','refund_review')),
 'refunds_needing_review',(select count(*) from public.luna30_commercial_receipts where state='refund_review'),
 'active_new_periods',(select count(*) from public.luna30_entitlement_periods where revoked_at is null and period_start<=now() and period_end>now()),
 'seed_delta',(select coalesce(sum(delta),0) from public.luna_seed_ledger),
 'net_usd',null,'settlement_note','Actual developer settlement and tax data required; Stars are not a fixed USD revenue rate',
 'sales_flags',(select to_jsonb(s)-'id'-'updated_at' from public.luna30_release_settings s where id)
 );
$$;
revoke all on function public.luna30_commercial_metrics() from public,anon,authenticated;
grant execute on function public.luna30_commercial_metrics() to service_role;
commit;
-- Safe rollback: close every LUNA30 commercial gate, retain accepted orders,
-- fulfill verified receipts/refunds, never delete financial audit or old rights.
-- Spent/refunded Seeds enter refund_review; no negative balance or automatic debt.
