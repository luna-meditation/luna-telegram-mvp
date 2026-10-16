-- PREPARED / LOCAL TEST ONLY. No existing balances, entitlements or payment rows changed on apply.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create table if not exists public.luna30_release_settings (
 id boolean primary key default true check(id),catalog_version text not null default 'luna-3.0-proposed',
 quotas_enabled boolean not null default false,referrals_enabled boolean not null default false,referral_rewards_enabled boolean not null default false,
 astrology_enabled boolean not null default false,premium_enabled boolean not null default false,annual_enabled boolean not null default false,
 seed_packages_enabled boolean not null default false,paid_compatibility_enabled boolean not null default false,support_enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
insert into public.luna30_release_settings(id) values(true) on conflict do nothing;
create table if not exists public.luna30_referral_codes (
 telegram_id bigint primary key references public.users(telegram_id) on delete cascade,
 code text not null unique check(code ~ '^[A-Za-z0-9_-]{24}$'),created_at timestamptz not null default now(),disabled_at timestamptz
);
create table if not exists public.luna30_referrals (
 referee_id bigint primary key references public.users(telegram_id) on delete cascade,
 referrer_id bigint not null references public.users(telegram_id) on delete cascade,
 state text not null default 'pending' check(state in ('pending','qualified','rewarded','review','limited')),
 source_session_id uuid unique references public.playback_sessions(id) on delete set null,
 created_at timestamptz not null default now(),qualified_at timestamptz,rewarded_at timestamptz,
 check(referrer_id<>referee_id)
);
create index if not exists luna30_referral_inviter_state on public.luna30_referrals(referrer_id,state,rewarded_at);
do $$declare t text;begin foreach t in array array['luna30_release_settings','luna30_referral_codes','luna30_referrals'] loop
 execute format('alter table public.%I enable row level security',t);execute format('alter table public.%I force row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select,insert,update on public.%I to service_role',t);
end loop;end $$;
-- Narrowly extend the existing authoritative ledger; do not introduce a second balance system.
alter table public.luna_seed_ledger drop constraint if exists luna_seed_ledger_kind_check;
alter table public.luna_seed_ledger add constraint luna_seed_ledger_kind_check check(kind in ('meditation','breath','checkin','seven_days','reading_purchase','stars_package','referral'));

create or replace function public.luna30_attribute_referral(p_owner bigint,p_signed_code text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.luna30_release_settings%rowtype;v_inviter bigint;v_created timestamptz;
begin
 select * into strict s from public.luna30_release_settings where id;
 if not s.referrals_enabled or s.catalog_version<>'luna-3.0-proposed' then return jsonb_build_object('status','disabled');end if;
 if p_signed_code is null or p_signed_code !~ '^[A-Za-z0-9_-]{24}$' then return jsonb_build_object('status','invalid');end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_referee:'||p_owner::text,0));
 if exists(select 1 from public.luna30_referrals where referee_id=p_owner) then return jsonb_build_object('status','already_attributed');end if;
 select telegram_id into v_inviter from public.luna30_referral_codes where code=p_signed_code and disabled_at is null;
 if v_inviter is null or v_inviter=p_owner then return jsonb_build_object('status','invalid');end if;
 select created_at into v_created from public.users where telegram_id=p_owner;
 if v_created is null or v_created<now()-interval '24 hours' or exists(select 1 from public.playback_sessions where telegram_id=p_owner and completed_at is not null) then return jsonb_build_object('status','not_new');end if;
 insert into public.luna30_referrals(referee_id,referrer_id) values(p_owner,v_inviter) on conflict do nothing;
 return jsonb_build_object('status','pending');
end $$;

create or replace function public.luna30_qualify_referral(p_owner bigint,p_verified_session_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.luna30_release_settings%rowtype;r public.luna30_referrals%rowtype;v_valid boolean;v_count integer;v_month timestamptz;v_month_end timestamptz;g public.moon_gardens%rowtype;
begin
 select * into strict s from public.luna30_release_settings where id;
 if not s.referrals_enabled or not s.referral_rewards_enabled or s.catalog_version<>'luna-3.0-proposed' then return jsonb_build_object('status','disabled','awarded',0);end if;
 if not exists(select 1 from public.luna21_settings where id and wallet_enabled) then return jsonb_build_object('status','wallet_disabled','awarded',0);end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_referee:'||p_owner::text,0));
 select * into r from public.luna30_referrals where referee_id=p_owner for update;
 if not found then return jsonb_build_object('status','not_attributed','awarded',0);end if;
 if r.state<>'pending' and r.state<>'qualified' then return jsonb_build_object('status',r.state,'awarded',0);end if;
 select exists(select 1 from public.playback_sessions p join public.meditations m on m.id=p.meditation_id
 where p.id=p_verified_session_id and p.telegram_id=p_owner and p.started_at>=r.created_at and p.completed_at is not null
 and p.listened_seconds>=ceil(m.duration*.9) and p.completed_at-p.started_at>=make_interval(secs=>ceil(m.duration*.9)::integer)
 and not exists(select 1 from public.playback_sessions earlier where earlier.telegram_id=p_owner and earlier.completed_at is not null and earlier.completed_at<p.completed_at)) into v_valid;
 if not v_valid then return jsonb_build_object('status','unverified','awarded',0);end if;
 -- Inviter lock serializes the monthly cap across different new users.
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_referrer:'||r.referrer_id::text,0));
 v_month:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 v_month_end:=(date_trunc('month',now() at time zone 'UTC')+interval '1 month') at time zone 'UTC';
 select count(*) into v_count from public.luna30_referrals where referrer_id=r.referrer_id and state='rewarded' and rewarded_at>=v_month and rewarded_at<v_month_end;
 if v_count>=5 then update public.luna30_referrals set state='limited',qualified_at=now(),source_session_id=p_verified_session_id where referee_id=p_owner;return jsonb_build_object('status','monthly_limit','awarded',0);end if;
 -- Match existing v2 wallet lock; stable order avoids cross-invitation deadlocks.
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||least(p_owner,r.referrer_id)::text,0));
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||greatest(p_owner,r.referrer_id)::text,0));
 insert into public.moon_gardens(telegram_id) values(p_owner),(r.referrer_id) on conflict do nothing;
 perform 1 from public.moon_gardens where telegram_id in (p_owner,r.referrer_id) order by telegram_id for update;
 select * into strict g from public.moon_gardens where telegram_id=p_owner;
 insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_owner,'referral:new:'||p_owner::text,'referral',20,g.moon_seeds_available+20);
 update public.moon_gardens set moon_seeds_available=moon_seeds_available+20,moon_seeds_earned_total=moon_seeds_earned_total+20,updated_at=now() where telegram_id=p_owner;
 select * into strict g from public.moon_gardens where telegram_id=r.referrer_id;
 insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(r.referrer_id,'referral:invited:'||p_owner::text,'referral',30,g.moon_seeds_available+30);
 update public.moon_gardens set moon_seeds_available=moon_seeds_available+30,moon_seeds_earned_total=moon_seeds_earned_total+30,updated_at=now() where telegram_id=r.referrer_id;
 update public.luna30_referrals set state='rewarded',source_session_id=p_verified_session_id,qualified_at=now(),rewarded_at=now() where referee_id=p_owner;
 return jsonb_build_object('status','rewarded','awarded',20,'inviterAwarded',30);
end $$;
revoke all on function public.luna30_attribute_referral(bigint,text),public.luna30_qualify_referral(bigint,uuid) from public,anon,authenticated;
grant execute on function public.luna30_attribute_referral(bigint,text),public.luna30_qualify_referral(bigint,uuid) to service_role;
commit;
-- Safe rollback: disable server flags plus referrals_enabled/referral_rewards_enabled.
-- Retain referral records/ledger and valid earned Seeds. Never remove legitimate historical rewards.
