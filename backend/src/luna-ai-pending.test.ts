import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clarificationHash,
  createPendingClarification,
  inferPendingStateFromRecent,
  resolvePendingReply,
  type PendingLunaState
} from './luna-ai-pending.js';
import type { RecommendationCatalogItem } from './luna-ai-policy.js';

const catalog: RecommendationCatalogItem[] = [
  { id: 'deep-sleep', title: 'Deep Sleep', category: 'sleep', mood: 'sleep', duration: 1200, premium: false, published: true, language: 'en', summary: 'Prepare for deep sleep and a restful night.', tags: ['sleep', 'rest'] },
  { id: 'focused-calm', title: 'Focused Calm', category: 'focus', mood: 'clarity', duration: 600, premium: false, published: true, language: 'en', summary: 'Return to attention and clear focus.', tags: ['focus', 'clarity'] },
  { id: 'breath-reset', title: 'Breath Reset', category: 'breath', mood: 'calm', duration: 300, premium: false, published: true, language: 'en', summary: 'A short reset with calm breathing for stress.', tags: ['reset', 'breath', 'calm'] }
];

function chooseState(): PendingLunaState {
  return createPendingClarification({
    clarification: 'Are you looking for sleep, focus, or a gentler reset?'
  });
}

function meditationId(result: ReturnType<typeof resolvePendingReply>) {
  return result && 'meditationId' in result ? result.meditationId : null;
}

test('Russian category replies resolve the selected meditation immediately', () => {
  assert.equal(meditationId(resolvePendingReply('Фокус', chooseState(), catalog)), 'focused-calm');
  assert.equal(meditationId(resolvePendingReply('Перезагрузка', chooseState(), catalog)), 'breath-reset');
  assert.equal(meditationId(resolvePendingReply('сон', chooseState(), catalog)), 'deep-sleep');
});

test('English category replies use the same generic catalog pipeline', () => {
  assert.equal(meditationId(resolvePendingReply('Focus', chooseState(), catalog)), 'focused-calm');
  assert.equal(meditationId(resolvePendingReply('Reset', chooseState(), catalog)), 'breath-reset');
  assert.equal(meditationId(resolvePendingReply('Sleep', chooseState(), catalog)), 'deep-sleep');
});

test('confirmation and short action replies execute a pending card action', () => {
  const state = createPendingClarification({
    clarification: 'Should I show the meditation card?',
    meditationId: 'focused-calm',
    action: 'show_meditation_card'
  });
  for (const reply of ['Да', 'покажи', 'пришли её', 'Открой', 'Yes', 'show it', 'open']) {
    assert.equal(meditationId(resolvePendingReply(reply, state, catalog)), 'focused-calm', reply);
  }
});

test('successful resolution clears pending state so repeated short replies do not reopen the old clarification', () => {
  const state = chooseState();
  const resolved = resolvePendingReply('Фокус', state, catalog);
  assert.equal(resolved?.clearPending, true);
  assert.equal(resolvePendingReply('Да', null, catalog), null);
});

test('legacy clarification messages are recovered into pending state', () => {
  const recovered = inferPendingStateFromRecent(null, [{
    role: 'assistant',
    content: 'Тебе сейчас больше нужны сон, фокус или мягкая перезагрузка?',
    metadata: {}
  }]);
  assert.equal(recovered?.pending_action, 'choose_meditation');
  assert.equal(recovered?.pending_clarification.includes('сон'), true);
});

test('clarification hash is stable for loop protection', () => {
  assert.equal(
    clarificationHash('Тебе сейчас больше нужны сон, фокус или мягкая перезагрузка?'),
    clarificationHash('Тебе сейчас больше нужны сон, фокус или мягкая перезагрузка?')
  );
});
