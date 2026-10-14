-- Prepared only. Apply explicitly after production preflight and owner approval.
-- Telegram identities are verified by the existing BFF, not Supabase Auth UUIDs.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table if not exists public.luna_tarot_readings (
 id uuid primary key default gen_random_uuid(),
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 client_reading_id uuid not null,
 request_hash text not null check(length(request_hash)=64),
 card_id text not null check(card_id ~ '^[a-z-]{3,60}$'),
 orientation text not null check(orientation in ('upright','reversed')),
 intention text not null check(intention in ('general','love','career','growth')),
 question text not null default '' check(length(question)<=240),
 language text not null check(language in ('en','ru')),
 interpretation jsonb,
 status text not null default 'local' check(status in ('local','processing','ready','fallback','safety')),
 fallback_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(telegram_id,client_reading_id)
);
create index if not exists luna_tarot_readings_owner_created on public.luna_tarot_readings(telegram_id,created_at desc,id);
-- Separate counters/tombstones: deleting private reading text must not reset API limits.
create table if not exists public.luna_tarot_daily_usage (
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 usage_date date not null,
 used integer not null default 0 check(used>=0),
 primary key(telegram_id,usage_date)
);
create table if not exists public.luna_tarot_global_usage (
 usage_date date primary key,
 used integer not null default 0 check(used>=0)
);
create table if not exists public.luna_tarot_attempts (
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 client_reading_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(telegram_id,client_reading_id)
);
alter table public.luna_tarot_readings enable row level security;
alter table public.luna_tarot_readings force row level security;
alter table public.luna_tarot_daily_usage enable row level security;
alter table public.luna_tarot_daily_usage force row level security;
alter table public.luna_tarot_global_usage enable row level security;
alter table public.luna_tarot_global_usage force row level security;
alter table public.luna_tarot_attempts enable row level security;
alter table public.luna_tarot_attempts force row level security;
revoke all on public.luna_tarot_readings,public.luna_tarot_daily_usage,public.luna_tarot_global_usage,public.luna_tarot_attempts from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.luna_tarot_readings to service_role;
grant select,insert,update on public.luna_tarot_daily_usage,public.luna_tarot_global_usage to service_role;
grant select,insert on public.luna_tarot_attempts to service_role;

create or replace function public.reserve_luna_tarot_reading(
 p_telegram_id bigint,p_client_reading_id uuid,p_request_hash text,p_card_id text,
 p_orientation text,p_intention text,p_question text,p_language text,
 p_generate boolean,p_daily_limit integer,p_global_limit integer
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_reading public.luna_tarot_readings%rowtype;
 v_day date := (now() at time zone 'UTC')::date;
 v_user_used integer;v_global_used integer;
begin
 -- Consistent lock order serializes even simultaneous requests/deletions per owner.
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna_tarot:'||p_telegram_id::text,0));
 if exists(select 1 from public.luna_tarot_attempts a where a.telegram_id=p_telegram_id and a.client_reading_id=p_client_reading_id)
 and not exists(select 1 from public.luna_tarot_readings r where r.telegram_id=p_telegram_id and r.client_reading_id=p_client_reading_id)
 then return jsonb_build_object('status','deleted','acquired',false); end if;
 insert into public.luna_tarot_readings(telegram_id,client_reading_id,request_hash,card_id,orientation,intention,question,language)
 values(p_telegram_id,p_client_reading_id,p_request_hash,p_card_id,p_orientation,p_intention,p_question,p_language)
 on conflict(telegram_id,client_reading_id) do nothing;
 select * into v_reading from public.luna_tarot_readings r where r.telegram_id=p_telegram_id and r.client_reading_id=p_client_reading_id for update;
 if v_reading.request_hash<>p_request_hash then return jsonb_build_object('status','conflict','acquired',false); end if;
 if not p_generate or v_reading.status<>'local' then return jsonb_build_object('status',v_reading.status,'acquired',false,'reading',to_jsonb(v_reading)-'telegram_id'-'request_hash'); end if;
 insert into public.luna_tarot_global_usage(usage_date) values(v_day) on conflict do nothing;
 select g.used into v_global_used from public.luna_tarot_global_usage g where g.usage_date=v_day for update;
 insert into public.luna_tarot_daily_usage(telegram_id,usage_date) values(p_telegram_id,v_day) on conflict do nothing;
 select u.used into v_user_used from public.luna_tarot_daily_usage u where u.telegram_id=p_telegram_id and u.usage_date=v_day for update;
 if v_user_used>=greatest(0,p_daily_limit) or v_global_used>=greatest(0,p_global_limit) then
  return jsonb_build_object('status','limit','acquired',false,'reading',to_jsonb(v_reading)-'telegram_id'-'request_hash');
 end if;
 insert into public.luna_tarot_attempts(telegram_id,client_reading_id) values(p_telegram_id,p_client_reading_id) on conflict do nothing;
 if not found then return jsonb_build_object('status','already_attempted','acquired',false); end if;
 update public.luna_tarot_daily_usage set used=used+1 where telegram_id=p_telegram_id and usage_date=v_day;
 update public.luna_tarot_global_usage set used=used+1 where usage_date=v_day;
 update public.luna_tarot_readings set status='processing',updated_at=now() where id=v_reading.id returning * into v_reading;
 return jsonb_build_object('status','processing','acquired',true,'reading',to_jsonb(v_reading)-'telegram_id'-'request_hash');
end $$;
revoke all on function public.reserve_luna_tarot_reading(bigint,uuid,text,text,text,text,text,text,boolean,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_luna_tarot_reading(bigint,uuid,text,text,text,text,text,text,boolean,integer,integer) to service_role;
notify pgrst,'reload schema';
commit;
-- Safe rollback: disable FEATURE_TAROT_AI, FEATURE_TAROT_HISTORY and corresponding
-- frontend flags; drain in-flight requests; revoke RPC execution from service_role.
-- Keep tables, saved readings and counters. NEVER restore stale balances/data snapshots.
-- Reapply this migration to restore the explicit privileges after investigation.
