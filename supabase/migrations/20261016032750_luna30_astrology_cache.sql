-- PREPARED / LOCAL TEST ONLY. No production execution or birth-data backfill.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
-- Explicit dependency: use the existing personal profile, not a second identity.
do $$begin if to_regclass('public.luna_personal_profiles') is null then raise exception 'Apply the personalization foundation first';end if;end $$;
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
 if new.telegram_id<>old.telegram_id or new.subject_kind<>old.subject_kind then raise exception 'Owner and subject kind cannot change';end if;
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

-- Serialize the per-owner profile limit and reject stale calculation inserts.
create or replace function public.luna30_guard_birth_write() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_birth:'||new.telegram_id::text,0));
 if new.birth_date>current_date or new.birth_date<'1800-01-01'::date then raise exception 'Invalid birth date' using errcode='23514';end if;
 if (select count(*) from public.luna30_birth_profiles where telegram_id=new.telegram_id)>=20 then raise exception 'Birth profile limit reached' using errcode='23514';end if;
 return new;
end $$;
drop trigger if exists luna30_birth_insert on public.luna30_birth_profiles;
create trigger luna30_birth_insert before insert on public.luna30_birth_profiles for each row execute function public.luna30_guard_birth_write();
create or replace function public.luna30_guard_chart_revision() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_revision integer;
begin
 select revision into v_revision from public.luna30_birth_profiles where telegram_id=new.telegram_id and id=new.profile_id for share;
 if not found then raise exception 'Birth profile not found' using errcode='23503';end if;
 if v_revision<>new.profile_revision then raise exception 'Birth profile changed' using errcode='23514';end if;
 return new;
end $$;
drop trigger if exists luna30_chart_insert on public.luna30_chart_cache;
create trigger luna30_chart_insert before insert on public.luna30_chart_cache for each row execute function public.luna30_guard_chart_revision();

-- A verified self profile is the single source for birth fields in My Universe.
-- Editing old free-text fields invalidates verified calculations; it never turns
-- arbitrary text into trusted coordinates. No backfill of existing private data.
create or replace function public.luna30_project_self_birth() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if pg_trigger_depth()>1 then return null;end if;
 if tg_op='DELETE' then
  if old.subject_kind='self' then update public.luna_personal_profiles set birth_date=null,birth_time=null,birth_place=null,updated_at=now() where telegram_id=old.telegram_id and birth_date=old.birth_date and birth_time is not distinct from old.birth_time and birth_place=old.location->>'label';end if;
 elsif new.subject_kind='self' then
  insert into public.luna_personal_profiles(telegram_id,birth_date,birth_time,birth_place) values(new.telegram_id,new.birth_date,new.birth_time,new.location->>'label')
  on conflict(telegram_id) do update set birth_date=excluded.birth_date,birth_time=excluded.birth_time,birth_place=excluded.birth_place,updated_at=now();
 end if;
 return null;
end $$;
drop trigger if exists luna30_birth_projection on public.luna30_birth_profiles;
create trigger luna30_birth_projection after insert or update or delete on public.luna30_birth_profiles for each row execute function public.luna30_project_self_birth();
create or replace function public.luna30_invalidate_legacy_birth() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then delete from public.luna30_birth_profiles where telegram_id=old.telegram_id;return old;end if;
 if row(new.birth_date,new.birth_time,new.birth_place) is distinct from row(old.birth_date,old.birth_time,old.birth_place) then
  delete from public.luna30_birth_profiles where telegram_id=old.telegram_id and subject_kind='self' and (birth_date is distinct from new.birth_date or birth_time is distinct from new.birth_time or location->>'label' is distinct from new.birth_place);
 end if;
 return new;
end $$;
drop trigger if exists luna30_legacy_birth_edit on public.luna_personal_profiles;
create trigger luna30_legacy_birth_edit before update or delete on public.luna_personal_profiles for each row execute function public.luna30_invalidate_legacy_birth();
create or replace function public.luna30_clear_personal_profile(p_owner bigint,p_tombstone boolean) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_birth:'||p_owner::text,0));
 delete from public.luna30_birth_profiles where telegram_id=p_owner;
 if p_tombstone then
  insert into public.luna_personal_profiles(telegram_id) values(p_owner)
  on conflict(telegram_id) do update set display_name=null,interests='{}',preferences='',birth_date=null,birth_time=null,birth_place=null,ai_context_consent=false,updated_at=now();
 else delete from public.luna_personal_profiles where telegram_id=p_owner;end if;
 return true;
end $$;
do $$declare f regprocedure;begin
 foreach f in array array['public.luna30_guard_birth_write()'::regprocedure,'public.luna30_guard_chart_revision()'::regprocedure,'public.luna30_project_self_birth()'::regprocedure,'public.luna30_invalidate_legacy_birth()'::regprocedure,'public.luna30_clear_personal_profile(bigint,boolean)'::regprocedure] loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
-- Safe production rollback: disable astrology gates and keep private rows accessible for deletion/export.
-- Do NOT drop these tables after user data exists. Local empty-schema teardown is documented in tests.
