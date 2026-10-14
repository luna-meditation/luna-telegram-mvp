-- PREPARED ONLY. All new money/reward switches are FALSE. No balance backfill.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create table if not exists public.luna21_settings (
 id boolean primary key default true check(id),
 wallet_enabled boolean not null default false,
 rewards_enabled boolean not null default false,
 paid_readings_enabled boolean not null default false,
 premium_enabled boolean not null default false,
 reward_meditation integer not null default 3 check(reward_meditation between 0 and 5),
 reward_breath integer not null default 1 check(reward_breath between 0 and 5),
 reward_checkin integer not null default 1 check(reward_checkin between 0 and 5),
 reward_daily_cap integer not null default 5 check(reward_daily_cap between 0 and 20),
 reward_seven_days integer not null default 10 check(reward_seven_days between 0 and 100),
 single_seeds integer not null default 15 check(single_seeds>0),
 three_seeds integer not null default 60 check(three_seeds>0),
 five_seeds integer not null default 120 check(five_seeds>0),
 single_stars integer not null default 15 check(single_stars>0),
 three_stars integer not null default 60 check(three_stars>0),
 five_stars integer not null default 120 check(five_stars>0),
 premium_three_daily integer not null default 3 check(premium_three_daily between 0 and 5),
 premium_five_daily integer not null default 1 check(premium_five_daily between 0 and 3),
 monthly_premium_stars integer check(monthly_premium_stars>0),
 seed_packages jsonb not null default '[]'::jsonb check(jsonb_typeof(seed_packages)='array'),
 updated_at timestamptz not null default now()
);
insert into public.luna21_settings(id) values(true) on conflict do nothing;
create table if not exists public.luna_seed_ledger (
 id uuid primary key default gen_random_uuid(),telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 event_key text not null check(length(event_key) between 1 and 180),kind text not null check(kind in ('meditation','breath','checkin','seven_days','reading_purchase','stars_package')),
 delta integer not null check(delta<>0),balance_after integer not null check(balance_after>=0),
 reward_day date,created_at timestamptz not null default now(),unique(telegram_id,event_key)
);
create index if not exists luna_seed_ledger_owner_created on public.luna_seed_ledger(telegram_id,created_at desc);
create unique index if not exists luna_seed_ledger_daily_kind on public.luna_seed_ledger(telegram_id,reward_day,kind) where kind in ('meditation','breath','checkin');
create table if not exists public.luna_reading_orders (
 id uuid primary key default gen_random_uuid(),telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 request_id uuid not null,kind text not null check(kind in ('single','three','five')),currency text not null check(currency in ('SEEDS','XTR')),
 amount integer not null check(amount>0),status text not null check(status in ('pending','entitled','consumed','refunded')),
 client_reading_id uuid,telegram_charge_id text unique,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(telegram_id,request_id)
);
create table if not exists public.luna_breath_proofs (
 id uuid primary key default gen_random_uuid(),telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 mode text not null check(mode in ('calm','box','478','coherent','triangle','sigh','anxiety_reset','sleep','morning_energy')),
 duration_seconds integer not null check(duration_seconds between 30 and 600),started_at timestamptz not null default now(),
 last_heartbeat_at timestamptz not null default now(),verified_seconds integer not null default 0 check(verified_seconds>=0),completed_at timestamptz
);
create table if not exists public.luna_premium_reading_usage (
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,usage_day date not null,kind text not null check(kind in ('three','five')),
 client_reading_id uuid not null,created_at timestamptz not null default now(),primary key(telegram_id,client_reading_id)
);
create index if not exists luna_premium_reading_usage_day on public.luna_premium_reading_usage(telegram_id,usage_day,kind);
do $$ declare t text;begin
 foreach t in array array['luna21_settings','luna_seed_ledger','luna_reading_orders','luna_breath_proofs','luna_premium_reading_usage'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;
grant select,update on public.luna21_settings to service_role;
grant select,insert on public.luna_seed_ledger,public.luna_premium_reading_usage to service_role;
grant select,insert,update on public.luna_reading_orders,public.luna_breath_proofs to service_role;

create or replace function public.luna21_reward(p_telegram_id bigint,p_kind text,p_source_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.luna21_settings%rowtype;g public.moon_gardens%rowtype;v_day date:=(now() at time zone 'UTC')::date;amount integer;earned integer;days integer;bonus integer:=0;valid boolean:=false;
begin
 select * into strict s from public.luna21_settings where id;
 if not s.wallet_enabled or not s.rewards_enabled then return jsonb_build_object('status','disabled','awarded',0);end if;
 if p_kind not in ('meditation','breath','checkin') or p_source_id is null then raise exception 'Invalid reward source';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_telegram_id::text,0));
 if p_kind='meditation' then
  select exists(select 1 from public.playback_sessions p join public.meditations m on m.id=p.meditation_id where p.id=p_source_id and p.telegram_id=p_telegram_id and p.completed_at>=v_day::timestamp at time zone 'UTC' and p.completed_at<((v_day+1)::timestamp at time zone 'UTC') and p.listened_seconds>=ceil(m.duration*.9)) into valid;amount:=s.reward_meditation;
 elsif p_kind='breath' then
  select exists(select 1 from public.luna_breath_proofs b where b.id=p_source_id and b.telegram_id=p_telegram_id and b.completed_at>=v_day::timestamp at time zone 'UTC' and b.completed_at<((v_day+1)::timestamp at time zone 'UTC') and b.verified_seconds>=b.duration_seconds*.9 and b.completed_at-b.started_at>=make_interval(secs=>b.duration_seconds*.9)) into valid;amount:=s.reward_breath;
 else
  select exists(select 1 from public.daily_checkins c where c.id=p_source_id and c.telegram_id=p_telegram_id and c.created_at>=v_day::timestamp at time zone 'UTC' and c.created_at<((v_day+1)::timestamp at time zone 'UTC')) into valid;amount:=s.reward_checkin;
 end if;
 if not valid then return jsonb_build_object('status','unverified','awarded',0);end if;
 if exists(select 1 from public.luna_seed_ledger l where l.telegram_id=p_telegram_id and l.reward_day=v_day and l.kind=p_kind) then return jsonb_build_object('status','duplicate','awarded',0);end if;
 select coalesce(sum(delta),0) into earned from public.luna_seed_ledger l where l.telegram_id=p_telegram_id and l.reward_day=v_day and l.kind in ('meditation','breath','checkin');
 amount:=least(amount,greatest(0,s.reward_daily_cap-earned));
 if amount<=0 then return jsonb_build_object('status','limit','awarded',0);end if;
 insert into public.moon_gardens(telegram_id) values(p_telegram_id) on conflict(telegram_id) do nothing;
 select * into strict g from public.moon_gardens where telegram_id=p_telegram_id for update;
 insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after,reward_day) values(p_telegram_id,'reward:'||v_day||':'||p_kind,p_kind,amount,g.moon_seeds_available+amount,v_day);
 select count(distinct reward_day) into days from public.luna_seed_ledger l where l.telegram_id=p_telegram_id and l.kind in ('meditation','breath','checkin');
 if days>0 and days%7=0 and s.reward_seven_days>0 then
  insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after,reward_day) values(p_telegram_id,'seven_days:'||(days/7),'seven_days',s.reward_seven_days,g.moon_seeds_available+amount+s.reward_seven_days,v_day) on conflict(telegram_id,event_key) do nothing;
  if found then bonus:=s.reward_seven_days;end if;
 end if;
 update public.moon_gardens set moon_seeds_available=g.moon_seeds_available+amount+bonus,moon_seeds_earned_total=g.moon_seeds_earned_total+amount+bonus,last_moon_seed_earned_at=now(),updated_at=now() where telegram_id=p_telegram_id;
 return jsonb_build_object('status','ok','awarded',amount,'bonus',bonus,'balance',g.moon_seeds_available+amount+bonus);
