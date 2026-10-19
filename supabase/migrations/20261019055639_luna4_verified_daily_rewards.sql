-- New catalog only. One existing wallet/ledger; no historic balance rewrite.
-- Welcome anti-replay metadata is pseudonymous and survives account erasure.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create table if not exists public.luna4_reward_identity (
 id boolean primary key default true check(id),secret bytea not null default extensions.gen_random_bytes(32) check(octet_length(secret)=32)
);
insert into public.luna4_reward_identity(id) values(true) on conflict do nothing;
create table if not exists public.luna4_welcome_claims (
 claim_token text primary key check(claim_token ~ '^[a-f0-9]{64}$'),claimed_at timestamptz not null default now(),catalog_version text not null,
 seeds integer not null check(seeds between 0 and 10000),messages integer not null check(messages between 0 and 100)
);
alter table public.luna4_reward_identity enable row level security;alter table public.luna4_reward_identity force row level security;
alter table public.luna4_welcome_claims enable row level security;alter table public.luna4_welcome_claims force row level security;
revoke all on public.luna4_reward_identity,public.luna4_welcome_claims from public,anon,authenticated,service_role;
grant select on public.luna4_reward_identity to service_role;grant select,insert on public.luna4_welcome_claims to service_role;
alter table public.luna40_quota_grants add column if not exists source_key text;
create unique index if not exists luna4_quota_grant_source on public.luna40_quota_grants(telegram_id,source_key) where source_key is not null;
alter table public.luna_seed_ledger drop constraint if exists luna_seed_ledger_kind_check;
alter table public.luna_seed_ledger add constraint luna_seed_ledger_kind_check check(kind in('meditation','breath','checkin','seven_days','reading_purchase','stars_package','referral','premium_renewal','refund','journal','ai_allowance_purchase','deep_analysis_purchase','admin_adjustment','welcome'));

create or replace function public.luna4_claim_welcome(p_owner bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;created timestamptz;key_value text;seed_value integer;message_value integer;balance_value integer;
begin
 select * into strict cfg from public.luna34_commercial_settings where id;
 if cfg.catalog->>'version'<>'luna-4.0-completion-v1' or not(cfg.luna4_activation_verified and cfg.rewards_enabled and cfg.owner_approved) or cfg.luna4_cutover_at is null or cfg.luna4_cutover_at>now() or not exists(select 1 from public.luna21_settings where id and wallet_enabled) then return jsonb_build_object('status','disabled','awarded',0);end if;
 select created_at into created from public.users where telegram_id=p_owner;
 if created is null or created<cfg.luna4_cutover_at then return jsonb_build_object('status','not_new','awarded',0);end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_owner::text,0));
 select encode(extensions.hmac(convert_to('luna4-welcome:'||p_owner::text,'UTF8'),secret,'sha256'),'hex') into strict key_value from public.luna4_reward_identity where id;
 if exists(select 1 from public.luna4_welcome_claims where claim_token=key_value) then return jsonb_build_object('status','duplicate','awarded',0);end if;
 seed_value:=(cfg.catalog#>>'{rewards,welcomeSeeds}')::integer;message_value:=(cfg.catalog#>>'{rewards,introductoryMessages}')::integer;
 insert into public.luna4_welcome_claims(claim_token,catalog_version,seeds,messages) values(key_value,cfg.catalog->>'version',seed_value,message_value);
 insert into public.moon_gardens(telegram_id) values(p_owner) on conflict do nothing;
 select moon_seeds_available into strict balance_value from public.moon_gardens where telegram_id=p_owner for update;
 if seed_value>0 then
  insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_owner,'luna4:welcome','welcome',seed_value,balance_value+seed_value);
  update public.moon_gardens set moon_seeds_available=balance_value+seed_value,moon_seeds_earned_total=moon_seeds_earned_total+seed_value,updated_at=now() where telegram_id=p_owner;
 end if;
 if message_value>0 then insert into public.luna40_quota_grants(telegram_id,quantity,expires_at,actor,reason,source_key) values(p_owner,message_value,'infinity',p_owner,'Introductory standard AI replies','luna4:intro');end if;
 return jsonb_build_object('status','awarded','awarded',seed_value,'additionalMessages',message_value);
end $$;

