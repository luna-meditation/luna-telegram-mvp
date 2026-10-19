-- New invitations only; existing 30/20 promises stay intact. No reward,
-- payment, catalog, flag, or historical balance is changed by this migration.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create table if not exists public.luna4_referral_terms(
 referee_id bigint primary key references public.users(telegram_id) on delete cascade,
 referrer_id bigint not null references public.users(telegram_id) on delete cascade,
 catalog_version text not null,catalog_revision integer not null,
 invitee_seeds integer not null check(invitee_seeds between 0 and 10000),
 inviter_seeds integer not null check(inviter_seeds between 0 and 10000),
 purchase_seeds integer not null check(purchase_seeds between 0 and 10000),
 created_at timestamptz not null default now(),check(referee_id<>referrer_id)
);
create table if not exists public.luna4_referral_claims(
 claim_token text primary key check(claim_token ~ '^[a-f0-9]{64}$'),
 kind text not null check(kind in('qualified','first_purchase')),catalog_version text not null,
 seeds integer not null check(seeds between 0 and 20000),source_hash text check(source_hash is null or source_hash ~ '^[a-f0-9]{64}$'),
 ledger_id uuid references public.luna_seed_ledger(id) on delete set null,
 status text not null default 'awarded' check(status in('awarded','refund_review')),
 created_at timestamptz not null default now()
);
alter table public.luna4_referral_terms enable row level security;alter table public.luna4_referral_terms force row level security;
alter table public.luna4_referral_claims enable row level security;alter table public.luna4_referral_claims force row level security;
revoke all on public.luna4_referral_terms,public.luna4_referral_claims from public,anon,authenticated,service_role;
grant select,insert on public.luna4_referral_terms,public.luna4_referral_claims to service_role;
grant update(status) on public.luna4_referral_claims to service_role;
alter table public.luna_reading_orders add column if not exists verified_paid_at timestamptz;
create or replace function public.luna4_stamp_reading_payment()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if old.verified_paid_at is not null then new.verified_paid_at:=old.verified_paid_at;return new;end if;
  if old.telegram_charge_id is not null then new.verified_paid_at:=null;return new;end if;
 end if;
 if new.currency='XTR' and new.telegram_charge_id is not null and new.status in('entitled','consumed') then new.verified_paid_at:=now();
 else new.verified_paid_at:=null;end if;
 return new;
end $$;
revoke all on function public.luna4_stamp_reading_payment() from public,anon,authenticated;grant execute on function public.luna4_stamp_reading_payment() to service_role;
drop trigger if exists luna4_verified_reading_payment on public.luna_reading_orders;
create trigger luna4_verified_reading_payment before insert or update on public.luna_reading_orders for each row execute function public.luna4_stamp_reading_payment();

