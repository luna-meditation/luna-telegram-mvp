import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const migration = readFileSync(resolve(process.cwd(), '../database/migrations/003_luna_ai_reliability.sql'), 'utf8');
const backend = readFileSync(resolve(process.cwd(), 'src/luna-ai.ts'), 'utf8');
const frontend = readFileSync(resolve(process.cwd(), '../frontend/src/components/LunaChat.tsx'), 'utf8');

test('database enforces one logical request and one message per role', () => {
  assert.match(migration, /unique \(telegram_id, client_request_id\)/);
  assert.match(migration, /ai_messages\(conversation_id, request_id, role\)/);
});

test('quota reservation is atomic and concurrency safe', () => {
  assert.match(migration, /pg_advisory_xact_lock\(p_telegram_id\)/);
  assert.match(migration, /for update/);
  assert.match(migration, /quota_exhausted/);
  assert.match(migration, /quota_charged/);
});

test('processing requests can recover after a bounded stale interval', () => {
  assert.match(migration, /updated_at > now\(\) - interval '3 minutes'/);
  assert.match(migration, /attempt_count = public\.ai_chat_requests\.attempt_count \+ 1/);
});

test('backend returns an existing completed response for duplicate delivery', () => {
  assert.match(backend, /existingCompletedResponse/);
  assert.match(backend, /duplicate: true/);
  assert.match(backend, /assistant_message_id/);
});

test('failed requests are refunded and remain retryable with the same turn', () => {
  assert.match(backend, /quota_charged: false/);
  assert.match(backend, /status: requestState/);
  assert.doesNotMatch(backend, /delete\(\)\.eq\('id', userMessageId/);
  assert.match(frontend, /retry\?\.clientRequestId/);
});

test('OpenAI max-output retry remains internal to one request', () => {
  assert.match(backend, /attempt: 2/);
  const usageWrites = backend.match(/await saveUsage\(/g) ?? [];
  assert.equal(usageWrites.length >= 2, true);
  assert.doesNotMatch(backend.slice(backend.indexOf("if (shouldRetryOpenAiResponse"), backend.indexOf("if (!extracted)")), /saveUsage/);
});

test('recommendation metadata persists on the matching assistant message', () => {
  assert.match(backend, /metadata: \{ recommendedMeditationId, recommendedMeditation, safetyState: 'none' \}/);
  assert.match(backend, /recommendation_id: recommendedMeditationId/);
  assert.match(frontend, /key=\{message\.id\}/);
  assert.match(frontend, /message\.metadata\?\.recommendedMeditationId/);
  assert.match(frontend, /message\.metadata\?\.recommendedMeditation/);
});
