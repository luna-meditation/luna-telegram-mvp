import assert from 'node:assert/strict';
import test from 'node:test';
import {
  avoidLibraryInstructionWhenCardExists,
  containsMasculineLunaSelfReference,
  detectConversationLanguage,
  enforceLunaFeminineIdentity,
  formatMeditationDuration,
  enforceCardClaimConsistency,
  messageClaimsMeditationCard,
  hasInternalDataLeak,
  isAmbiguousSleepyTiredContext,
  isInChatGuidanceRequest,
  isReadyMeditationRequest,
  isCrisisMessage,
  meditationIdMentionedInText,
  safetyCategory,
  sanitizeMeditationFacts,
  sanitizeVisibleAssistantMessage,
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
  { id: 'focus', title: 'Focused Calm', category: 'focus', mood: 'clarity', duration: 600, premium: false, language: 'en', summary: 'Return attention gently.' },
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

test('detects the current message language, including language switches and mixed text', () => {
  assert.equal(detectConversationLanguage('Мне сейчас тревожно', 'en'), 'ru');
  assert.equal(detectConversationLanguage('I feel anxious today', 'ru'), 'en');
  assert.equal(detectConversationLanguage('Luna, мне тревожно today', 'en'), 'ru');
  assert.equal(detectConversationLanguage('ok', 'ru'), 'ru');
});

test('recognizes forbidden masculine Luna self-references', () => {
  assert.equal(containsMasculineLunaSelfReference('Я поняла тебя и я рядом.'), false);
  assert.equal(containsMasculineLunaSelfReference('Я рада, что ты написал.'), false);
  assert.equal(containsMasculineLunaSelfReference('Я понял тебя.'), true);
  assert.equal(containsMasculineLunaSelfReference('Я переключился на русский.'), true);
  assert.doesNotMatch(enforceLunaFeminineIdentity('Я понял тебя.', 'ru'), /я понял/i);
  assert.match(enforceLunaFeminineIdentity('Я поняла тебя.', 'ru'), /Я поняла/);
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

test('explicit meditation requests override cooldown and return one valid card id', () => {
  assert.equal(isReadyMeditationRequest('Пришли медитацию сюда'), true);
  assert.equal(semanticMeditationRecommendation({
    message: 'Пришли медитацию сюда',
    catalog: recommendationCatalog,
    modelRecommendationId: 'anxiety',
    recentAssistantRecommendations: [null, 'sleep', null]
  }), 'anxiety');
  assert.equal(semanticMeditationRecommendation({
    message: 'Recommend a meditation for my anxiety.',
    catalog: recommendationCatalog,
    modelRecommendationId: 'anxiety',
    recentAssistantRecommendations: ['anxiety']
  }), 'anxiety');
});

test('a second explicit clarity request overrides cooldown and changes the card', () => {
  assert.equal(semanticMeditationRecommendation({
    message: 'А что-нибудь для ясности ума? Покажи медитацию.',
    catalog: recommendationCatalog,
    recentAssistantRecommendations: ['anxiety'],
    modelRecommendationGoal: 'focus'
  }), 'focus');
});

test('send it here reuses the latest selected meditation card', () => {
  assert.equal(isReadyMeditationRequest('Можешь сюда прислать?'), true);
  assert.equal(semanticMeditationRecommendation({
    message: 'Можешь сюда прислать?',
    catalog: recommendationCatalog,
    recentAssistantRecommendations: [null, 'morning']
  }), 'morning');
});

test('explicit ready meditation request uses recent sleep context', () => {
  assert.equal(semanticMeditationRecommendation({
    message: 'Send me what I need',
    catalog: recommendationCatalog,
    recentMessages: [{ role: 'user', content: "I can't sleep tonight and feel tired." }]
  }), 'sleep');
});

test('recommendations reject duplicates and acknowledgements', () => {
  assert.equal(semanticMeditationRecommendation({
    message: 'I feel anxious again.',
    catalog: recommendationCatalog,
    modelRecommendationId: 'anxiety',
    recentAssistantRecommendations: ['anxiety']
  }), null);
  assert.equal(semanticMeditationRecommendation({
    message: 'Thanks', catalog: recommendationCatalog, modelRecommendationId: 'sleep'
  }), null);
});

test('sanitizes internal data, playback claims, and invented navigation', () => {
  const uuid = '11111111-1111-4111-8111-111111111111';
  assert.doesNotMatch(sanitizeVisibleAssistantMessage(`Open ${uuid}`, 'en'), /11111111/);
  assert.doesNotMatch(sanitizeVisibleAssistantMessage('I will start it now.', 'en'), /start it/i);
  assert.match(sanitizeVisibleAssistantMessage('Open Settings and go to Support.', 'en'), /not sure/i);
  assert.match(sanitizeVisibleAssistantMessage('Открой настройки и перейди в поддержку.', 'ru'), /не уверена/i);
});

test('never exposes ids, uuid, audio urls, or manual Library instructions when a card exists', () => {
  const uuid = '11111111-1111-4111-8111-111111111111';
  const unsafe = `Morning Clarity has id = ${uuid}. Open Library and search for it. https://x.supabase.co/storage/audio.mp3`;
  const sanitized = sanitizeVisibleAssistantMessage(unsafe, 'en');
  assert.doesNotMatch(sanitized, /11111111|supabase|id\s*=/i);
  const noLibrary = avoidLibraryInstructionWhenCardExists(sanitized, 'en', true);
  assert.doesNotMatch(noLibrary, /Open Library|search for/i);
  assert.match(noLibrary, /card below/i);
  assert.equal(hasInternalDataLeak('recommendedMeditationId: abc'), true);
});

test('card claims cannot survive without a validated recommendation payload', () => {
  assert.equal(messageClaimsMeditationCard('Открой карточку ниже.'), true);
  assert.doesNotMatch(enforceCardClaimConsistency('Открой карточку ниже.', 'ru', false), /карточк.*ниже/i);
  assert.equal(enforceCardClaimConsistency('Открой карточку ниже.', 'ru', true), 'Открой карточку ниже.');
});

test('repairs an unambiguous catalog title mentioned without recommendation id', () => {
  assert.equal(meditationIdMentionedInText('Morning Clarity feels right for you.', recommendationCatalog), 'morning');
  assert.equal(meditationIdMentionedInText('Deep Sleep or Let Go could fit.', recommendationCatalog), null);
});

test('separates in-chat guidance from ready meditation requests', () => {
  assert.equal(isInChatGuidanceRequest('Guide me here for one minute'), true);
  assert.equal(semanticMeditationRecommendation({
    message: 'Guide me here for one minute because I am anxious.',
    catalog: recommendationCatalog,
    modelRecommendationId: 'anxiety'
  }), null);
  assert.equal(isReadyMeditationRequest('Дай мне медитацию из приложения'), true);
});

test('ambiguous tired context asks for clarification instead of guessing a goal', () => {
  assert.equal(isAmbiguousSleepyTiredContext('Я сонный и устал.'), true);
  assert.equal(semanticMeditationRecommendation({
    message: 'Я сонный и устал.',
    catalog: recommendationCatalog,
    modelRecommendationId: 'sleep'
  }), null);
});

test('clear focus and clear sleep intents select one matching meditation', () => {
  assert.equal(semanticMeditationRecommendation({
    message: 'Давай направим внимание, мне нужен фокус.',
    catalog: recommendationCatalog,
    modelRecommendationId: null
  }), 'focus');
  assert.equal(semanticMeditationRecommendation({
    message: 'I want to sleep now.',
    catalog: recommendationCatalog,
    modelRecommendationId: null
  }), 'sleep');
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

test('uses one exact human-readable catalog duration formatter', () => {
  assert.equal(formatMeditationDuration(900, 'en'), '15 min');
  assert.equal(formatMeditationDuration(900, 'ru'), '15 мин');
});