end $$;

create or replace function public.luna21_buy_seed_reading(p_telegram_id bigint,p_request_id uuid,p_kind text,p_expected_amount integer default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.luna21_settings%rowtype;g public.moon_gardens%rowtype;o public.luna_reading_orders%rowtype;cost integer;
begin
 select * into strict s from public.luna21_settings where id;
 if not s.wallet_enabled or not s.paid_readings_enabled then return jsonb_build_object('status','disabled');end if;
 if p_kind not in ('single','three','five') or p_request_id is null then raise exception 'Invalid reading order';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_telegram_id::text,0));
 select * into o from public.luna_reading_orders where telegram_id=p_telegram_id and request_id=p_request_id;
 if found then
  if o.kind<>p_kind or o.currency<>'SEEDS' then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('status','duplicate','order',to_jsonb(o)-'telegram_id');
 end if;
 cost:=case p_kind when 'single' then s.single_seeds when 'three' then s.three_seeds else s.five_seeds end;
 if p_expected_amount is not null and p_expected_amount<>cost then return jsonb_build_object('status','price_changed');end if;
 select * into g from public.moon_gardens where telegram_id=p_telegram_id for update;
 if not found or g.moon_seeds_available<cost then return jsonb_build_object('status','insufficient');end if;
 insert into public.luna_reading_orders(telegram_id,request_id,kind,currency,amount,status) values(p_telegram_id,p_request_id,p_kind,'SEEDS',cost,'entitled') returning * into o;
 update public.moon_gardens set moon_seeds_available=g.moon_seeds_available-cost,updated_at=now() where telegram_id=p_telegram_id;
 insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_telegram_id,'order:'||o.id,'reading_purchase',-cost,g.moon_seeds_available-cost);
 return jsonb_build_object('status','ok','order',to_jsonb(o)-'telegram_id','balance',g.moon_seeds_available-cost);
