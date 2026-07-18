import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const migration = readFileSync(resolve(process.cwd(), '../database/migrations/003_luna_ai_reliability.sql'), 'utf8');
const conversationStateMigration = readFileSync(resolve(process.cwd(), '../database/migrations/010_luna_conversation_state.sql'), 'utf8');
const backend = readFileSync(resolve(process.cwd(), 'src/luna-ai.ts'), 'utf8');
const frontend = readFileSync(resolve(process.cwd(), '../frontend/src/components/LunaChat.tsx'), 'utf8');
const server = readFileSync(resolve(process.cwd(), 'src/server.ts'), 'utf8');

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
  assert.match(backend, /recommendedMeditationId/);
  assert.match(backend, /pending_action: nextPendingState\?\.pending_action/);
  assert.match(backend, /clarificationHash: nextPendingState\?\.clarification_hash/);
  assert.match(backend, /resolvedIntent/);
  assert.match(backend, /recommendation_id: attachedMeditationId/);
  assert.match(frontend, /key=\{message\.id\}/);
  assert.match(frontend, /recommendationIdForMessage\(message\)/);
  assert.match(frontend, /metadata\.recommendedMeditationId/);
  assert.match(frontend, /message\.metadata\?\.recommendedMeditation/);
});

test('pending intent and action survive a multi-turn clarification', () => {
  assert.match(backend, /pending_state/);
  assert.match(backend, /resolvePendingReply/);
  assert.match(backend, /inferPendingStateFromRecent/);
  assert.match(backend, /effectiveExplicitRequest/);
  assert.match(backend, /duplicateClarification/);
});

test('persistent conversation decisions survive beyond one pending clarification', () => {
  assert.match(conversationStateMigration, /add column if not exists conversation_state jsonb not null default '\{\}'::jsonb/);
  assert.doesNotMatch(conversationStateMigration, /drop table|truncate|delete from/i);
  assert.match(backend, /conversation_state/);
  assert.match(backend, /resolveLunaIntent/);
  assert.match(backend, /rankMeditationRecommendation/);
  assert.match(backend, /directActionMeditationId/);
  assert.match(backend, /\[Luna AI runtime decision\]/);
  assert.match(backend, /\[Luna AI response review\]/);
});

test('production truth telemetry and admin version diagnostics are server-protected', () => {
  assert.match(server, /app\.get\('\/api\/version', requireTelegramWebApp/);
  assert.match(server, /if \(!assertAdmin\(req, res\)\) return;/);
  assert.match(server, /app\.post\('\/api\/client-events', requireTelegramWebApp/);
  assert.match(server, /backendSha: getBackendVersion\(\)\.commitSha/);
  assert.match(backend, /\[Luna AI pending state loaded\]/);
  assert.match(backend, /\[Luna AI pending state resolved\]/);
  assert.match(backend, /\[Luna AI card action generated\]/);
});
