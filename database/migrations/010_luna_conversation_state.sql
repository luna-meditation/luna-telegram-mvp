-- Persistent runtime context for Luna's decision engine.
-- Additive only: no existing conversation or message data is changed.
alter table public.ai_conversations
  add column if not exists conversation_state jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
