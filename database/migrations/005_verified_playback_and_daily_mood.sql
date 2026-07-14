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

alter table public.history
  add column if not exists listened_seconds integer not null default 0 check (listened_seconds >= 0),
  add column if not exists listened_ranges jsonb not null default '[]'::jsonb;

alter table public.daily_checkins
  alter column sleep_range drop not null,
  alter column available_minutes drop not null;
