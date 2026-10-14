-- Local review only; no existing users/onboarding/entitlements are changed.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table if not exists public.luna_personal_profiles (
 telegram_id bigint primary key references public.users(telegram_id) on delete cascade,
 display_name text check(char_length(display_name)<=60),
 interests text[] not null default '{}' check(interests <@ array['tarot','astrology','wellbeing','meditation']::text[] and cardinality(interests)<=4),
 preferences text not null default '' check(char_length(preferences)<=500),
 birth_date date,
 birth_time time,
 birth_place text check(char_length(birth_place)<=120),
 ai_context_consent boolean not null default false,
 updated_at timestamptz not null default now()
);
-- Upgrade any earlier development-only version without replacing private rows.
alter table public.luna_personal_profiles add column if not exists display_name text check(char_length(display_name)<=60);
alter table public.luna_personal_profiles enable row level security;
alter table public.luna_personal_profiles force row level security;
revoke all on public.luna_personal_profiles from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.luna_personal_profiles to service_role;
-- Telegram identities are NOT Supabase Auth UUIDs. Access is through the verified
-- Telegram BFF only, with mandatory telegram_id predicates; direct client access is denied.
notify pgrst,'reload schema';
commit;
-- Rollback: disable FEATURE_PERSONALIZATION and VITE_FEATURE_PERSONALIZATION.
-- Revoke service_role privileges on this new table if necessary; retain private rows.
-- Do not drop the table or alter users, subscriptions, balances, or payment records.
