import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const lunaAiSource = readFileSync(new URL('./luna-ai.ts', import.meta.url), 'utf8');
const configSource = readFileSync(new URL('./config.ts', import.meta.url), 'utf8');

test('inactive raw conversation history has a bounded retention policy', () => {
  assert.match(configSource, /AI_CONVERSATION_RETENTION_DAYS/);
  assert.match(configSource, /default\(90\)/);
  assert.match(lunaAiSource, /pruneExpiredLunaConversations/);
  assert.match(lunaAiSource, /\.lt\('last_message_at', cutoff\)/);
  assert.match(lunaAiSource, /\.eq\('telegram_id', telegramId\)/);
});