create or replace function public.luna4_capture_referral_terms(p_owner bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;r public.luna30_referrals%rowtype;t public.luna4_referral_terms%rowtype;created timestamptz;
begin
 select * into strict cfg from public.luna34_commercial_settings where id;
 if cfg.catalog->>'version'<>'luna-4.0-completion-v1' then return jsonb_build_object('status','legacy');end if;
 if not(cfg.referrals_enabled and cfg.owner_approved and cfg.luna4_activation_verified) or cfg.luna4_cutover_at is null or cfg.luna4_cutover_at>now() or not public.luna4_valid_economy_catalog(cfg.catalog) then return jsonb_build_object('status','disabled');end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_referee:'||p_owner::text,0));
 select * into r from public.luna30_referrals where referee_id=p_owner for update;
 if not found then return jsonb_build_object('status','not_attributed');end if;
 select created_at into strict created from public.users where telegram_id=p_owner;
 if r.created_at<cfg.luna4_cutover_at or created<cfg.luna4_cutover_at then return jsonb_build_object('status','legacy');end if;
 select * into t from public.luna4_referral_terms where referee_id=p_owner;
 if found then if t.referrer_id<>r.referrer_id then raise exception 'Original referral identity mismatch';end if;return jsonb_build_object('status','saved');end if;
 insert into public.luna4_referral_terms(referee_id,referrer_id,catalog_version,catalog_revision,invitee_seeds,inviter_seeds,purchase_seeds)
 values(p_owner,r.referrer_id,cfg.catalog->>'version',cfg.catalog_revision,(cfg.catalog#>>'{rewards,referralInvitee}')::integer,(cfg.catalog#>>'{rewards,referralInviter}')::integer,(cfg.catalog#>>'{rewards,referralFirstPurchase}')::integer);
 return jsonb_build_object('status','saved');
end $$;
create or replace function public.luna4_attribute_referral(p_owner bigint,p_signed_code text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;result_value jsonb;
begin
 select * into strict cfg from public.luna34_commercial_settings where id;
 if cfg.catalog->>'version'='luna-4.0-completion-v1' and not(cfg.luna4_activation_verified and cfg.luna4_cutover_at<=now()) then return jsonb_build_object('status','disabled');end if;
 result_value:=public.luna34_attribute_referral(p_owner,p_signed_code);
 if result_value->>'status' in('pending','already_attributed') then perform public.luna4_capture_referral_terms(p_owner);end if;
 return result_value;
end $$;

create or replace function public.luna4_reward_referral_purchase(p_owner bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;r public.luna30_referrals%rowtype;t public.luna4_referral_terms%rowtype;
 token text;c public.luna4_referral_claims%rowtype;first_payment record;balance_value integer;ledger_value uuid;
begin
 select * into strict cfg from public.luna34_commercial_settings where id;
 if cfg.catalog->>'version'<>'luna-4.0-completion-v1' or not(cfg.luna4_activation_verified and cfg.referrals_enabled and cfg.rewards_enabled and cfg.owner_approved and cfg.live_payment_verified and cfg.checkout_enabled) or cfg.luna4_cutover_at is null or cfg.luna4_cutover_at>now() or not public.luna4_valid_economy_catalog(cfg.catalog) or not exists(select 1 from public.luna21_settings where id and wallet_enabled) then return jsonb_build_object('status','disabled','awarded',0);end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_referee:'||p_owner::text,0));
 select * into r from public.luna30_referrals where referee_id=p_owner for update;
 select * into t from public.luna4_referral_terms where referee_id=p_owner;
 if r.referee_id is null or r.state<>'rewarded' or t.referee_id is null or t.referrer_id<>r.referrer_id then return jsonb_build_object('status','not_qualified','awarded',0);end if;
 select encode(extensions.hmac(convert_to('luna4-referral-purchase:'||p_owner::text,'UTF8'),secret,'sha256'),'hex') into strict token from public.luna4_reward_identity where id;
 select * into c from public.luna4_referral_claims where claim_token=token;
 -- Actual immutable paid timestamps, not invoice creation/SDK callbacks, Seed
 -- spending or an AI claim. Refunded first receipts cannot become a new first.
 select * into first_payment from(
  select 'commerce:'||x.charge_id as source,x.created_at as paid_at,x.state='paid' as paid from public.luna30_commercial_receipts x join public.luna30_commercial_orders o on o.id=x.order_id and o.telegram_id=x.telegram_id where x.telegram_id=p_owner and x.stars>0 and o.product<>'support'
  union all select 'legacy:'||p.telegram_payment_charge_id,p.created_at,p.status='paid' from public.payments p where p.telegram_id=p_owner and p.currency='XTR' and p.amount_stars>0 and p.telegram_payment_charge_id is not null and p.status in('paid','refunded')
  union all select 'reading:'||o.telegram_charge_id,o.verified_paid_at,o.status in('entitled','consumed') from public.luna_reading_orders o where o.telegram_id=p_owner and o.currency='XTR' and o.telegram_charge_id is not null and o.verified_paid_at is not null and o.checkout_accepted_at is not null and o.amount>0
 ) verified order by paid_at,source limit 1;
 if c.claim_token is not null then
  if not found or not first_payment.paid or encode(sha256(convert_to(first_payment.source,'UTF8')),'hex') is distinct from c.source_hash then update public.luna4_referral_claims set status='refund_review' where claim_token=token;return jsonb_build_object('status','refund_review','awarded',0);end if;
  return jsonb_build_object('status','duplicate','awarded',0);
 end if;
 if not found or not first_payment.paid or first_payment.paid_at<r.created_at or first_payment.paid_at<cfg.luna4_cutover_at then return jsonb_build_object('status','no_first_verified_purchase','awarded',0);end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_referrer:'||r.referrer_id::text,0));
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||r.referrer_id::text,0));
 insert into public.moon_gardens(telegram_id) values(r.referrer_id) on conflict do nothing;
 select moon_seeds_available into strict balance_value from public.moon_gardens where telegram_id=r.referrer_id for update;
 if t.purchase_seeds>0 then
  insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(r.referrer_id,'luna4:referral:purchase:'||token,'referral',t.purchase_seeds,balance_value+t.purchase_seeds) returning id into ledger_value;
  update public.moon_gardens set moon_seeds_available=balance_value+t.purchase_seeds,moon_seeds_earned_total=moon_seeds_earned_total+t.purchase_seeds,updated_at=now() where telegram_id=r.referrer_id;
 end if;
 insert into public.luna4_referral_claims(claim_token,kind,catalog_version,seeds,source_hash,ledger_id) values(token,'first_purchase',t.catalog_version,t.purchase_seeds,encode(sha256(convert_to(first_payment.source,'UTF8')),'hex'),ledger_value);
 return jsonb_build_object('status','rewarded','awarded',t.purchase_seeds);
end $$;

create or replace function public.luna4_qualify_referral(p_owner bigint,p_kind text,p_evidence uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;r public.luna30_referrals%rowtype;t public.luna4_referral_terms%rowtype;prepared jsonb;
 completed timestamptz;g public.moon_gardens%rowtype;monthly integer;token text;inviter_token text;
begin
 prepared:=public.luna4_capture_referral_terms(p_owner);
 if prepared->>'status'='legacy' then return public.luna34_qualify_referral(p_owner,p_kind,p_evidence);end if;
 if prepared->>'status'<>'saved' then return prepared||jsonb_build_object('awarded',0);end if;
 select * into strict cfg from public.luna34_commercial_settings where id;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_referee:'||p_owner::text,0));
 select * into strict r from public.luna30_referrals where referee_id=p_owner for update;select * into strict t from public.luna4_referral_terms where referee_id=p_owner;
 if r.state not in('pending','qualified') then return jsonb_build_object('status',r.state,'awarded',0,'duplicate',true);end if;
 if not exists(select 1 from public.luna34_referral_onboarding where telegram_id=p_owner) then return jsonb_build_object('status','onboarding_required','awarded',0);end if;
 if p_kind='meditation' then
  select p.completed_at into completed from public.playback_sessions p join public.meditations m on m.id=p.meditation_id where p.id=p_evidence and p.telegram_id=p_owner and p.completed_at is not null and p.started_at>=r.created_at and m.duration>=60 and p.listened_seconds>=ceil(m.duration*.9) and p.completed_at-p.started_at>=make_interval(secs=>ceil(m.duration*.9)::integer);
 elsif p_kind='breath' then
  select completed_at into completed from public.luna_breath_proofs where id=p_evidence and telegram_id=p_owner and started_at>=r.created_at and completed_at is not null and verified_seconds>=ceil(duration_seconds*.9) and completed_at-started_at>=make_interval(secs=>ceil(duration_seconds*.9)::integer);
 elsif p_kind='tarot' then
  select e.created_at into completed from public.luna34_progress_events e join public.luna_tarot_readings q on q.id=e.entity_id and q.telegram_id=e.telegram_id where e.telegram_id=p_owner and e.entity_id=p_evidence and e.kind='reading_reveal' and e.detail='complete' and q.created_at>=r.created_at and q.status in('local','ready','fallback') limit 1;
 else raise exception 'Unsupported qualification';end if;
 if completed is null then return jsonb_build_object('status','unverified','awarded',0);end if;
 update public.luna30_referrals set state='qualified',qualified_at=completed,qualification_kind=p_kind,qualification_id=p_evidence,source_session_id=case when p_kind='meditation' then p_evidence else null end where referee_id=p_owner;
 if not(cfg.rewards_enabled and cfg.live_payment_verified and cfg.checkout_enabled) or not exists(select 1 from public.luna21_settings where id and wallet_enabled) then return jsonb_build_object('status','qualified','awarded',0);end if;
 select encode(extensions.hmac(convert_to('luna4-referral-qualified:'||p_owner::text,'UTF8'),secret,'sha256'),'hex') into strict token from public.luna4_reward_identity where id;
 if exists(select 1 from public.luna4_referral_claims where claim_token=token) or exists(select 1 from public.luna_seed_ledger where kind='referral' and event_key='referral:invited:'||p_owner::text) then return jsonb_build_object('status','duplicate','awarded',0);end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_referrer:'||r.referrer_id::text,0));
 select encode(extensions.hmac(convert_to('luna4-referrer:'||r.referrer_id::text,'UTF8'),secret,'sha256'),'hex') into strict inviter_token from public.luna4_reward_identity where id;
 -- Count durable new claims, not deletable account rows. Older payouts count
 -- from their real inviter ledger, so historical records are not reclassified.
 select (select count(*) from public.luna4_referral_claims where kind='qualified' and source_hash=inviter_token and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' and created_at<(date_trunc('month',now() at time zone 'UTC')+interval '1 month') at time zone 'UTC')+(select count(*) from public.luna_seed_ledger where telegram_id=r.referrer_id and kind='referral' and event_key like 'referral:invited:%' and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' and created_at<(date_trunc('month',now() at time zone 'UTC')+interval '1 month') at time zone 'UTC') into monthly;
 if monthly>=5 then update public.luna30_referrals set state='limited' where referee_id=p_owner;return jsonb_build_object('status','monthly_limit','awarded',0);end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||least(p_owner,r.referrer_id)::text,0));perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||greatest(p_owner,r.referrer_id)::text,0));
 insert into public.moon_gardens(telegram_id) values(p_owner),(r.referrer_id) on conflict do nothing;perform 1 from public.moon_gardens where telegram_id in(p_owner,r.referrer_id) order by telegram_id for update;
 if t.invitee_seeds>0 then select * into strict g from public.moon_gardens where telegram_id=p_owner;insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_owner,'luna4:referral:new:'||token,'referral',t.invitee_seeds,g.moon_seeds_available+t.invitee_seeds);update public.moon_gardens set moon_seeds_available=moon_seeds_available+t.invitee_seeds,moon_seeds_earned_total=moon_seeds_earned_total+t.invitee_seeds,updated_at=now() where telegram_id=p_owner;end if;
 if t.inviter_seeds>0 then select * into strict g from public.moon_gardens where telegram_id=r.referrer_id;insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(r.referrer_id,'luna4:referral:invited:'||token,'referral',t.inviter_seeds,g.moon_seeds_available+t.inviter_seeds);update public.moon_gardens set moon_seeds_available=moon_seeds_available+t.inviter_seeds,moon_seeds_earned_total=moon_seeds_earned_total+t.inviter_seeds,updated_at=now() where telegram_id=r.referrer_id;end if;
 insert into public.luna4_referral_claims(claim_token,kind,catalog_version,seeds,source_hash) values(token,'qualified',t.catalog_version,t.invitee_seeds+t.inviter_seeds,inviter_token);
 update public.luna30_referrals set state='rewarded',rewarded_at=now() where referee_id=p_owner;
 -- A purchase that committed before activity qualification can now satisfy
 -- its separate benefit. Callback reconciliation runs in a separate transaction.
 perform public.luna4_reward_referral_purchase(p_owner);
 return jsonb_build_object('status','rewarded','awarded',t.invitee_seeds,'inviterAwarded',t.inviter_seeds);
