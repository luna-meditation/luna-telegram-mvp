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
  assert.match(source, /message\.metadata\?\.recommendedMeditationId/);
  assert.match(source, /key=\{message\.id\}/);
  assert.doesNotMatch(source, /key=\{index\}/);
});
