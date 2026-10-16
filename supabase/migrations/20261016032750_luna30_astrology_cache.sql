-- PREPARED / LOCAL TEST ONLY. No production execution or birth-data backfill.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create table if not exists public.luna30_birth_profiles (
 id uuid primary key default gen_random_uuid(),telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 subject_kind text not null check(subject_kind in ('self','other')),display_label text not null check(length(display_label) between 1 and 80),
 birth_date date not null,birth_time time,location jsonb not null check(jsonb_typeof(location)='object'),
 consent_version text not null,consented_at timestamptz not null default now(),revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(telegram_id,id)
);
create unique index if not exists luna30_birth_profiles_one_self on public.luna30_birth_profiles(telegram_id) where subject_kind='self';
create index if not exists luna30_birth_profiles_owner on public.luna30_birth_profiles(telegram_id,id);
create table if not exists public.luna30_chart_cache (
 id uuid primary key default gen_random_uuid(),telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 profile_id uuid not null,profile_revision integer not null,
 cache_key text not null check(length(cache_key)=64),engine text not null,engine_version text not null,ephemeris text not null,tzdb_version text not null,
 calculation jsonb not null check(jsonb_typeof(calculation)='object'),created_at timestamptz not null default now(),
 unique(telegram_id,cache_key),unique(telegram_id,id),foreign key(telegram_id,profile_id) references public.luna30_birth_profiles(telegram_id,id) on delete cascade
);
create table if not exists public.luna30_astrology_reports (
 id uuid primary key default gen_random_uuid(),telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 first_chart_id uuid not null,
 second_chart_id uuid,
 report_kind text not null check(report_kind in ('portrait','compatibility')),language text not null check(language in ('en','ru')),
 cache_key text not null check(length(cache_key)=64),report jsonb not null check(jsonb_typeof(report)='object'),
 model text not null,input_tokens integer not null default 0 check(input_tokens>=0),output_tokens integer not null default 0 check(output_tokens>=0),created_at timestamptz not null default now(),
 unique(telegram_id,cache_key),foreign key(telegram_id,first_chart_id) references public.luna30_chart_cache(telegram_id,id) on delete cascade,
 foreign key(telegram_id,second_chart_id) references public.luna30_chart_cache(telegram_id,id) on delete cascade,
 check((report_kind='portrait' and second_chart_id is null) or (report_kind='compatibility' and second_chart_id is not null))
);
-- Service-only Telegram access model: owner predicates are also mandatory in every backend operation.
do $$declare t text;begin foreach t in array array['luna30_birth_profiles','luna30_chart_cache','luna30_astrology_reports'] loop
 execute format('alter table public.%I enable row level security',t);execute format('alter table public.%I force row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select,insert,update,delete on public.%I to service_role',t);
end loop;end $$;
revoke update on public.luna30_chart_cache,public.luna30_astrology_reports from service_role;
-- Invalidate derived private data on birth edits; do not leave a stale chart/report discoverable.
create or replace function public.luna30_invalidate_birth_calculations() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.telegram_id<>old.telegram_id then raise exception 'Owner cannot change';end if;
 if row(new.birth_date,new.birth_time,new.location) is distinct from row(old.birth_date,old.birth_time,old.location) then
  delete from public.luna30_chart_cache where profile_id=old.id and telegram_id=old.telegram_id;
  new.revision:=old.revision+1;
 end if;
 new.updated_at:=now();return new;
end $$;
revoke all on function public.luna30_invalidate_birth_calculations() from public,anon,authenticated;
grant execute on function public.luna30_invalidate_birth_calculations() to service_role;
drop trigger if exists luna30_birth_edit on public.luna30_birth_profiles;
create trigger luna30_birth_edit before update on public.luna30_birth_profiles for each row execute function public.luna30_invalidate_birth_calculations();
commit;
-- Safe production rollback: disable astrology gates and keep private rows accessible for deletion/export.
-- Do NOT drop these tables after user data exists. Local empty-schema teardown is documented in tests.
