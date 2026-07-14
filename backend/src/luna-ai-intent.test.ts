import assert from 'node:assert/strict';
import test from 'node:test';
import { directMeditationResponse, resolveLunaIntent } from './luna-ai-intent.js';
import { createPendingClarification } from './luna-ai-pending.js';
import { rankMeditationRecommendation, type RecommendationCatalogItem } from './luna-ai-policy.js';
import { reviewLunaResponse } from './luna-ai-quality.js';
import { normalizeConversationState, updateConversationState } from './luna-ai-state.js';

const catalog: RecommendationCatalogItem[] = [
  { id: 'sleep', title: 'Deep Sleep', category: 'sleep', mood: 'sleep', duration: 1200, published: true, premium: false, summary: 'Prepare for deep sleep and a restful night.', tags: ['sleep', 'rest'] },
  { id: 'focus', title: 'Focused Calm', category: 'focus', mood: 'clarity', duration: 600, published: true, premium: false, summary: 'Return to attention and clear focus.', tags: ['focus', 'clarity'] },
  { id: 'reset', title: 'Breath Reset', category: 'breath', mood: 'calm', duration: 300, published: true, premium: false, summary: 'A short breathing reset for stress.', tags: ['breath', 'reset'] },
  { id: 'anxiety', title: 'Anxiety Relief', category: 'anxiety', mood: 'calm', duration: 900, published: true, premium: false, summary: 'Ease worry and settle anxious thoughts.', tags: ['anxiety', 'calm'] }
];

function resolveAndRank(message: string, state = normalizeConversationState(null)) {
  const intent = resolveLunaIntent({ message, state, pendingState: null, catalog });
  const recommendation = rankMeditationRecommendation({
    message,
    catalog,
    intentOverride: intent.goal,
    forceRecommendation: intent.action === 'recommend_meditation'
  });
  return { intent, recommendation };
}

test('clear sleep, focus, reset, and breathing requests resolve immediately without clarification', () => {
  const cases = [
    ["I can't sleep", 'sleep', 'sleep'],
    ['I need focus', 'focus', 'focus'],
    ['I need reset', 'reset', 'reset'],
    ['Show me breathing', 'breathing', 'reset']
  ] as const;
  for (const [message, expectedIntent, expectedMeditation] of cases) {
    const result = resolveAndRank(message);
    assert.equal(result.intent.intent, expectedIntent, message);
    assert.equal(result.intent.action, 'recommend_meditation', message);
    assert.equal(result.recommendation.meditationId, expectedMeditation, message);
    assert.equal(result.recommendation.ambiguous, false, message);
  }
});

test('generic recommendation continues the persisted goal instead of choosing randomly', () => {
  const state = {
    ...normalizeConversationState(null),
    current_topic: 'focus',
    current_goal: 'focus' as const,
    current_intent: 'focus'
  };
  const result = resolveAndRank('Recommend a meditation', state);
  assert.equal(result.intent.continuation, true);
  assert.equal(result.intent.goal, 'focus');
  assert.equal(result.recommendation.meditationId, 'focus');
  assert.match(result.recommendation.reason, /focus/);
});

test('short category reply resolves an existing clarification in the same turn', () => {
  const pending = createPendingClarification({ clarification: 'Сон, фокус или мягкая перезагрузка?' });
  const result = resolveLunaIntent({
    message: 'Фокус',
    state: normalizeConversationState(null),
    pendingState: pending,
    catalog
  });
  assert.equal(result.intent, 'focus');
  assert.equal(result.continuation, true);
  assert.equal(result.action, 'recommend_meditation');
});

