-- Staging compatibility only. Production already has these canonical Luna 2.1 objects.
-- Required by the existing 3/5-card reservation RPC; no wallet or reward functions.
-- All monetization switches stay FALSE. No existing balance or price is updated.
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
create table if not exists public.luna_reading_orders (
 id uuid primary key default gen_random_uuid(),telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 request_id uuid not null,kind text not null check(kind in ('single','three','five')),currency text not null check(currency in ('SEEDS','XTR')),
 amount integer not null check(amount>0),status text not null check(status in ('pending','entitled','consumed','refunded')),
 client_reading_id uuid,telegram_charge_id text unique,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(telegram_id,request_id)
);
create table if not exists public.luna_premium_reading_usage (
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,usage_day date not null,kind text not null check(kind in ('three','five')),
 client_reading_id uuid not null,created_at timestamptz not null default now(),primary key(telegram_id,client_reading_id)
);
insert into public.luna21_settings(id) values(true) on conflict do nothing;
do $$ declare t text;begin foreach t in array array['luna21_settings','luna_reading_orders','luna_premium_reading_usage'] loop execute format('alter table public.%I enable row level security',t);execute format('alter table public.%I force row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);end loop;end $$;
grant select on public.luna21_settings to service_role;
grant select,insert,update,delete on public.luna_reading_orders to service_role;
grant select,insert on public.luna_premium_reading_usage to service_role;
notify pgrst,'reload schema';commit;
-- Rollback: disable FEATURE_TAROT_SPREADS / AI_CENTRAL_EXPERIENCE on staging;
-- keep additive tables and saved readings. Never reset counters or balances.