create or replace function public.luna4_reward_checkin(p_owner bigint,p_source uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;day_value date:=(now() at time zone 'UTC')::date;start_value timestamptz;
 amount integer;bonus integer:=0;balance_value integer;days integer;
begin
 select * into strict cfg from public.luna34_commercial_settings where id;
 if cfg.catalog->>'version'<>'luna-4.0-completion-v1' or not(cfg.luna4_activation_verified and cfg.rewards_enabled and cfg.owner_approved) or cfg.luna4_cutover_at is null or cfg.luna4_cutover_at>now() or not exists(select 1 from public.luna21_settings where id and wallet_enabled) then return jsonb_build_object('status','disabled','awarded',0);end if;
 start_value:=day_value::timestamp at time zone 'UTC';
 if not exists(select 1 from public.daily_checkins where telegram_id=p_owner and id=p_source and created_at>=greatest(start_value,cfg.luna4_cutover_at) and created_at<start_value+interval '24 hours') then return jsonb_build_object('status','unverified','awarded',0);end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_owner::text,0));
 if exists(select 1 from public.luna_seed_ledger where telegram_id=p_owner and kind='checkin' and reward_day=day_value) then return jsonb_build_object('status','duplicate','awarded',0);end if;
 amount:=(cfg.catalog#>>'{rewards,dailyCheckin}')::integer;
 select count(distinct (created_at at time zone 'UTC')::date) into days from public.daily_checkins where telegram_id=p_owner and created_at>=greatest(start_value-interval '6 days',cfg.luna4_cutover_at) and created_at<start_value+interval '24 hours';
 if days=7 and not exists(select 1 from public.luna_seed_ledger where telegram_id=p_owner and kind='seven_days' and reward_day>day_value-7 and reward_day<=day_value) then bonus:=(cfg.catalog#>>'{rewards,sevenDayStreak}')::integer;end if;
 if amount+bonus=0 then return jsonb_build_object('status','no_reward','awarded',0);end if;
 insert into public.moon_gardens(telegram_id) values(p_owner) on conflict do nothing;
 select moon_seeds_available into strict balance_value from public.moon_gardens where telegram_id=p_owner for update;
 if amount>0 then insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after,reward_day) values(p_owner,'luna4:checkin:'||day_value::text,'checkin',amount,balance_value+amount,day_value);end if;
 if bonus>0 then insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after,reward_day) values(p_owner,'luna4:streak:'||day_value::text,'seven_days',bonus,balance_value+amount+bonus,day_value);end if;
 update public.moon_gardens set moon_seeds_available=balance_value+amount+bonus,moon_seeds_earned_total=moon_seeds_earned_total+amount+bonus,last_moon_seed_earned_at=now(),updated_at=now() where telegram_id=p_owner;
 return jsonb_build_object('status','awarded','awarded',amount,'bonus',bonus,'timezone','UTC','day',day_value);
end $$;

-- Same proven provenance journal, with the new welcome event classified as
-- promotional. No reclassification/backfill of historical unknown balances.
create or replace function public.luna4_journal_seed_sources()
returns trigger language plpgsql security invoker set search_path='' as $$
declare s public.luna4_seed_sources%rowtype; original public.luna4_seed_provenance%rowtype;
 before_value bigint:=new.balance_after::bigint-new.delta::bigint;
 promo bigint:=0;paid bigint:=0;legacy bigint:=0;remaining bigint;take_value bigint;source text;original_id uuid;