end $$;
create or replace function public.luna21_prepare_stars_reading(p_telegram_id bigint,p_request_id uuid,p_kind text,p_expected_amount integer default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.luna21_settings%rowtype;o public.luna_reading_orders%rowtype;cost integer;
begin
 select * into strict s from public.luna21_settings where id;
 if not s.paid_readings_enabled then return jsonb_build_object('status','disabled');end if;
 if p_kind not in ('single','three','five') or p_request_id is null then raise exception 'Invalid order';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_telegram_id::text,0));
 select * into o from public.luna_reading_orders where telegram_id=p_telegram_id and request_id=p_request_id;
 if found then
  if o.kind<>p_kind or o.currency<>'XTR' then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('status','duplicate','order',to_jsonb(o)-'telegram_id');
 end if;
 cost:=case p_kind when 'single' then s.single_stars when 'three' then s.three_stars else s.five_stars end;
 if p_expected_amount is not null and p_expected_amount<>cost then return jsonb_build_object('status','price_changed');end if;
 insert into public.luna_reading_orders(telegram_id,request_id,kind,currency,amount,status) values(p_telegram_id,p_request_id,p_kind,'XTR',cost,'pending') returning * into o;
 return jsonb_build_object('status','ok','order',to_jsonb(o)-'telegram_id');
