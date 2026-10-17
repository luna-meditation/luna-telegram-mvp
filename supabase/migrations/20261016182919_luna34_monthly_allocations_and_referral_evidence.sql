-- Additive future commerce/referral paths. No activation, historical balance
-- reconstruction, user rewrite, scheduling or external payment on migration.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create table if not exists public.luna34_period_allocations(
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 period_id uuid not null references public.luna30_entitlement_periods(id),month_index integer not null check(month_index between 0 and 11),
 seeds integer not null check(seeds=100),due_at timestamptz not null,created_at timestamptz not null default now(),
 primary key(period_id,month_index)
);
create index if not exists luna34_period_allocations_owner on public.luna34_period_allocations(telegram_id,created_at);
create table if not exists public.luna34_referral_onboarding(
 telegram_id bigint primary key references public.users(telegram_id) on delete cascade,completed_at timestamptz not null default now()
);
alter table public.luna30_referrals add column if not exists qualification_kind text check(qualification_kind in('meditation','breath','tarot'));
alter table public.luna30_referrals add column if not exists qualification_id uuid;
do $$declare t text;begin foreach t in array array['luna34_period_allocations','luna34_referral_onboarding'] loop
 execute format('alter table public.%I enable row level security',t);execute format('alter table public.%I force row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);execute format('grant select,insert on public.%I to service_role',t);
end loop;end $$;

create or replace function public.luna34_prepare_order(p_owner bigint,p_request uuid,p_product text,p_expected integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;o public.luna30_commercial_orders%rowtype;v_stars integer;v_seeds integer:=0;v_days integer:=0;
begin
 select * into strict cfg from public.luna34_commercial_settings where id;
 if not(cfg.checkout_enabled and cfg.owner_approved and cfg.live_payment_verified) then return jsonb_build_object('status','disabled');end if;
 if p_request is null or p_expected is null or p_expected not between 1 and 10000 then return jsonb_build_object('status','invalid');end if;
 case p_product
 when 'premium_month' then v_stars:=(cfg.catalog#>>'{premium,monthlyStars}')::integer;v_days:=30;v_seeds:=100;
 when 'premium_year' then v_stars:=(cfg.catalog#>>'{annual,stars}')::integer;v_days:=365;
 when 'support' then v_stars:=p_expected;
 else select (x->>'stars')::integer,(x->>'seeds')::integer into v_stars,v_seeds from jsonb_array_elements(cfg.catalog->'packages') x where x->>'id'=p_product;
 end case;
 if v_stars is null or v_stars<>p_expected then return jsonb_build_object('status','price_changed');end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_order:'||p_owner::text,0));
 select * into o from public.luna30_commercial_orders where telegram_id=p_owner and request_id=p_request;
 if found then
  if o.product<>p_product or o.stars<>p_expected or o.catalog_version<>'luna-3.4' then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('status','duplicate','order',to_jsonb(o)-'telegram_id');
 end if;
 if v_days>0 and(exists(select 1 from public.users where telegram_id=p_owner and(lifetime_access or active_until>now())) or exists(select 1 from public.luna30_entitlement_periods where telegram_id=p_owner and revoked_at is null and period_end>now())) then return jsonb_build_object('status','already_premium');end if;
 if(v_seeds>0 or v_days>0) and not exists(select 1 from public.luna21_settings where id and wallet_enabled) then return jsonb_build_object('status','wallet_disabled');end if;
 if v_days>0 and exists(select 1 from public.luna30_commercial_orders where telegram_id=p_owner and days>0 and state in('pending','accepted')) then return jsonb_build_object('status','pending_subscription');end if;
 insert into public.luna30_commercial_orders(telegram_id,request_id,product,stars,seeds,days,catalog_version) values(p_owner,p_request,p_product,v_stars,v_seeds,v_days,'luna-3.4') returning * into o;
 return jsonb_build_object('status','pending','order',to_jsonb(o)-'telegram_id');
end $$;
create or replace function public.luna34_accept_order(p_owner bigint,p_order uuid,p_stars integer,p_query text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare o public.luna30_commercial_orders%rowtype;
begin
 if not exists(select 1 from public.luna34_commercial_settings where id and checkout_enabled and owner_approved and live_payment_verified) then return false;end if;
 select * into o from public.luna30_commercial_orders where telegram_id=p_owner and id=p_order for update;
 if not found or o.catalog_version<>'luna-3.4' or o.stars is distinct from p_stars or o.state not in('pending','accepted') or p_query is null or length(p_query) not between 1 and 512 then return false;end if;
 if o.checkout_query_id is not null then return o.checkout_query_id=p_query;end if;
 update public.luna30_commercial_orders set state='accepted',checkout_query_id=p_query,accepted_at=now() where id=o.id;return true;
end $$;

-- Only real new-catalog paid receipts accrue. Closing future sales never
-- revokes an already paid allocation. No old/Lifetime account gets a backfill.
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
 if o.catalog_version<>'luna-3.4' or o.days not in(30,365) then return jsonb_build_object('awarded',0);end if;
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
 for period in select e.id from public.luna30_entitlement_periods e join public.luna30_commercial_receipts r on r.period_id=e.id and r.telegram_id=e.telegram_id join public.luna30_commercial_orders o on o.id=r.order_id and o.telegram_id=r.telegram_id where e.telegram_id=p_owner and e.revoked_at is null and r.state='paid' and o.catalog_version='luna-3.4' and e.period_start<=now() order by e.period_start loop
  result:=public.luna34_allocate_period(p_owner,period.id);amount:=amount+(result->>'awarded')::integer;
 end loop;return jsonb_build_object('awarded',amount);
end $$;
create or replace function public.luna34_fulfill_order(p_owner bigint,p_order uuid,p_charge text,p_stars integer,p_expires timestamptz default null,p_recurring boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;period uuid;
begin
 -- Existing accepted invoices/receipts retain their exact immutable amounts.
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna34_allocation:'||p_owner::text,0));
 result:=public.luna30_fulfill_order(p_owner,p_order,p_charge,p_stars,p_expires,p_recurring);
 select period_id into period from public.luna30_commercial_receipts where telegram_id=p_owner and order_id=p_order and charge_id=p_charge and state='paid';
 if period is not null then perform public.luna34_allocate_period(p_owner,period);end if;
 return result;
end $$;

create or replace function public.luna34_record_refund(p_owner bigint,p_charge text,p_stars integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.luna30_commercial_receipts%rowtype;g public.moon_gardens%rowtype;recover integer;review boolean:=false;
begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna34_allocation:'||p_owner::text,0));
 select * into strict r from public.luna30_commercial_receipts where telegram_id=p_owner and charge_id=p_charge for update;
 if r.stars is distinct from p_stars then raise exception 'Refund mismatch';end if;
 if r.state<>'paid' then return jsonb_build_object('status',r.state,'duplicate',true);end if;
 recover:=r.seeds_granted+coalesce((select sum(seeds) from public.luna34_period_allocations where telegram_id=p_owner and period_id=r.period_id and not(month_index=0 and r.seeds_granted>=100)),0);
 if r.period_id is not null then update public.luna30_entitlement_periods set revoked_at=now() where id=r.period_id and telegram_id=p_owner;end if;
 if recover>0 then
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_owner::text,0));select * into strict g from public.moon_gardens where telegram_id=p_owner for update;
  if g.moon_seeds_available<recover then review:=true;else
   insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_owner,'luna30:refund:'||encode(sha256(convert_to(p_charge,'UTF8')),'hex'),'refund',-recover,g.moon_seeds_available-recover);
   update public.moon_gardens set moon_seeds_available=moon_seeds_available-recover,updated_at=now() where telegram_id=p_owner;
  end if;
 end if;
 update public.luna30_commercial_receipts set state=case when review then 'refund_review' else 'refunded' end,refunded_at=now() where charge_id=p_charge;
 return jsonb_build_object('status',case when review then 'refund_review' else 'refunded' end,'seeds_requiring_reconciliation',recover);
end $$;

create or replace function public.luna34_attribute_referral(p_owner bigint,p_signed_code text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare inviter bigint;created timestamptz;
begin
 if not exists(select 1 from public.luna34_commercial_settings where id and referrals_enabled and owner_approved) then return jsonb_build_object('status','disabled');end if;
 if p_signed_code is null or p_signed_code !~ '^[A-Za-z0-9_-]{24}$' then return jsonb_build_object('status','invalid');end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_referee:'||p_owner::text,0));
 if exists(select 1 from public.luna30_referrals where referee_id=p_owner) then return jsonb_build_object('status','already_attributed');end if;
 select telegram_id into inviter from public.luna30_referral_codes where code=p_signed_code and disabled_at is null;
 if inviter is null or inviter=p_owner then return jsonb_build_object('status','invalid');end if;
 select created_at into created from public.users where telegram_id=p_owner;
 if created is null or created<now()-interval '10 minutes' or exists(select 1 from public.playback_sessions where telegram_id=p_owner and completed_at is not null) or exists(select 1 from public.luna_breath_proofs where telegram_id=p_owner and completed_at is not null) or exists(select 1 from public.luna_tarot_readings where telegram_id=p_owner) or exists(select 1 from public.ai_conversations where telegram_id=p_owner) or exists(select 1 from public.daily_checkins where telegram_id=p_owner) then return jsonb_build_object('status','not_new');end if;
 insert into public.luna30_referrals(referee_id,referrer_id) values(p_owner,inviter) on conflict do nothing;return jsonb_build_object('status','pending');
end $$;
create or replace function public.luna34_qualify_referral(p_owner bigint,p_kind text,p_evidence uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;r public.luna30_referrals%rowtype;completed timestamptz;g public.moon_gardens%rowtype;monthly integer;
begin
 select * into strict cfg from public.luna34_commercial_settings where id;
 if not(cfg.referrals_enabled and cfg.owner_approved) then return jsonb_build_object('status','disabled','awarded',0);end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_referee:'||p_owner::text,0));
 select * into r from public.luna30_referrals where referee_id=p_owner for update;
 if not found then return jsonb_build_object('status','not_attributed','awarded',0);end if;
 if r.state<>'pending' then return jsonb_build_object('status',r.state,'awarded',0,'duplicate',true);end if;
 if not exists(select 1 from public.luna34_referral_onboarding where telegram_id=p_owner) then return jsonb_build_object('status','onboarding_required','awarded',0);end if;
 if p_kind='meditation' then
  select p.completed_at into completed from public.playback_sessions p join public.meditations m on m.id=p.meditation_id where p.id=p_evidence and p.telegram_id=p_owner and p.completed_at is not null and p.started_at>=r.created_at and m.duration>=60 and p.listened_seconds>=ceil(m.duration*.9) and p.completed_at-p.started_at>=make_interval(secs=>ceil(m.duration*.9)::integer);
 elsif p_kind='breath' then
  select completed_at into completed from public.luna_breath_proofs where id=p_evidence and telegram_id=p_owner and started_at>=r.created_at and completed_at is not null and verified_seconds>=ceil(duration_seconds*.9) and completed_at-started_at>=make_interval(secs=>ceil(duration_seconds*.9)::integer);
 elsif p_kind='tarot' then
  select e.created_at into completed from public.luna34_progress_events e join public.luna_tarot_readings t on t.id=e.entity_id and t.telegram_id=e.telegram_id where e.telegram_id=p_owner and e.entity_id=p_evidence and e.kind='reading_reveal' and e.detail='complete' and t.created_at>=r.created_at and t.status in('local','ready','fallback') limit 1;
 else raise exception 'Unsupported qualification';end if;
 if completed is null then return jsonb_build_object('status','unverified','awarded',0);end if;
 update public.luna30_referrals set state='qualified',qualified_at=completed,qualification_kind=p_kind,qualification_id=p_evidence,source_session_id=case when p_kind='meditation' then p_evidence else null end where referee_id=p_owner;
 -- Off means zero, including on a later retry after activation: no retro mint.
 if not cfg.rewards_enabled or not cfg.live_payment_verified or not cfg.checkout_enabled or not exists(select 1 from public.luna21_settings where id and wallet_enabled) then return jsonb_build_object('status','qualified','awarded',0);end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_referrer:'||r.referrer_id::text,0));
 select count(*) into monthly from public.luna30_referrals where referrer_id=r.referrer_id and state='rewarded' and rewarded_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' and rewarded_at<(date_trunc('month',now() at time zone 'UTC')+interval '1 month') at time zone 'UTC';
 if monthly>=5 then update public.luna30_referrals set state='limited' where referee_id=p_owner;return jsonb_build_object('status','monthly_limit','awarded',0);end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||least(p_owner,r.referrer_id)::text,0));perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||greatest(p_owner,r.referrer_id)::text,0));
 insert into public.moon_gardens(telegram_id) values(p_owner),(r.referrer_id) on conflict do nothing;perform 1 from public.moon_gardens where telegram_id in(p_owner,r.referrer_id) order by telegram_id for update;
 select * into strict g from public.moon_gardens where telegram_id=p_owner;
 insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_owner,'referral:new:'||p_owner::text,'referral',20,g.moon_seeds_available+20);update public.moon_gardens set moon_seeds_available=moon_seeds_available+20,moon_seeds_earned_total=moon_seeds_earned_total+20,updated_at=now() where telegram_id=p_owner;
 select * into strict g from public.moon_gardens where telegram_id=r.referrer_id;
 insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(r.referrer_id,'referral:invited:'||p_owner::text,'referral',30,g.moon_seeds_available+30);update public.moon_gardens set moon_seeds_available=moon_seeds_available+30,moon_seeds_earned_total=moon_seeds_earned_total+30,updated_at=now() where telegram_id=r.referrer_id;
 update public.luna30_referrals set state='rewarded',rewarded_at=now() where referee_id=p_owner;return jsonb_build_object('status','rewarded','awarded',20,'inviterAwarded',30);
end $$;
do $$declare f regprocedure;begin foreach f in array array[
 'public.luna34_prepare_order(bigint,uuid,text,integer)'::regprocedure,'public.luna34_accept_order(bigint,uuid,integer,text)'::regprocedure,
 'public.luna34_allocate_period(bigint,uuid)'::regprocedure,'public.luna34_claim_due_allocations(bigint)'::regprocedure,
 'public.luna34_fulfill_order(bigint,uuid,text,integer,timestamptz,boolean)'::regprocedure,'public.luna34_record_refund(bigint,text,integer)'::regprocedure,
 'public.luna34_attribute_referral(bigint,text)'::regprocedure,'public.luna34_qualify_referral(bigint,text,uuid)'::regprocedure] loop
 execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);
end loop;end $$;
notify pgrst,'reload schema';commit;
-- Rollback: close new checkout/referrals/rewards/quota settings and matching env
-- flags. Keep paid rights, verified receipts and earned allocations. No drops,
-- financial row deletion, reset, or stale balance restoration.
