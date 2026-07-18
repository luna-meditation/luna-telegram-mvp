export const productRefinementMigration = `
alter table public.users
  alter column notification_preferences set default jsonb_build_object(
    'remindersEnabled', false,
    'reminderTypes', jsonb_build_array('daily'),
    'reminderTime', '21:00',
    'timezone', 'UTC',
    'consentedAt', null,
    'dailyReminder', false,
    'newContent', false
  );

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  category text not null check (category in ('problem', 'feedback', 'payment', 'contact', 'account_deletion')),
  message text not null check (char_length(message) between 10 and 4000),
  contact text,
  app_version text not null default 'unknown',
  build_sha text not null default 'unknown',
  platform text not null default 'unknown',
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  reminder_type text not null check (reminder_type in ('daily', 'morning', 'evening', 'streak_risk', 'inactivity', 'weekly_summary')),
  local_date date not null,
  idempotency_key text not null unique,
  status text not null default 'processing' check (status in ('processing', 'sent', 'failed')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_requests_status_created
  on public.support_requests(status, created_at desc);
create index if not exists idx_support_requests_telegram_created
  on public.support_requests(telegram_id, created_at desc);
create index if not exists idx_reminder_deliveries_user_date
  on public.reminder_deliveries(telegram_id, local_date desc);
create index if not exists idx_reminder_deliveries_status_created
  on public.reminder_deliveries(status, created_at desc);

alter table public.support_requests enable row level security;
alter table public.reminder_deliveries enable row level security;

revoke all on table public.support_requests from anon, authenticated;
revoke all on table public.reminder_deliveries from anon, authenticated;
grant select, insert, update, delete on table public.support_requests to service_role;
grant select, insert, update, delete on table public.reminder_deliveries to service_role;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.breath_sessions'::regclass
      and conname = 'breath_sessions_mode_check'
  ) then
    alter table public.breath_sessions drop constraint breath_sessions_mode_check;
  end if;
end $$;

alter table public.breath_sessions
  add constraint breath_sessions_mode_check
  check (mode in ('calm', 'box', '478', 'coherent', 'triangle', 'sigh', 'anxiety_reset', 'sleep', 'morning_energy'));

notify pgrst, 'reload schema';
`;
