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

create index if not exists idx_playback_sessions_user on public.playback_sessions(telegram_id, created_at desc);

alter table public.playback_sessions enable row level security;
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
drop policy if exists "Playback sessions are server managed" on public.playback_sessions;
create policy "Playback sessions are server managed" on public.playback_sessions
  for all using (false) with check (false);
