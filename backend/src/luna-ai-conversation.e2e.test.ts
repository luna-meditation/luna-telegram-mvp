import assert from 'node:assert/strict';
import test from 'node:test';
import { directMeditationResponse, resolveLunaIntent } from './luna-ai-intent.js';
import { detectConversationLanguage, rankMeditationRecommendation, type LunaLanguage, type RecommendationCatalogItem } from './luna-ai-policy.js';
import { reviewLunaResponse } from './luna-ai-quality.js';
import { normalizeConversationState, updateConversationState } from './luna-ai-state.js';

const catalog: RecommendationCatalogItem[] = [
  { id: 'deep-sleep', title: 'Deep Sleep', category: 'sleep', mood: 'sleep', duration: 1200, published: true, premium: false, summary: 'Prepare for deep sleep and a restful night.', tags: ['sleep', 'rest'] },
  { id: 'focused-calm', title: 'Focused Calm', category: 'focus', mood: 'clarity', duration: 600, published: true, premium: false, summary: 'Return to attention and clear focus.', tags: ['focus', 'clarity'] },
  { id: 'breath-reset', title: 'Breath Reset', category: 'breath', mood: 'calm', duration: 300, published: true, premium: false, summary: 'A short breathing reset for stress.', tags: ['breath', 'reset'] },
  { id: 'anxiety-relief', title: 'Anxiety Relief', category: 'anxiety', mood: 'calm', duration: 900, published: true, premium: false, summary: 'Ease worry and settle anxious thoughts.', tags: ['anxiety', 'calm'] }
];

type ScriptedTurn = {
  user: string;
  expectedCard: string | null;
  modelReply?: { en: string; ru: string };
};

const turns: ScriptedTurn[] = [
  { user: "I can't sleep.", expectedCard: 'Deep Sleep' },
  { user: 'yes', expectedCard: 'Deep Sleep' },
  { user: 'Thank you.', expectedCard: null, modelReply: { en: "You're welcome.", ru: 'Пожалуйста.' } },
  { user: 'I need to focus for work.', expectedCard: 'Focused Calm' },
  { user: 'open it', expectedCard: 'Focused Calm' },
  { user: 'I feel clearer now.', expectedCard: null, modelReply: { en: "I'm glad things feel a little clearer.", ru: 'Я рада, что стало немного яснее.' } },
  { user: 'I need a reset.', expectedCard: 'Breath Reset' },
  { user: 'show me', expectedCard: 'Breath Reset' },
  { user: 'send it', expectedCard: 'Breath Reset' },
  { user: 'Thanks, that helped.', expectedCard: null, modelReply: { en: "I'm glad it helped.", ru: 'Я рада, что это помогло.' } },
  { user: 'Can we talk about my relationship?', expectedCard: null, modelReply: { en: "Of course. We can take it slowly.", ru: 'Конечно. Давай не будем спешить.' } },
  { user: 'Recommend a meditation.', expectedCard: null, modelReply: { en: 'What would help most right now: sleep, focus, or a reset?', ru: 'Что сейчас нужнее всего: сон, фокус или перезагрузка?' } },
  { user: 'Focus.', expectedCard: 'Focused Calm' },
  { user: 'yes', expectedCard: 'Focused Calm' },
  { user: 'I need sleep instead.', expectedCard: 'Deep Sleep' },
  { user: 'open it', expectedCard: 'Deep Sleep' },
  { user: 'I feel calmer.', expectedCard: null, modelReply: { en: "I'm glad. Let that be enough for now.", ru: 'Я рада. Пусть этого пока будет достаточно.' } },
  { user: 'show me', expectedCard: 'Deep Sleep' },
  { user: 'Мне нужна перезагрузка.', expectedCard: 'Breath Reset' },
  { user: 'пришли её', expectedCard: 'Breath Reset' }
];

test('20-turn production-like conversation preserves context and never enters a clarification loop', (context) => {
  let state = normalizeConversationState(null);
  let language: LunaLanguage = 'en';
  const transcript: string[] = [];
  const clarificationHashes = new Set<string>();
  let clarificationCount = 0;

  turns.forEach((turn, index) => {
    language = detectConversationLanguage(turn.user, language);
    const intent = resolveLunaIntent({ message: turn.user, state, pendingState: null, catalog });
    const directId = intent.meditationId && catalog.some((item) => item.id === intent.meditationId)
      ? intent.meditationId
      : null;
    const recommendation = intent.action === 'recommend_meditation' && !directId
      ? rankMeditationRecommendation({
        message: turn.user,
        catalog,
        intentOverride: intent.goal,
        forceRecommendation: true
      })
      : null;
    const meditationId = directId ?? recommendation?.meditationId ?? null;
    const meditation = meditationId ? catalog.find((item) => item.id === meditationId) ?? null : null;
    const assistantMessage = meditation
      ? directMeditationResponse({ language, intent: intent.intent, title: meditation.title, continuation: intent.continuation })
      : turn.modelReply?.[language]
        ?? (language === 'ru' ? 'Я рядом.' : "I'm here.");

    assert.equal(meditation?.title ?? null, turn.expectedCard, `turn ${index + 1}: ${turn.user}`);
    if (!turn.expectedCard) assert.equal(meditationId, null, `turn ${index + 1} must not repeat a card`);
    if (['yes', 'open it', 'show me', 'send it', 'пришли её'].includes(turn.user.toLowerCase())) {
      assert.equal(intent.intent, 'open_meditation', `turn ${index + 1} must continue the previous card action`);
      assert.equal(intent.continuation, true, `turn ${index + 1} must preserve conversation context`);
    }

    const review = reviewLunaResponse({
      message: assistantMessage,
      language,
      state,
      clarificationAllowed: state.assistant_messages_since_question >= 3
    });
    assert.equal(review.accepted, true, `turn ${index + 1} response review: ${review.issues.join(', ')}`);

    const question = assistantMessage.includes('?') ? assistantMessage : null;
    if (question) {
      clarificationCount += 1;
      const normalized = question.toLowerCase().replace(/[^a-zа-я0-9]+/gi, ' ').trim();
      assert.equal(clarificationHashes.has(normalized), false, `turn ${index + 1} repeated a clarification`);
      clarificationHashes.add(normalized);
    }

    state = updateConversationState({
      previous: state,
      intent: intent.intent,
      goal: intent.goal,
      topic: intent.topic,
      meditationId,
      assistantMessage,
      userDecision: turn.user,
      language,
      clearMeditationContext: ['journal', 'premium', 'relationship', 'science'].includes(intent.intent)
    });

    transcript.push(`${index + 1}. User: ${turn.user}`);
    transcript.push(`   Luna: ${assistantMessage}`);
    if (meditation) transcript.push(`   [Meditation card: ${meditation.title}]`);
  });

  assert.equal(clarificationCount, 1, 'the full conversation should need exactly one clarification');
  assert.equal(state.current_goal, 'reset');
  assert.equal(state.current_recommendation_id, 'breath-reset');
  assert.equal(state.last_user_decision, 'пришли её');

  context.diagnostic(`\n${transcript.join('\n')}`);
});