test('yes reuses the persisted recommendation instead of restarting classification', () => {
  const afterFocus = updateConversationState({
    previous: normalizeConversationState(null),
    intent: 'focus',
    goal: 'focus',
    topic: 'focus',
    meditationId: 'focus',
    assistantMessage: 'Focused Calm лучше всего подойдёт для мягкого фокуса.',
    userDecision: 'Мне нужен фокус',
    language: 'ru'
  });
  const result = resolveLunaIntent({ message: 'Да', state: afterFocus, pendingState: null, catalog });
  assert.equal(result.intent, 'open_meditation');
  assert.equal(result.action, 'open_meditation');
  assert.equal(result.meditationId, 'focus');
  assert.equal(result.continuation, true);
});

test('show me and send me are continuation actions, not fresh recommendations', () => {
  const state = {
    ...normalizeConversationState(null),
    current_topic: 'reset',
    current_goal: 'reset' as const,
    current_intent: 'reset',
    current_meditation_id: 'reset',
    current_recommendation_id: 'reset'
  };
  for (const message of ['show me', 'send me', 'покажи мне', 'пришли мне']) {
    const result = resolveLunaIntent({ message, state, pendingState: null, catalog });
    assert.equal(result.intent, 'open_meditation', message);
    assert.equal(result.meditationId, 'reset', message);
    assert.equal(result.continuation, true, message);
  }
});

test('explicit catalog title actions open the exact published meditation', () => {
  const result = resolveLunaIntent({
    message: 'Start Deep Sleep',
    state: normalizeConversationState(null),
    pendingState: null,
    catalog
  });
  assert.equal(result.intent, 'open_meditation');
  assert.equal(result.meditationId, 'sleep');
});

test('non-meditation topics do not create promotional meditation actions', () => {
  const result = resolveLunaIntent({
    message: 'I need to talk about my relationship',
    state: normalizeConversationState(null),
    pendingState: null,
    catalog
  });
  assert.equal(result.intent, 'relationship');
  assert.equal(result.action, 'none');
});

test('direct responses stay concise and use the latest-message language', () => {
  const english = directMeditationResponse({ language: 'en', intent: 'sleep', title: 'Deep Sleep', continuation: false });
  const russian = directMeditationResponse({ language: 'ru', intent: 'focus', title: 'Focused Calm', continuation: false });
  assert.match(english, /Deep Sleep/);
  assert.doesNotMatch(english, /[А-Яа-я]/);
  assert.match(russian, /Focused Calm/);
  assert.match(russian, /подойдёт/);
  assert.equal(reviewLunaResponse({
    message: russian,
    language: 'ru',
    state: normalizeConversationState(null),
    clarificationAllowed: false
  }).accepted, true);
});

test('response review blocks repeated clarifications and excessive questions', () => {
  const question = 'Тебе сейчас больше нужны сон, фокус или мягкая перезагрузка?';
  const state = updateConversationState({
    previous: normalizeConversationState(null),
    intent: 'recommend_meditation',
    goal: null,
    topic: 'meditation',
    meditationId: null,
    assistantMessage: question,
    userDecision: 'Пришли медитацию',
    language: 'ru'
  });
  const review = reviewLunaResponse({
    message: question,
    language: 'ru',
    state,
    clarificationAllowed: false
  });
  assert.equal(review.accepted, false);
  assert.ok(review.issues.includes('repeated_clarification'));
  assert.ok(review.issues.includes('question_too_soon'));
});

test('conversation state persists the topic, goal, recommendation, question, and last decision', () => {
  const state = updateConversationState({
    previous: normalizeConversationState(null),
    intent: 'focus',
    goal: 'focus',
    topic: 'focus',
    meditationId: 'focus',
    assistantMessage: 'Focused Calm fits. Would you like a shorter option?',
    userDecision: 'I need focus',
    language: 'en'
  });
  assert.equal(state.current_topic, 'focus');
  assert.equal(state.current_goal, 'focus');
  assert.equal(state.current_meditation_id, 'focus');
  assert.equal(state.current_recommendation_id, 'focus');
  assert.equal(state.last_user_decision, 'I need focus');
  assert.match(state.previous_assistant_question ?? '', /shorter option/);
});
