create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meditations',
  'meditations',
  true,
  104857600,
  array['audio/mpeg', 'audio/mp3', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  username text,
  first_name text,
  last_name text,
  language_code text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active_until timestamptz,
  lifetime_access boolean not null default false,
  free_used boolean not null default false
);

alter table public.users
  add column if not exists avatar_url text,
  add column if not exists ai_memory_enabled boolean not null default true,
  add column if not exists profile_goals text[] not null default '{}'::text[],
  add column if not exists notification_preferences jsonb not null default jsonb_build_object(
    'dailyReminder', false,
    'newContent', false,
    'reminderTime', '21:00',
    'timezone', 'UTC'
  );

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  plan text not null check (plan in ('monthly', 'lifetime')),
  amount_stars integer not null,
  currency text not null default 'XTR',
  telegram_payment_charge_id text,
  provider_payment_charge_id text,
  status text not null default 'paid',
  created_at timestamptz not null default now()
);

create table if not exists public.practices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null,
  description text not null,
  duration text not null,
  access_level text not null check (access_level in ('free', 'premium')),
  audio_url text not null,
  cover_image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  practice_id uuid not null references public.practices(id) on delete cascade,
  completed_at timestamptz not null default now(),
  mood_before text,
  mood_after text
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.meditations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  category text not null references public.categories(slug) on update cascade,
  duration integer not null check (duration > 0),
  cover_image text not null,
  audio_file text not null,
  premium boolean not null default false,
  mood text not null check (mood in ('Calm', 'Stressed', 'Focused', 'Tired', 'Anxious')),
  play_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meditations
  add column if not exists subtitle text not null default '',
  add column if not exists published boolean not null default false,
  add column if not exists translations jsonb not null default '{}'::jsonb;

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  meditation_id uuid not null references public.meditations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (telegram_id, meditation_id)
);

create table if not exists public.history (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  meditation_id uuid not null references public.meditations(id) on delete cascade,
  last_played timestamptz not null default now(),
  play_count integer not null default 0,
  completion_percent numeric(5,2) not null default 0 check (completion_percent >= 0 and completion_percent <= 100),
  last_position integer not null default 0 check (last_position >= 0),
  listened_seconds integer not null default 0 check (listened_seconds >= 0),
  listened_ranges jsonb not null default '[]'::jsonb,
  seed_awarded_position integer not null default 0 check (seed_awarded_position >= 0),
  completion_seed_bonus_awarded boolean not null default false,
  completed boolean not null default false,
  unique (telegram_id, meditation_id)
);

