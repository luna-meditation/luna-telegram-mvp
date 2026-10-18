import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(process.cwd(), 'src/components/LunaChat.tsx'), 'utf8');

test('retry reuses the stable client request id without another user bubble', () => {
  assert.ok(source.includes('retry?.clientRequestId ?? requestId()'));
  assert.match(source, /if \(!retry\) setMessages/);
  assert.match(source, /requestId: clientRequestId/);
});

test('quota exhaustion blocks paid replies and retry but keeps free account commands available', () => {
  assert.match(source, /failedTurn\.state !== 'quota_exhausted'/);
  assert.match(source, /quotaExhausted&&!meetOpen&&!commerceIntent\(draft\)/);
  assert.match(source, /quotaExhausted&&<ChatCommerce view="quota"/);
  assert.match(source, /Your AI allowance is used/);
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
  const renderer=readFileSync(resolve(process.cwd(),'src/components/LunaAttachmentRenderer.tsx'),'utf8');
  assert.match(source, /<LunaAttachmentRenderer/);
  assert.equal((renderer.match(/<ChatMeditationCard/g) ?? []).length, 1);
});

test('chat keeps all quick prompts in a horizontal rail and normalizes long generated titles', () => {
  assert.match(source, /className="luna-quick-prompts"/);
  assert.doesNotMatch(source, /prompts\.slice/);
  assert.match(source, /displayConversationTitle/);
  assert.match(source, /clean\.length <= 48/);
});
