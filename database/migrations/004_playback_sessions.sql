create table if not exists public.playback_sessions (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  meditation_id uuid not null references public.meditations(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  listened_seconds integer not null default 0 check (listened_seconds >= 0),
  last_position integer not null default 0 check (last_position >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_playback_sessions_user on public.playback_sessions(telegram_id, created_at desc);

alter table public.playback_sessions enable row level security;
drop policy if exists "Playback sessions are server managed" on public.playback_sessions;
create policy "Playback sessions are server managed" on public.playback_sessions
  for all using (false) with check (false);
