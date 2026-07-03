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
  completed boolean not null default false,
  unique (telegram_id, meditation_id)
);

create table if not exists public.streaks (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique references public.users(telegram_id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_completed_date date,
  reward_7 boolean not null default false,
  reward_14 boolean not null default false,
  reward_30 boolean not null default false,
  reward_100 boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.breath_sessions (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  mode text not null check (mode in ('calm', 'box', 'reset')),
  duration_seconds integer not null check (duration_seconds > 0),
  breath_count integer not null default 1 check (breath_count > 0),
  completed_at timestamptz not null default now()
);

create index if not exists idx_meditations_category on public.meditations(category);
create index if not exists idx_meditations_mood on public.meditations(mood);
create index if not exists idx_meditations_created_at on public.meditations(created_at desc);
create index if not exists idx_meditations_play_count on public.meditations(play_count desc);
create index if not exists idx_favorites_telegram_id on public.favorites(telegram_id);
create index if not exists idx_history_telegram_id on public.history(telegram_id);
create index if not exists idx_history_last_played on public.history(last_played desc);
create index if not exists idx_breath_sessions_telegram_completed on public.breath_sessions(telegram_id, completed_at desc);

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

alter table public.categories enable row level security;
alter table public.meditations enable row level security;
alter table public.favorites enable row level security;
alter table public.history enable row level security;
alter table public.streaks enable row level security;
alter table public.breath_sessions enable row level security;

drop policy if exists "Categories are readable" on public.categories;
drop policy if exists "Meditations are readable" on public.meditations;
drop policy if exists "Meditation storage is readable" on storage.objects;

create policy "Categories are readable" on public.categories
  for select using (true);

create policy "Meditations are readable" on public.meditations
  for select using (true);

create policy "Meditation storage is readable" on storage.objects
  for select using (bucket_id = 'meditations');

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
