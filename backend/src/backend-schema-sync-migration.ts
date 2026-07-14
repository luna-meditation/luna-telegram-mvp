import { lunaAiRpcMigration } from './luna-ai-rpc-migration.js';

export const backendSchemaSyncMigration = `
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

${lunaAiRpcMigration}
`;
