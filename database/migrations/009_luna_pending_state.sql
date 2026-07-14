-- Persist Luna clarification and pending UI actions across multi-turn messages.
-- Additive only: existing conversations receive an empty pending state.
alter table public.ai_conversations
  add column if not exists pending_state jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
