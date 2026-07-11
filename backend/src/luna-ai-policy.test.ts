import assert from 'node:assert/strict';
import test from 'node:test';
import { isCrisisMessage, safetyCategory, validatedMeditationId, validMemoryCandidates } from './luna-ai-policy.js';

test('accepts grounded high-confidence memory and rejects invalid candidates', () => {
  const valid = validMemoryCandidates([
    { category: 'sleep', key: 'preferred_sleep_time', value: 'User prefers evening practices.', confidence: 0.9 },
    { category: 'medical_diagnosis', key: 'diagnosis', value: 'Invented diagnosis', confidence: 0.99 },
    { category: 'stress', key: 'x', value: 'Too short key', confidence: 0.9 },
    { category: 'routine', key: 'temporary_detail', value: 'Low confidence detail', confidence: 0.4 }
  ]);
  assert.equal(valid.length, 1);
  assert.equal(valid[0]?.key, 'preferred_sleep_time');
});

test('detects English and Russian crisis language without flagging ordinary stress', () => {
  assert.equal(isCrisisMessage('I want to kill myself'), true);
  assert.equal(isCrisisMessage('Я хочу навредить себе'), true);
  assert.equal(isCrisisMessage('I feel stressed after work'), false);
  assert.equal(safetyCategory('I have severe chest pain and cannot breathe'), 'medical_emergency');
  assert.equal(safetyCategory('На меня напали, я в непосредственной опасности'), 'violence');
});

test('ignores meditation ids outside the supplied catalog', () => {
  const validId = '11111111-1111-4111-8111-111111111111';
  assert.equal(validatedMeditationId(validId, [validId]), validId);
  assert.equal(validatedMeditationId('22222222-2222-4222-8222-222222222222', [validId]), null);
  assert.equal(validatedMeditationId(null, [validId]), null);
});