begin
 perform 1 from public.moon_gardens where telegram_id=new.telegram_id for update;
 if before_value<0 then raise exception 'Invalid seed ledger balance' using errcode='23514';end if;
 insert into public.luna4_seed_sources(telegram_id,legacy_unclassified) values(new.telegram_id,before_value) on conflict do nothing;
 select * into strict s from public.luna4_seed_sources where telegram_id=new.telegram_id for update;
 if s.promotional+s.purchased+s.legacy_unclassified<>before_value then raise exception 'Seed provenance requires reconciliation' using errcode='23514';end if;
 if new.event_key like 'luna43:deep_refund:%' then
  select p.* into original from public.luna4_seed_provenance p join public.luna_seed_ledger l on l.id=p.ledger_id where l.telegram_id=new.telegram_id and l.event_key='luna43:purchase:'||substr(new.event_key,length('luna43:deep_refund:')+1);
 elsif new.event_key like 'luna30:refund:%' then
  select p.* into original from public.luna4_seed_provenance p join public.luna_seed_ledger l on l.id=p.ledger_id where l.telegram_id=new.telegram_id and l.event_key='luna30:charge:'||substr(new.event_key,length('luna30:refund:')+1);
 end if;
 if original.ledger_id is not null and new.delta>0 and original.promotional_delta+original.purchased_delta+original.legacy_delta=-new.delta then
  promo:=-original.promotional_delta;paid:=-original.purchased_delta;legacy:=-original.legacy_delta;source:='refund';original_id:=original.ledger_id;
 elsif original.ledger_id is not null and new.delta<0 and original.promotional_delta+original.purchased_delta+original.legacy_delta=-new.delta then
  remaining:=-new.delta;paid:=-least(s.purchased,greatest(0,original.purchased_delta),remaining);remaining:=remaining+paid;
  promo:=-least(s.promotional,greatest(0,original.promotional_delta),remaining);remaining:=remaining+promo;
  legacy:=-least(s.legacy_unclassified,remaining);remaining:=remaining+legacy;
  if remaining>0 then take_value:=least(s.purchased+paid,remaining);paid:=paid-take_value;remaining:=remaining-take_value;end if;
  if remaining>0 then promo:=promo-remaining;end if;source:='purchase_refund';original_id:=original.ledger_id;
 elsif new.delta<0 then
  remaining:=-new.delta;promo:=-least(s.promotional,remaining);remaining:=remaining+promo;
  legacy:=-least(s.legacy_unclassified,remaining);remaining:=remaining+legacy;paid:=-remaining;source:='spend';
 elsif new.kind='stars_package' then paid:=new.delta;source:='purchased';
 elsif new.kind in('checkin','seven_days','meditation','breath','journal','referral','premium_renewal','welcome') then promo:=new.delta;source:='promotional';
 else legacy:=new.delta;source:='legacy_unclassified';end if;
 if promo+paid+legacy<>new.delta or s.promotional+promo<0 or s.purchased+paid<0 or s.legacy_unclassified+legacy<0 then raise exception 'Invalid provenance split' using errcode='23514';end if;
 update public.luna4_seed_sources set promotional=promotional+promo,purchased=purchased+paid,legacy_unclassified=legacy_unclassified+legacy,revision=revision+1,updated_at=now() where telegram_id=new.telegram_id returning * into s;
 insert into public.luna4_seed_provenance(ledger_id,telegram_id,promotional_delta,purchased_delta,legacy_delta,original_ledger_id,classification,revision) values(new.id,new.telegram_id,promo,paid,legacy,original_id,source,s.revision);
 return new;
end $$;
-- Preserve verified breathing completion/progress. Only the old unbounded
-- one-Seed reward is retired when the new catalog's rewards are active.
create or replace function public.luna34_finish_breath(p_owner bigint,p_session uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.luna_breath_proofs%rowtype;cycles integer;seeds_value integer:=1;
begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna34_breath:'||p_owner::text,0));
 perform public.luna34_breath_heartbeat(p_owner,p_session,false);
 select * into strict b from public.luna_breath_proofs where telegram_id=p_owner and id=p_session for update;
 if b.completed_at is not null then return jsonb_build_object('completed',true,'newlyCompleted',false,'mode',b.mode,'duration_seconds',b.duration_seconds,'moonSeedsAwarded',0);end if;
 if b.verified_seconds<ceil(b.duration_seconds*.9) or now()-b.started_at<make_interval(secs=>ceil(b.duration_seconds*.9)::integer) then return jsonb_build_object('completed',false,'verifiedSeconds',b.verified_seconds);end if;
 cycles:=greatest(1,floor(b.duration_seconds/(case b.mode when 'box' then 16 when '478' then 19 when 'triangle' then 12 when 'anxiety_reset' then 12 when 'sleep' then 14 when 'morning_energy' then 12 else 10 end)::numeric)::integer);
 update public.luna_breath_proofs set completed_at=now(),is_active=false where id=b.id;
 insert into public.breath_sessions(id,telegram_id,mode,duration_seconds,breath_count) values(b.id,p_owner,b.mode,b.duration_seconds,cycles);
 if exists(select 1 from public.luna34_commercial_settings where id and catalog->>'version'='luna-4.0-completion-v1' and luna4_activation_verified and rewards_enabled) then seeds_value:=0;else perform public.luna_mutate_garden(p_owner,'award',null,1,0);end if;
 return jsonb_build_object('completed',true,'newlyCompleted',true,'mode',b.mode,'duration_seconds',b.duration_seconds,'breath_count',cycles,'moonSeedsAwarded',seeds_value);
end $$;
revoke all on function public.luna4_claim_welcome(bigint),public.luna4_reward_checkin(bigint,uuid) from public,anon,authenticated;
grant execute on function public.luna4_claim_welcome(bigint),public.luna4_reward_checkin(bigint,uuid) to service_role;
notify pgrst,'reload schema';commit;
-- Rollback closes new rewards/flag only. Retain opaque anti-replay markers,
-- source journals, grants and balances. Never regenerate the identity salt.
