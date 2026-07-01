create extension if not exists pgcrypto;

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

create index if not exists idx_users_telegram_id on public.users(telegram_id);
create index if not exists idx_payments_telegram_id on public.payments(telegram_id);
create index if not exists idx_progress_telegram_id on public.progress(telegram_id);

alter table public.users enable row level security;
alter table public.payments enable row level security;
alter table public.practices enable row level security;
alter table public.progress enable row level security;

drop policy if exists "Practices are readable" on public.practices;

create policy "Practices are readable" on public.practices
  for select using (true);

insert into public.practices (title, type, description, duration, access_level, audio_url, cover_image_url)
values
  ('5-Minute Calm Reset', 'Meditation + Breathwork', 'A gentle reset to soften tension and return to your breath.', '5 min', 'free', 'https://example.com/audio/luna-calm-reset.mp3', 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80'),
  ('Sleep Deeply Tonight', 'Sleep Meditation', 'A cinematic wind-down for deeper rest and a quieter mind.', '18 min', 'premium', 'https://example.com/audio/luna-sleep-deeply.mp3', 'https://images.unsplash.com/photo-1511295742362-92c96b1cf484?auto=format&fit=crop&w=1200&q=80'),
  ('4-7-8 Breathing for Anxiety', 'Breathing Practice', 'A paced breathing session for moments of anxiety and overwhelm.', '8 min', 'premium', 'https://example.com/audio/luna-478-anxiety.mp3', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80'),
  ('Morning Energy Reset', 'Morning Practice', 'Start with warmth, clarity, and gentle momentum.', '10 min', 'premium', 'https://example.com/audio/luna-morning-energy.mp3', 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80'),
  ('Focus Before Work', 'Focus Practice', 'Settle your attention before a deep work session.', '7 min', 'premium', 'https://example.com/audio/luna-focus-before-work.mp3', 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80'),
  ('Confidence Builder', 'Guided Meditation', 'A steady, encouraging practice for grounded confidence.', '12 min', 'premium', 'https://example.com/audio/luna-confidence-builder.mp3', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80'),
  ('Emotional Balance Reset', 'Meditation', 'A soft practice for processing feelings without being swept away.', '14 min', 'premium', 'https://example.com/audio/luna-emotional-balance.mp3', 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=1200&q=80')
on conflict do nothing;
