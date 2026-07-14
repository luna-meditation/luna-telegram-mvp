-- Additive production schema synchronization for fields used by the current backend.
-- Safe to rerun. It never drops tables or deletes user data.

create table if not exists public.history (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  meditation_id uuid not null references public.meditations(id) on delete cascade,
  last_played timestamptz not null default now(),
  play_count integer not null default 0,
  completion_percent numeric(5,2) not null default 0,
  last_position integer not null default 0,
  listened_seconds integer not null default 0,
  listened_ranges jsonb not null default '[]'::jsonb,
  seed_awarded_position integer not null default 0,
  completion_seed_bonus_awarded boolean not null default false,
  completed boolean not null default false,
  unique (telegram_id, meditation_id)
);

alter table public.history
  add column if not exists last_played timestamptz default now(),
  add column if not exists play_count integer default 0,
  add column if not exists completion_percent numeric(5,2) default 0,
  add column if not exists last_position integer default 0,
  add column if not exists listened_seconds integer default 0,
  add column if not exists listened_ranges jsonb default '[]'::jsonb,
  add column if not exists seed_awarded_position integer default 0,
  add column if not exists completion_seed_bonus_awarded boolean default false,
  add column if not exists completed boolean default false;

create table if not exists public.playback_sessions (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  meditation_id uuid not null references public.meditations(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  listened_seconds integer not null default 0,
  listened_ranges jsonb not null default '[]'::jsonb,
  local_date date default current_date,
  practice_day_recorded boolean not null default false,
  last_position integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.playback_sessions
  add column if not exists started_at timestamptz default now(),
  add column if not exists last_heartbeat_at timestamptz default now(),
  add column if not exists listened_seconds integer default 0,
  add column if not exists listened_ranges jsonb default '[]'::jsonb,
  add column if not exists local_date date,
  add column if not exists practice_day_recorded boolean default false,
  add column if not exists last_position integer default 0,
  add column if not exists completed_at timestamptz,
  add column if not exists created_at timestamptz default now();

update public.playback_sessions
set local_date = coalesce(local_date, (created_at at time zone 'UTC')::date, current_date)
where local_date is null;

alter table public.playback_sessions
  alter column local_date set default current_date;

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  sleep_range text default '6_8' check (sleep_range in ('less_than_4', '4_6', '6_8', '8_plus')),
  mood text not null check (mood in ('calm', 'stressed', 'tired', 'anxious', 'focused', 'low_energy')),
  available_minutes text check (available_minutes in ('3', '5', '10', '15_plus')),
  local_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (telegram_id, local_date)
);

alter table public.daily_checkins
  add column if not exists sleep_range text,
  add column if not exists mood text,
  add column if not exists available_minutes text,
  add column if not exists local_date date default current_date,
  add column if not exists created_at timestamptz default now();

alter table public.daily_checkins
  alter column sleep_range set default '6_8',
  alter column sleep_range drop not null,
  alter column available_minutes drop not null;

create index if not exists idx_history_telegram_id on public.history(telegram_id);
create index if not exists idx_history_last_played on public.history(last_played desc);
create index if not exists idx_playback_sessions_user on public.playback_sessions(telegram_id, created_at desc);
create index if not exists idx_daily_checkins_telegram_date on public.daily_checkins(telegram_id, local_date desc);

-- The RPC is repeated here so this single SQL file is sufficient for a manual production repair.
create table if not exists public.ai_chat_requests (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  client_request_id text not null,
  conversation_id uuid references public.ai_conversations(id) on delete cascade,
  user_message_id uuid references public.ai_messages(id) on delete set null,
  assistant_message_id uuid references public.ai_messages(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed_retryable', 'failed_non_retryable', 'quota_exhausted')),
  quota_charged boolean not null default false,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error_code text,
  recommendation_id uuid references public.meditations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (telegram_id, client_request_id)
);

create index if not exists idx_ai_chat_requests_user_daily on public.ai_chat_requests(telegram_id, created_at desc) where quota_charged;
alter table public.ai_chat_requests enable row level security;

create or replace function public.reserve_luna_chat_request(
  p_telegram_id bigint,
  p_client_request_id text,
  p_daily_limit integer,
  p_conversation_id uuid default null
)
returns table(status text, quota_charged boolean, remaining integer, attempt_count integer, acquired boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing public.ai_chat_requests%rowtype;
  used_count integer;
  had_existing boolean := false;
begin
  if p_telegram_id is null then
    raise exception using errcode = '22004', message = 'Telegram user id is required.';
  end if;
  if p_client_request_id is null or btrim(p_client_request_id) = '' then
    raise exception using errcode = '22004', message = 'Client request id is required.';
  end if;
  if p_daily_limit is null or p_daily_limit < 0 then
    raise exception using errcode = '22023', message = 'Daily limit must be a non-negative integer.';
  end if;
  if not exists (select 1 from public.users where telegram_id = p_telegram_id) then
    raise exception using errcode = '42501', message = 'Telegram user is not recognized.';
  end if;
  if p_conversation_id is not null and not exists (
    select 1 from public.ai_conversations where id = p_conversation_id and telegram_id = p_telegram_id
  ) then
    raise exception using errcode = '42501', message = 'Conversation ownership validation failed.';
  end if;

  perform pg_advisory_xact_lock(p_telegram_id);
  select * into existing from public.ai_chat_requests
  where telegram_id = p_telegram_id and client_request_id = p_client_request_id for update;
  had_existing := found;

  if had_existing and (existing.status = 'completed' or (existing.status = 'processing' and existing.updated_at > now() - interval '3 minutes')) then
    return query select existing.status, existing.quota_charged,
      greatest(0, p_daily_limit - (select count(*)::integer from public.ai_chat_requests
        where telegram_id = p_telegram_id and quota_charged
          and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc')),
      existing.attempt_count, false;
    return;
  end if;

  select count(*)::integer into used_count from public.ai_chat_requests
  where telegram_id = p_telegram_id and quota_charged
    and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if used_count >= p_daily_limit and (not had_existing or not existing.quota_charged) then
    insert into public.ai_chat_requests (telegram_id, client_request_id, conversation_id, status, error_code)
    values (p_telegram_id, p_client_request_id, p_conversation_id, 'quota_exhausted', 'quota_exhausted')
    on conflict (telegram_id, client_request_id) do update set
      conversation_id = coalesce(excluded.conversation_id, public.ai_chat_requests.conversation_id),
      status = 'quota_exhausted', error_code = 'quota_exhausted', updated_at = now();
    return query select 'quota_exhausted'::text, false, 0, coalesce(existing.attempt_count, 0), false;
    return;
  end if;

  insert into public.ai_chat_requests (telegram_id, client_request_id, conversation_id, status, quota_charged, attempt_count, error_code, updated_at)
  values (p_telegram_id, p_client_request_id, p_conversation_id, 'processing', true, 1, null, now())
  on conflict (telegram_id, client_request_id) do update set
    conversation_id = coalesce(excluded.conversation_id, public.ai_chat_requests.conversation_id),
    status = 'processing', quota_charged = true,
    attempt_count = public.ai_chat_requests.attempt_count + 1, error_code = null, updated_at = now()
  returning * into existing;

  select count(*)::integer into used_count from public.ai_chat_requests
  where telegram_id = p_telegram_id and quota_charged
    and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  return query select existing.status, existing.quota_charged, greatest(0, p_daily_limit - used_count), existing.attempt_count, true;
end;
$$;

revoke all on function public.reserve_luna_chat_request(bigint, text, integer, uuid) from public;
grant execute on function public.reserve_luna_chat_request(bigint, text, integer, uuid) to service_role;

create or replace function public.increment_meditation_play_count(meditation_uuid uuid)
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.meditations set play_count = play_count + 1, updated_at = now() where id = meditation_uuid;
$$;
revoke all on function public.increment_meditation_play_count(uuid) from public;
grant execute on function public.increment_meditation_play_count(uuid) to service_role;

notify pgrst, 'reload schema';
