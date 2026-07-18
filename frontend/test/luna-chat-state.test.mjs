import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(process.cwd(), 'src/components/LunaChat.tsx'), 'utf8');

test('retry reuses the stable client request id without another user bubble', () => {
  assert.match(source, /retry\?\.clientRequestId \?\? requestId\(\)/);
  assert.match(source, /if \(!retry\) setMessages/);
  assert.match(source, /requestId: clientRequestId/);
});

test('quota exhaustion disables retry and the composer', () => {
  assert.match(source, /failedTurn\.state !== 'quota_exhausted'/);
  assert.match(source, /thinking \|\| quotaExhausted/);
  assert.match(source, /The limit resets tomorrow/);
});

test('recommendation stays associated with its assistant message', () => {
  assert.match(source, /recommendationIdForMessage\(message\)/);
  assert.match(source, /metadata\.recommendedMeditationId/);
  assert.match(source, /key=\{message\.id\}/);
  assert.doesNotMatch(source, /key=\{index\}/);
});

test('an explicit cleared meditation action cannot revive a stale legacy card', () => {
  assert.match(source, /hasOwnProperty\.call\(metadata, 'meditationAction'\)/);
  assert.match(source, /metadata\.meditationAction\?\.meditationId \?\? null/);
  assert.match(source, /<ChatMeditationCard/);
  assert.equal((source.match(/<ChatMeditationCard/g) ?? []).length, 1);
});

test('chat keeps all quick prompts in a horizontal rail and normalizes long generated titles', () => {
  assert.match(source, /className="luna-quick-prompts"/);
  assert.doesNotMatch(source, /prompts\.slice/);
  assert.match(source, /displayConversationTitle/);
  assert.match(source, /clean\.length <= 48/);
});
