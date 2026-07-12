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
drop index if exists public.idx_ai_usage_request_id;
create unique index if not exists idx_ai_usage_request_id on public.ai_usage(telegram_id, request_id);

create table if not exists public.ai_chat_requests (
  id uuid primary key default gen_random_uuid(), telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  client_request_id text not null, conversation_id uuid references public.ai_conversations(id) on delete cascade,
  user_message_id uuid references public.ai_messages(id) on delete set null,
  assistant_message_id uuid references public.ai_messages(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed_retryable','failed_non_retryable','quota_exhausted')),
  quota_charged boolean not null default false, attempt_count integer not null default 0 check (attempt_count >= 0),
  error_code text, recommendation_id uuid references public.meditations(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz,
  unique (telegram_id, client_request_id)
);
create index if not exists idx_ai_chat_requests_user_daily on public.ai_chat_requests(telegram_id, created_at desc) where quota_charged;
drop index if exists public.idx_ai_messages_request_id;
create unique index if not exists idx_ai_messages_request_role on public.ai_messages(conversation_id, request_id, role) where request_id is not null;

create or replace function public.reserve_luna_chat_request(p_telegram_id bigint, p_client_request_id text, p_daily_limit integer, p_conversation_id uuid default null)
returns table(status text, quota_charged boolean, remaining integer, attempt_count integer, acquired boolean)
language plpgsql security definer set search_path = public as $$
declare existing public.ai_chat_requests%rowtype; used_count integer; had_existing boolean := false;
begin
  perform pg_advisory_xact_lock(p_telegram_id);
  select * into existing from public.ai_chat_requests where telegram_id = p_telegram_id and client_request_id = p_client_request_id for update;
  had_existing := found;
  if had_existing and (existing.status='completed' or (existing.status='processing' and existing.updated_at > now()-interval '3 minutes')) then
    return query select existing.status, existing.quota_charged, greatest(0, p_daily_limit - (select count(*)::integer from public.ai_chat_requests where telegram_id = p_telegram_id and quota_charged and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc')), existing.attempt_count, false;
    return;
  end if;
  select count(*)::integer into used_count from public.ai_chat_requests where telegram_id = p_telegram_id and quota_charged and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if used_count >= p_daily_limit and (not had_existing or not existing.quota_charged) then
    insert into public.ai_chat_requests (telegram_id, client_request_id, conversation_id, status, error_code) values (p_telegram_id, p_client_request_id, p_conversation_id, 'quota_exhausted', 'quota_exhausted')
    on conflict (telegram_id, client_request_id) do update set status='quota_exhausted', error_code='quota_exhausted', updated_at=now();
    return query select 'quota_exhausted'::text, false, 0, coalesce(existing.attempt_count, 0), false; return;
  end if;
  insert into public.ai_chat_requests (telegram_id, client_request_id, conversation_id, status, quota_charged, attempt_count, error_code, updated_at)
  values (p_telegram_id, p_client_request_id, p_conversation_id, 'processing', true, 1, null, now())
  on conflict (telegram_id, client_request_id) do update set conversation_id=coalesce(excluded.conversation_id, public.ai_chat_requests.conversation_id), status='processing', quota_charged=true, attempt_count=public.ai_chat_requests.attempt_count+1, error_code=null, updated_at=now()
  returning * into existing;
  select count(*)::integer into used_count from public.ai_chat_requests where telegram_id=p_telegram_id and quota_charged and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  return query select existing.status, existing.quota_charged, greatest(0, p_daily_limit-used_count), existing.attempt_count, true;
end; $$;
revoke all on function public.reserve_luna_chat_request(bigint,text,integer,uuid) from public;
grant execute on function public.reserve_luna_chat_request(bigint,text,integer,uuid) to service_role;

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.user_memories enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_chat_requests enable row level security;
`;