end $$;
alter table public.luna_reading_orders add column if not exists checkout_query_id text;
alter table public.luna_reading_orders add column if not exists checkout_accepted_at timestamptz;
-- One checkout claim per invoice. Never expire an unresolved accepted payment:
-- support must reconcile Telegram's receipt/refund before allowing a new order.
create or replace function public.luna21_claim_stars_checkout(p_telegram_id bigint,p_order_id uuid,p_currency text,p_amount integer,p_query_id text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare o public.luna_reading_orders%rowtype;
begin
 if p_currency is distinct from 'XTR' or p_query_id is null or length(p_query_id) not between 1 and 512 then return false;end if;
 if not exists(select 1 from public.luna21_settings where id and paid_readings_enabled) then return false;end if;
 select * into o from public.luna_reading_orders where id=p_order_id and telegram_id=p_telegram_id for update;
 if not found or o.currency<>'XTR' or o.amount is distinct from p_amount or o.status<>'pending' then return false;end if;
 if o.checkout_query_id is not null then return o.checkout_query_id=p_query_id;end if;
 update public.luna_reading_orders set checkout_query_id=p_query_id,checkout_accepted_at=now(),updated_at=now() where id=o.id;
 return true;
end $$;
revoke all on function public.luna21_claim_stars_checkout(bigint,uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.luna21_claim_stars_checkout(bigint,uuid,text,integer,text) to service_role;
create or replace function public.luna21_fulfill_stars_reading(p_telegram_id bigint,p_order_id uuid,p_charge_id text,p_currency text,p_amount integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.luna_reading_orders%rowtype;
begin
 if p_charge_id is null or length(p_charge_id) not between 1 and 512 or p_currency is distinct from 'XTR' then raise exception 'Invalid Stars receipt';end if;
 select * into strict o from public.luna_reading_orders where id=p_order_id and telegram_id=p_telegram_id for update;
 if o.currency<>'XTR' or o.amount is distinct from p_amount then raise exception 'Stars order mismatch';end if;
 if o.telegram_charge_id is not null then
  if o.telegram_charge_id<>p_charge_id then raise exception 'Stars charge mismatch';end if;
  return jsonb_build_object('status','duplicate','order',to_jsonb(o)-'telegram_id');
 end if;
 if o.status<>'pending' or exists(select 1 from public.payments where telegram_payment_charge_id=p_charge_id) then raise exception 'Invalid Stars order state';end if;
 update public.luna_reading_orders set status='entitled',telegram_charge_id=p_charge_id,updated_at=now() where id=o.id returning * into o;
 return jsonb_build_object('status','ok','order',to_jsonb(o)-'telegram_id');
end $$;
revoke all on function public.luna21_reward(bigint,text,uuid),public.luna21_buy_seed_reading(bigint,uuid,text,integer),public.luna21_prepare_stars_reading(bigint,uuid,text,integer),public.luna21_fulfill_stars_reading(bigint,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.luna21_reward(bigint,text,uuid),public.luna21_buy_seed_reading(bigint,uuid,text,integer),public.luna21_prepare_stars_reading(bigint,uuid,text,integer),public.luna21_fulfill_stars_reading(bigint,uuid,text,text,integer) to service_role;
-- Existing observed events only, no additional personal event log/text copies.
create or replace function public.luna21_analytics(p_days integer default 30)
returns jsonb language sql stable security invoker set search_path='' set statement_timeout='8s' as $$
 with bounds as(select (now() at time zone 'UTC')::date today,least(90,greatest(1,p_days)) days),
 activity(telegram_id,activity_day) as(
  select telegram_id,(created_at at time zone 'UTC')::date from public.luna_tarot_readings
  union select telegram_id,(created_at at time zone 'UTC')::date from public.practice_days
  union select telegram_id,(created_at at time zone 'UTC')::date from public.daily_checkins
  union select telegram_id,(created_at at time zone 'UTC')::date from public.ai_messages where role='user'
  union select telegram_id,(last_seen_at at time zone 'UTC')::date from public.users where last_seen_at is not null
 ),cohorts(telegram_id,cohort_day) as(select telegram_id,(created_at at time zone 'UTC')::date from public.users),
 retention as(select d.days,count(*) filter(where c.cohort_day+d.days<=b.today) eligible,
  count(*) filter(where c.cohort_day+d.days<=b.today and exists(select 1 from activity a where a.telegram_id=c.telegram_id and a.activity_day=c.cohort_day+d.days)) returned
  from cohorts c cross join bounds b cross join (values(1),(7),(30)) d(days) group by d.days),
 cost_types as(select coalesce(r.reading_kind,'chat') kind,count(*) requests,coalesce(sum(u.estimated_cost),0) usd
  from public.ai_usage u cross join bounds b left join public.luna_tarot_readings r on r.telegram_id=u.telegram_id and u.request_id='tarot:'||r.client_reading_id::text
  where u.created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC') group by coalesce(r.reading_kind,'chat')),
 user_costs as(select u.telegram_id,sum(u.estimated_cost) usd from public.ai_usage u cross join bounds b where u.created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC') group by u.telegram_id)
 select jsonb_build_object(
  'timezone','UTC','windowDays',b.days,'activityCoverage','Recorded events and last seen, not unrecorded historical opens',
  'dailyActiveUsers',(select count(*) from activity where activity_day=b.today),
  'dailyCardUniqueOpens',(select count(*) from public.luna_daily_cards where reading_day=b.today),
  'aiRequests',(select coalesce(sum(requests),0) from cost_types),
  'paidReadingOrders',(select count(*) from public.luna_reading_orders where status in ('entitled','consumed') and created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC')),
  'paidReadingConversion',(select count(*) filter(where status in ('entitled','consumed'))::numeric/nullif(count(*),0) from public.luna_reading_orders where created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC')),
  'premiumConversion',(select count(distinct telegram_id)::numeric/nullif((select count(*) from public.users),0) from public.payments where status='paid' and created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC')),
  'starsRevenue',(select coalesce(sum(amount_stars),0) from public.payments where status='paid' and currency='XTR' and created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC'))+(select coalesce(sum(amount),0) from public.luna_reading_orders where currency='XTR' and telegram_charge_id is not null and status in ('entitled','consumed') and created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC')),
  'seedsEarned',(select coalesce(sum(delta) filter(where delta>0),0) from public.luna_seed_ledger where created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC')),
  'seedsSpent',(select coalesce(-sum(delta) filter(where delta<0),0) from public.luna_seed_ledger where created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC')),
  'aiCostsByReadingType',(select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'requests',requests,'usd',usd) order by kind),'[]'::jsonb) from cost_types),
  'averageAiCostPerActiveAiUser',(select coalesce(avg(usd),0) from user_costs),
  'retention',(select jsonb_agg(jsonb_build_object('day',days,'eligible',eligible,'returned',returned,'rate',returned::numeric/nullif(eligible,0)) order by days) from retention),
  'ledgerCoverage','V2 only; legacy awards and garden purchases are not backfilled') from bounds b;
$$;
revoke all on function public.luna21_analytics(integer) from public,anon,authenticated;
grant execute on function public.luna21_analytics(integer) to service_role;
notify pgrst,'reload schema';commit;
-- Rollback: disable all FEATURE_* economy flags and all settings switches first;
-- revoke RPC execution if required. Retain ledgers/orders and the current balance.
-- Never replay legacy balance derivation after the v2 wallet has spent Seeds.
