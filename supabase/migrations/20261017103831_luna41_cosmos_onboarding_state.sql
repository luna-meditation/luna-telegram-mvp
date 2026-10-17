-- Additive, service-only Telegram backend metadata. No answers, personal facts,
-- birth data or commercial state is duplicated here.
begin;
create table if not exists public.luna41_cosmos_onboarding (
 telegram_id bigint primary key references public.users(telegram_id) on delete cascade,
 skipped text[] not null default '{}',
 revision integer not null default 1 check (revision > 0),
 last_request_id uuid not null,
 updated_at timestamptz not null default now(),
 constraint luna41_cosmos_skips_valid check (
  cardinality(skipped) <= 10 and skipped <@ array['name','interests','relationships','career','money','growth','wellbeing','social','lifestyle','dreams']::text[]
 )
);
alter table public.luna41_cosmos_onboarding enable row level security;
alter table public.luna41_cosmos_onboarding force row level security;
revoke all on public.luna41_cosmos_onboarding from public,anon,authenticated;
grant select,insert,update,delete on public.luna41_cosmos_onboarding to service_role;
comment on table public.luna41_cosmos_onboarding is 'Luna 4.1 optional onboarding skip state. Only Telegram-authenticated backend; facts remain in existing memory/profile tables.';
commit;

-- Safe application rollback: FEATURE_COSMOS_V2=false and VITE_FEATURE_COSMOS_V2=false.
-- Keep this additive table and saved progress. No existing object needs reversal.
-- If access must be quarantined, REVOKE ALL ON public.luna41_cosmos_onboarding FROM service_role;
-- reapply this migration to restore scoped grants. Do not drop user state.
