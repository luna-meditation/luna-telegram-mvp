export const lunaAiMigration = `
alter table public.users
  add column if not exists ai_memory_enabled boolean not null default true;

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  title text not null default '', language text not null default 'en' check (language in ('en', 'ru')),
  status text not null default 'active' check (status in ('active', 'archived')),
  summary text not null default '', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), last_message_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null check (char_length(content) > 0), message_type text not null default 'text',
  request_id text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table if not exists public.user_memories (
  id uuid primary key default gen_random_uuid(), telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  memory_key text not null, memory_value text not null, category text not null,
  confidence numeric(4,3) not null default 0.8 check (confidence >= 0 and confidence <= 1),
  source_conversation_id uuid references public.ai_conversations(id) on delete set null,
  source_message_id uuid references public.ai_messages(id) on delete set null,
  is_active boolean not null default true, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), last_used_at timestamptz,
  unique (telegram_id, category, memory_key)
);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(), telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null, request_id text,
  model text not null, input_tokens integer not null default 0, output_tokens integer not null default 0,
  total_tokens integer not null default 0, estimated_cost numeric(12,6), request_status text not null, latency_ms integer,
  error_class text, created_at timestamptz not null default now()
);

alter table public.ai_usage add column if not exists estimated_cost numeric(12,6);

create index if not exists idx_ai_conversations_user_recent on public.ai_conversations(telegram_id, last_message_at desc);
create index if not exists idx_ai_messages_conversation_recent on public.ai_messages(conversation_id, created_at desc);
create unique index if not exists idx_ai_messages_request_id on public.ai_messages(conversation_id, request_id) where request_id is not null and role = 'user';
create index if not exists idx_user_memories_active on public.user_memories(telegram_id, is_active, updated_at desc);
create index if not exists idx_ai_usage_user_daily on public.ai_usage(telegram_id, created_at desc);
create unique index if not exists idx_ai_usage_request_id on public.ai_usage(telegram_id, request_id) where request_id is not null;

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.user_memories enable row level security;
alter table public.ai_usage enable row level security;
`;