end $$;

create or replace function public.luna4_referral_status(p_owner bigint)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;earned bigint;next_policy boolean;
begin
 select * into strict cfg from public.luna34_commercial_settings where id;next_policy:=cfg.catalog->>'version'='luna-4.0-completion-v1';
 select coalesce(sum(delta),0) into earned from public.luna_seed_ledger where telegram_id=p_owner and kind='referral' and(event_key like 'referral:invited:%' or event_key like 'luna4:referral:invited:%' or event_key like 'luna4:referral:purchase:%');
 return jsonb_build_object('seedsEarned',earned,'policy',jsonb_build_object('inviter',case when next_policy then (cfg.catalog#>>'{rewards,referralInviter}')::integer else 30 end,'invitee',case when next_policy then (cfg.catalog#>>'{rewards,referralInvitee}')::integer else 20 end,'firstPurchase',case when next_policy then (cfg.catalog#>>'{rewards,referralFirstPurchase}')::integer else 0 end),'monthlyCap',5);
end $$;
revoke all on function public.luna4_capture_referral_terms(bigint),public.luna4_attribute_referral(bigint,text),public.luna4_reward_referral_purchase(bigint),public.luna4_qualify_referral(bigint,text,uuid),public.luna4_referral_status(bigint) from public,anon,authenticated;
grant execute on function public.luna4_capture_referral_terms(bigint),public.luna4_attribute_referral(bigint,text),public.luna4_reward_referral_purchase(bigint),public.luna4_qualify_referral(bigint,text,uuid),public.luna4_referral_status(bigint) to service_role;
notify pgrst,'reload schema';commit;
-- Rollback pauses new referrals/rewards. Preserve contracts, HMAC tombstones,
-- receipt timestamps and earned journal entries. Refunds are flagged for review,
-- never automatically debited from historical/purchased balances or made debt.
