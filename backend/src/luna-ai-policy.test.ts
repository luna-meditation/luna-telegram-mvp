import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isCrisisMessage,
  safetyCategory,
  sanitizeMeditationFacts,
  semanticMeditationRecommendation,
  validatedMeditationId,
  validMemoryCandidates,
  type RecommendationCatalogItem
} from './luna-ai-policy.js';

const recommendationCatalog: RecommendationCatalogItem[] = [
  { id: 'anxiety', title: 'Anxiety Relief', category: 'anxiety', mood: 'calm', duration: 900, premium: false, language: 'en', summary: 'Ease worry and settle anxious thoughts.' },
  { id: 'breath', title: 'Breath Reset', category: 'breath', mood: 'calm', duration: 300, premium: false, language: 'en', summary: 'Short breathing support for stress.' },
  { id: 'sleep', title: 'Deep Sleep', category: 'sleep', mood: 'sleep', duration: 1200, premium: false, language: 'en', summary: 'Prepare for a restful night.' },
  { id: 'let_go', title: 'Let Go', category: 'sleep', mood: 'rest', duration: 720, premium: true, language: 'en', summary: 'Release the day.' },
  { id: 'self_love', title: 'Self Love', category: 'self', mood: 'kindness', duration: 1080, premium: true, language: 'en', summary: 'Soften self criticism.' },
  { id: 'balance', title: 'Inner Balance', category: 'grounding', mood: 'grounded', duration: 900, premium: false, language: 'en', summary: 'Ground and return to center.' },
  { id: 'morning', title: 'Morning Clarity', category: 'morning', mood: 'focus', duration: 600, premium: false, language: 'en', summary: 'Begin the day clearly.' }
];

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

test('semantic recommendations match anxiety, sleep, and self criticism', () => {
  assert.equal(semanticMeditationRecommendation({
    message: 'I feel anxious and my thoughts are racing.',
    catalog: recommendationCatalog,
    modelRecommendationId: 'sleep'
  }), 'anxiety');
  assert.equal(semanticMeditationRecommendation({
    message: "I can't sleep tonight.",
    catalog: recommendationCatalog,
    modelRecommendationId: null
  }), 'sleep');
  assert.equal(semanticMeditationRecommendation({
    message: 'I keep criticizing myself and feel not good enough.',
    catalog: recommendationCatalog,
    modelRecommendationId: null
  }), 'self_love');
});

test('semantic recommendations support grounding and morning routine', () => {
  assert.equal(semanticMeditationRecommendation({
    message: 'I need grounding and want to feel centered.',
    catalog: recommendationCatalog,
    modelRecommendationId: null
  }), 'balance');
  assert.equal(semanticMeditationRecommendation({
    message: 'Help me start my morning routine with focus.',
    catalog: recommendationCatalog,
    modelRecommendationId: null
  }), 'morning');
});

test('recommendation cooldown suppresses promotional cards', () => {
  assert.equal(semanticMeditationRecommendation({
    message: 'I feel anxious again.',
    catalog: recommendationCatalog,
    modelRecommendationId: 'anxiety',
    recentAssistantRecommendations: [null, 'sleep', null]
  }), null);
  assert.equal(semanticMeditationRecommendation({
    message: 'Thank you, I feel calmer.',
    catalog: recommendationCatalog,
    modelRecommendationId: 'anxiety'
  }), null);
});

test('sanitizes hallucinated meditation durations using catalog values', () => {
  assert.equal(
    sanitizeMeditationFacts('Try Anxiety Relief, a 10 minute meditation.', recommendationCatalog),
    'Try Anxiety Relief, a 15 min meditation.'
  );
  assert.equal(
    sanitizeMeditationFacts('A 10 minute meditation like Deep Sleep may help.', recommendationCatalog),
    'A 20 min meditation like Deep Sleep may help.'
  );
});
