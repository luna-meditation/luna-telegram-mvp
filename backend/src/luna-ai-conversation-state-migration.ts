export const lunaAiConversationStateMigration = `
alter table public.ai_conversations
  add column if not exists conversation_state jsonb not null default '{}'::jsonb;
`;
