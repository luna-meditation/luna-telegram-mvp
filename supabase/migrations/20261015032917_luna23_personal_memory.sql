-- Additive confirmation metadata; legacy entries deliberately remain pending.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
alter table public.user_memories
 add column if not exists confirmation_status text not null default 'pending' check (confirmation_status in ('pending','confirmed')),
 add column if not exists memory_kind text not null default 'fact' check (memory_kind in ('fact','symbolic')),
 add column if not exists is_sensitive boolean not null default true,
 add column if not exists source_type text not null default 'legacy_ai',
 add column if not exists confirmed_at timestamptz,
 add column if not exists revision integer not null default 1 check (revision>0);
alter table public.user_memories enable row level security;
alter table public.user_memories force row level security;
revoke all on public.user_memories from public,anon,authenticated;
grant select,insert,update,delete on public.user_memories to service_role;
create index if not exists idx_luna23_confirmed_memory on public.user_memories(telegram_id,updated_at desc) where is_active and confirmation_status='confirmed';
create unique index if not exists idx_luna23_memory_value on public.user_memories(telegram_id,category,lower(btrim(regexp_replace(normalize(memory_value,NFKC),'[^[:alnum:]]+',' ','g')))) where is_active and confirmation_status='confirmed';
create unique index if not exists idx_luna23_memory_topic on public.user_memories(telegram_id,lower(regexp_replace(btrim(normalize(memory_key,NFKC)),'[[:space:]-]+','_','g'))) where is_active and confirmation_status='confirmed';
comment on column public.user_memories.confirmation_status is 'Only explicit user confirmation permits AI retrieval. Legacy rows remain unconfirmed.';
notify pgrst,'reload schema';
commit;
