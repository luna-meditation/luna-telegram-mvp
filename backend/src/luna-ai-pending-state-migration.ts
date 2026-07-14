export const lunaAiPendingStateMigration = `
alter table public.ai_conversations
  add column if not exists pending_state jsonb not null default '{}'::jsonb;
`;