create table if not exists public.playback_sessions (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  meditation_id uuid not null references public.meditations(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  listened_seconds integer not null default 0 check (listened_seconds >= 0),
  listened_ranges jsonb not null default '[]'::jsonb,
  local_date date not null default current_date,
  practice_day_recorded boolean not null default false,
  last_position integer not null default 0 check (last_position >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.streaks (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique references public.users(telegram_id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_completed_date date,
  freeze_count integer not null default 1 check (freeze_count >= 0),
  last_freeze_used date,
  last_clean_week_awarded date,
  reward_7 boolean not null default false,
  reward_14 boolean not null default false,
  reward_30 boolean not null default false,
  reward_100 boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.streaks
  add column if not exists freeze_count integer not null default 1 check (freeze_count >= 0),
  add column if not exists last_freeze_used date,
  add column if not exists last_clean_week_awarded date;

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  progress integer not null default 100 check (progress >= 0 and progress <= 100),
  metadata jsonb not null default '{}'::jsonb,
  unique (telegram_id, achievement_id)
);

create table if not exists public.practice_days (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  local_date date not null,
  source text not null check (source in ('meditation', 'breath', 'scene')),
  minutes integer not null default 0 check (minutes >= 0),
  sessions integer not null default 1 check (sessions >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (telegram_id, local_date, source)
);

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  sleep_range text check (sleep_range in ('less_than_4', '4_6', '6_8', '8_plus')),
  mood text not null check (mood in ('calm', 'stressed', 'tired', 'anxious', 'focused', 'low_energy')),
  available_minutes text check (available_minutes in ('3', '5', '10', '15_plus')),
  local_date date not null,
  created_at timestamptz not null default now(),
  unique (telegram_id, local_date)
);

create table if not exists public.breath_sessions (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  mode text not null check (mode in ('calm', 'box', 'reset')),
  duration_seconds integer not null check (duration_seconds > 0),
  breath_count integer not null default 1 check (breath_count > 0),
  completed_at timestamptz not null default now()
);

create table if not exists public.moon_gardens (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique references public.users(telegram_id) on delete cascade,
  moon_seeds_available integer not null default 0 check (moon_seeds_available >= 0),
  moon_seeds_earned_total integer not null default 0 check (moon_seeds_earned_total >= 0),
  planted_garden_elements jsonb not null default '[]'::jsonb,
  last_moon_seed_earned_at timestamptz,
  premium_bonus_granted_at timestamptz,
  garden_level integer not null default 0 check (garden_level >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  title text not null default '',
  language text not null default 'en' check (language in ('en', 'ru')),
  status text not null default 'active' check (status in ('active', 'archived')),
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null check (char_length(content) > 0),
  message_type text not null default 'text',
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_memories (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  memory_key text not null,
  memory_value text not null,
  category text not null,
  confidence numeric(4,3) not null default 0.8 check (confidence >= 0 and confidence <= 1),
  source_conversation_id uuid references public.ai_conversations(id) on delete set null,
  source_message_id uuid references public.ai_messages(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (telegram_id, category, memory_key)
);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  request_id text,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost numeric(12,6),
  request_status text not null,
  latency_ms integer,
  error_class text,
  created_at timestamptz not null default now()
);

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

alter table public.ai_usage add column if not exists estimated_cost numeric(12,6);

alter table public.history
  add column if not exists seed_awarded_position integer not null default 0 check (seed_awarded_position >= 0),
  add column if not exists completion_seed_bonus_awarded boolean not null default false,
  add column if not exists listened_seconds integer not null default 0 check (listened_seconds >= 0),
  add column if not exists listened_ranges jsonb not null default '[]'::jsonb;

alter table public.playback_sessions
  add column if not exists listened_ranges jsonb not null default '[]'::jsonb,
  add column if not exists local_date date,
  add column if not exists practice_day_recorded boolean not null default false;

update public.playback_sessions
set local_date = (created_at at time zone 'UTC')::date
where local_date is null;

alter table public.playback_sessions
  alter column local_date set default current_date,
  alter column local_date set not null;

alter table public.daily_checkins
  alter column sleep_range drop not null,
  alter column available_minutes drop not null;

alter table public.moon_gardens
  add column if not exists premium_bonus_granted_at timestamptz;

alter table public.moon_gardens
  alter column garden_level set default 0;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.moon_gardens'::regclass
      and conname = 'moon_gardens_garden_level_check'
  ) then
    alter table public.moon_gardens drop constraint moon_gardens_garden_level_check;
  end if;
end $$;

alter table public.moon_gardens
  add constraint moon_gardens_garden_level_check check (garden_level >= 0);

create index if not exists idx_users_telegram_id on public.users(telegram_id);
create index if not exists idx_payments_telegram_id on public.payments(telegram_id);
create unique index if not exists idx_payments_telegram_charge_unique
  on public.payments(telegram_payment_charge_id)
  where telegram_payment_charge_id is not null;
create unique index if not exists idx_payments_provider_charge_unique
  on public.payments(provider_payment_charge_id)
  where provider_payment_charge_id is not null;
create index if not exists idx_progress_telegram_id on public.progress(telegram_id);
create index if not exists idx_meditations_category on public.meditations(category);
create index if not exists idx_meditations_mood on public.meditations(mood);
create index if not exists idx_meditations_created_at on public.meditations(created_at desc);
create index if not exists idx_meditations_play_count on public.meditations(play_count desc);
create index if not exists idx_favorites_telegram_id on public.favorites(telegram_id);
create index if not exists idx_history_telegram_id on public.history(telegram_id);
create index if not exists idx_history_last_played on public.history(last_played desc);
create index if not exists idx_daily_checkins_telegram_date on public.daily_checkins(telegram_id, local_date desc);
create index if not exists idx_breath_sessions_telegram_completed on public.breath_sessions(telegram_id, completed_at desc);
create index if not exists idx_moon_gardens_telegram_id on public.moon_gardens(telegram_id);
create index if not exists idx_achievements_telegram_id on public.achievements(telegram_id);
create index if not exists idx_practice_days_telegram_date on public.practice_days(telegram_id, local_date desc);
create index if not exists idx_ai_conversations_user_recent on public.ai_conversations(telegram_id, last_message_at desc);
create index if not exists idx_ai_messages_conversation_recent on public.ai_messages(conversation_id, created_at desc);
drop index if exists public.idx_ai_messages_request_id;
create unique index if not exists idx_ai_messages_request_role on public.ai_messages(conversation_id, request_id, role) where request_id is not null;
create index if not exists idx_user_memories_active on public.user_memories(telegram_id, is_active, updated_at desc);
create index if not exists idx_ai_usage_user_daily on public.ai_usage(telegram_id, created_at desc);
drop index if exists public.idx_ai_usage_request_id;
create unique index if not exists idx_ai_usage_request_id on public.ai_usage(telegram_id, request_id);
create index if not exists idx_ai_chat_requests_user_daily on public.ai_chat_requests(telegram_id, created_at desc) where quota_charged;

create or replace function public.reserve_luna_chat_request(
  p_telegram_id bigint, p_client_request_id text, p_daily_limit integer, p_conversation_id uuid default null
) returns table(status text, quota_charged boolean, remaining integer, attempt_count integer, acquired boolean)
language plpgsql security definer set search_path = public as $$
declare
  existing public.ai_chat_requests%rowtype;
  used_count integer;
  had_existing boolean := false;
begin
  perform pg_advisory_xact_lock(p_telegram_id);
  select * into existing from public.ai_chat_requests
    where telegram_id = p_telegram_id and client_request_id = p_client_request_id for update;
  had_existing := found;
  if had_existing and (existing.status = 'completed' or (existing.status = 'processing' and existing.updated_at > now() - interval '3 minutes')) then
    return query select existing.status, existing.quota_charged,
      greatest(0, p_daily_limit - (select count(*)::integer from public.ai_chat_requests where telegram_id = p_telegram_id and quota_charged and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc')),
      existing.attempt_count, false;
    return;
  end if;
  select count(*)::integer into used_count from public.ai_chat_requests
    where telegram_id = p_telegram_id and quota_charged
      and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if used_count >= p_daily_limit and (not had_existing or not existing.quota_charged) then
    insert into public.ai_chat_requests (telegram_id, client_request_id, conversation_id, status, error_code)
    values (p_telegram_id, p_client_request_id, p_conversation_id, 'quota_exhausted', 'quota_exhausted')
    on conflict (telegram_id, client_request_id) do update set status = 'quota_exhausted', error_code = 'quota_exhausted', updated_at = now();
    return query select 'quota_exhausted'::text, false, 0, coalesce(existing.attempt_count, 0), false;
    return;
  end if;
  insert into public.ai_chat_requests (telegram_id, client_request_id, conversation_id, status, quota_charged, attempt_count, error_code, updated_at)
  values (p_telegram_id, p_client_request_id, p_conversation_id, 'processing', true, 1, null, now())
  on conflict (telegram_id, client_request_id) do update set
    conversation_id = coalesce(excluded.conversation_id, public.ai_chat_requests.conversation_id), status = 'processing', quota_charged = true,
    attempt_count = public.ai_chat_requests.attempt_count + 1, error_code = null, updated_at = now()
  returning * into existing;
  select count(*)::integer into used_count from public.ai_chat_requests
    where telegram_id = p_telegram_id and quota_charged
      and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  return query select existing.status, existing.quota_charged, greatest(0, p_daily_limit - used_count), existing.attempt_count, true;
end; $$;
revoke all on function public.reserve_luna_chat_request(bigint, text, integer, uuid) from public;
grant execute on function public.reserve_luna_chat_request(bigint, text, integer, uuid) to service_role;

create or replace function public.increment_meditation_play_count(meditation_uuid uuid)
returns void
language sql
security definer
as $$
  update public.meditations
  set play_count = play_count + 1,
      updated_at = now()
  where id = meditation_uuid;
$$;

update public.meditations
set translations = jsonb_strip_nulls(jsonb_build_object(
  'en', jsonb_build_object(
    'title', title,
    'subtitle', subtitle,
    'description', description,
    'audioUrl', audio_file
  ),
  'ru', case
    when lower(title) like '%deep%sleep%' then jsonb_build_object(
      'title', 'Глубокий сон',
      'subtitle', 'Отпусти этот день',
      'description', 'Мягкая медитация для расслабления, восстановления и спокойного перехода ко сну.',
      'audioUrl', null
    )
    when lower(title) like '%anxiety%' then jsonb_build_object(
      'title', 'Спокойствие при тревоге',
      'subtitle', 'Успокой мысли',
      'description', 'Мягкая практика, которая помогает замедлиться, вернуться к дыханию и почувствовать больше внутренней опоры.',
      'audioUrl', null
    )
    else null
  end
))
where translations = '{}'::jsonb or translations is null;

alter table public.users enable row level security;
alter table public.payments enable row level security;
alter table public.practices enable row level security;
alter table public.progress enable row level security;
alter table public.categories enable row level security;
alter table public.meditations enable row level security;
alter table public.favorites enable row level security;
alter table public.history enable row level security;
alter table public.playback_sessions enable row level security;
alter table public.streaks enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.breath_sessions enable row level security;
alter table public.moon_gardens enable row level security;
alter table public.achievements enable row level security;
alter table public.practice_days enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.user_memories enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_chat_requests enable row level security;

drop policy if exists "Practices are readable" on public.practices;
drop policy if exists "Categories are readable" on public.categories;
drop policy if exists "Meditations are readable" on public.meditations;
drop policy if exists "Playback sessions are server managed" on public.playback_sessions;
drop policy if exists "Meditation storage is readable" on storage.objects;
drop policy if exists "Avatar storage is readable" on storage.objects;

create policy "Practices are readable" on public.practices
  for select using (true);

create policy "Categories are readable" on public.categories
  for select using (true);

create policy "Meditations are readable" on public.meditations
  for select using (true);

create policy "Playback sessions are server managed" on public.playback_sessions
  for all using (false) with check (false);

create policy "Meditation storage is readable" on storage.objects
  for select using (bucket_id = 'meditations');

create policy "Avatar storage is readable" on storage.objects
  for select using (bucket_id = 'avatars');

insert into public.categories (name, slug, sort_order)
values
  ('Sleep', 'sleep', 10),
  ('Stress', 'stress', 20),
  ('Anxiety', 'anxiety', 30),
  ('Focus', 'focus', 40),
  ('Morning', 'morning', 50),
  ('Evening', 'evening', 60),
  ('Breathing', 'breathing', 70),
  ('Quick Reset', 'quick-reset', 80),
  ('Deep Relaxation', 'deep-relaxation', 90),
  ('Premium', 'premium', 100)
on conflict (slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order;
