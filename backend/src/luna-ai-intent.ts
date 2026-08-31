import { isAlternativeRecommendationRequest, isInChatGuidanceRequest, type RecommendationCatalogItem } from './luna-ai-policy.js';
import type { PendingLunaState } from './luna-ai-pending.js';
import type { LunaConversationGoal, LunaConversationState } from './luna-ai-state.js';

export const lunaRuntimeIntents = [
  'recommend_meditation',
  'open_meditation',
  'continue_previous_topic',
  'general_chat',
  'breathing',
  'sleep',
  'focus',
  'anxiety',
  'reset',
  'journal',
  'premium',
  'relationship',
  'science'
] as const;

export type LunaRuntimeIntent = typeof lunaRuntimeIntents[number];

export type LunaIntentResolution = {
  intent: LunaRuntimeIntent;
  goal: LunaConversationGoal | null;
  topic: string | null;
  action: 'recommend_meditation' | 'open_meditation' | 'none';
  meditationId: string | null;
  confidence: number;
  continuation: boolean;
  reason: string;
};

function normalize(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
}

function isConfirmation(message: string) {
  return /^(?:yes|yeah|yep|sure|ok|okay|show|show it|show me|send it|send me|open|open it|start|start it|да|ага|хорошо|покажи|покажи мне|пришли|пришли мне|пришли её|пришли ее|открой|открывай|начни|запусти)[.! ]*$/i.test(message.trim());
}

function namedMeditation(message: string, catalog: RecommendationCatalogItem[]) {
  const normalizedMessage = normalize(message);
  const matches = catalog.filter((item) => {
    const title = normalize(item.title);
    const key = normalize(item.catalogKey ?? '');
    return Boolean(title && normalizedMessage.includes(title)) || Boolean(key && normalizedMessage.includes(key));
  });
  return matches.length === 1 ? matches[0]?.id ?? null : null;
}

function detectedGoal(message: string): LunaConversationGoal | null {
  const patterns: Array<[LunaConversationGoal, RegExp]> = [
    ['sleep', /\b(?:can(?:not|'t) sleep|need sleep|help me sleep|go to sleep|insomnia|sleep meditation|bedtime)\b|(?:не могу уснуть|не спится|хочу уснуть|нуж(?:ен|на) сон|для сна|бессон|помоги уснуть)/i],
    ['focus', /\b(?:need (?:to )?focus|help me focus|cannot focus|can't focus|concentrate|mental clarity|focus meditation)\b|(?:нужен фокус|не могу сосредоточ|хочу сосредоточ|для фокуса|нужна ясность|внимание|концентрац)/i],
    ['reset', /\b(?:need (?:a )?reset|soft reset|gentle reset|stress reset|restart my mind)\b|(?:нужна перезагрузка|хочу перезагруз|мягк(?:ая|ую) перезагруз|сбросить напряжение|начать заново)/i],
    ['breathing', /\b(?:show me breathing|breathing practice|breathwork|breath exercise|help me breathe)\b|(?:покажи дыхан|дыхательн(?:ая|ую) практик|дыхательное упражнение|помоги дышать)/i],
    ['anxiety', /\b(?:i am anxious|i'm anxious|feel anxious|my anxiety|panic|overwhelmed|worried)\b|(?:мне тревожно|я тревожусь|тревога|паника|я перегруж|мне страшно)/i]
  ];
  return patterns.find(([, pattern]) => pattern.test(message))?.[0] ?? null;
}

function shortGoal(message: string): LunaConversationGoal | null {
  const normalized = normalize(message);
  if (/^(?:sleep|bed|сон|спать|уснуть|сна)$/.test(normalized)) return 'sleep';
  if (/^(?:focus|clarity|attention|фокус|ясность|внимание|сосредоточиться)$/.test(normalized)) return 'focus';
  if (/^(?:reset|restart|soft reset|gentle reset|перезагрузка|перезагрузиться|сброс|мягкая перезагрузка)$/.test(normalized)) return 'reset';
  if (/^(?:breathing|breath|breathe|дыхание|подышать|дыхательная практика)$/.test(normalized)) return 'breathing';
  if (/^(?:anxiety|anxious|panic|тревога|тревожно|паника)$/.test(normalized)) return 'anxiety';
  return null;
}

function nonMeditationIntent(message: string): LunaRuntimeIntent | null {
  if (/\b(?:journal|journaling|write this down|reflection note)\b|(?:дневник|записать мысли|рефлекси)/i.test(message)) return 'journal';
  if (/\b(?:premium|subscription|payment|stars|plan)\b|(?:премиум|подписк|оплат|звёзд|звезд|тариф)/i.test(message)) return 'premium';
  if (/\b(?:relationship|partner|boyfriend|girlfriend|husband|wife|dating|breakup)\b|(?:отношен|партнёр|партнер|муж|жена|расставан|свидан)/i.test(message)) return 'relationship';
  if (/\b(?:science|research|evidence|study|neuroscience|how does .* work)\b|(?:наук|исследован|доказатель|нейро|как .* работает)/i.test(message)) return 'science';
  return null;
}

function recommendationRequest(message: string) {
  return /\b(?:recommend|suggest|pick|choose|send|show|open|start|meditation|practice)\b|(?:посоветуй|подбери|выбери|пришли|покажи|открой|запусти|начни|медитац|практик)/i.test(message) ||
    isAlternativeRecommendationRequest(message);
}

function directActionRequest(message: string) {
  return /\b(?:open|show|send|start|play)\b|(?:открой|покажи|пришли|запусти|начни|включи)/i.test(message);
}

function intentForGoal(goal: LunaConversationGoal): LunaRuntimeIntent {
  if (goal === 'reset') return 'reset';
  if (goal === 'breathing') return 'breathing';
  if (goal === 'sleep' || goal === 'focus' || goal === 'anxiety') return goal;
  return goal;
}

export function resolveLunaIntent(input: {
  message: string;
  state: LunaConversationState;
  pendingState: PendingLunaState | null;
  catalog: RecommendationCatalogItem[];
}): LunaIntentResolution {
  const namedId = namedMeditation(input.message, input.catalog);
  const confirmation = isConfirmation(input.message);
  const previousMeditationId = input.pendingState?.pending_meditation_id
    ?? input.state.current_recommendation_id
    ?? input.state.current_meditation_id;

  if (confirmation && previousMeditationId) {
    return {
      intent: 'open_meditation', goal: input.state.current_goal, topic: input.state.current_topic,
      action: 'open_meditation', meditationId: previousMeditationId, confidence: 1, continuation: true,
      reason: 'confirmation_continues_persisted_meditation_action'
    };
  }

  if (namedId && directActionRequest(input.message)) {
    return {
      intent: 'open_meditation', goal: input.state.current_goal, topic: 'meditation',
      action: 'open_meditation', meditationId: namedId, confidence: 1, continuation: false,
      reason: 'explicit_catalog_title_action'
    };
  }

  if (isInChatGuidanceRequest(input.message)) {
    return {
      intent: 'breathing', goal: input.state.current_goal ?? 'breathing', topic: input.state.current_topic ?? 'breathing',
      action: 'none', meditationId: null, confidence: 0.99, continuation: Boolean(input.state.current_topic),
      reason: 'guided_exercise_requested_in_chat'
    };
  }

  const conciseGoal = shortGoal(input.message);
  const messageGoal = detectedGoal(input.message);
  const goal = conciseGoal ?? messageGoal;
  if (goal) {
    const continuation = Boolean(conciseGoal && (
      input.pendingState?.pending_action === 'choose_meditation'
      || input.state.current_intent === 'recommend_meditation'
      || input.state.previous_assistant_question
    ));
    return {
      intent: intentForGoal(goal), goal, topic: goal,
      action: 'recommend_meditation', meditationId: null, confidence: conciseGoal || messageGoal ? 0.98 : 0.9,
      continuation, reason: continuation ? 'short_reply_resolves_previous_meditation_choice' : 'clear_goal_requires_immediate_practice'
    };
  }

  const otherIntent = nonMeditationIntent(input.message);
  if (otherIntent) {
    return {
      intent: otherIntent,
      goal: otherIntent as LunaConversationGoal,
      topic: otherIntent,
      action: 'none', meditationId: namedId, confidence: 0.95, continuation: false,
      reason: 'explicit_non_meditation_topic'
    };
  }

  if (recommendationRequest(input.message)) {
    const inheritedGoal = input.state.current_goal && ['sleep', 'focus', 'anxiety', 'reset', 'breathing'].includes(input.state.current_goal)
      ? input.state.current_goal
      : null;
    return {
      intent: namedId && directActionRequest(input.message) ? 'open_meditation' : 'recommend_meditation',
      goal: inheritedGoal,
      topic: inheritedGoal ?? 'meditation',
      action: namedId && directActionRequest(input.message) ? 'open_meditation' : 'recommend_meditation',
      meditationId: namedId,
      confidence: namedId || inheritedGoal ? 0.98 : 0.75,
      continuation: Boolean(inheritedGoal || input.pendingState),
      reason: namedId ? 'explicit_catalog_reference' : inheritedGoal ? 'recommendation_continues_current_goal' : 'generic_meditation_request'
    };
  }

  if (confirmation && input.state.current_intent) {
    return {
      intent: 'continue_previous_topic', goal: input.state.current_goal, topic: input.state.current_topic,
      action: 'none', meditationId: previousMeditationId, confidence: 0.9, continuation: true,
      reason: 'short_confirmation_continues_previous_topic'
    };
  }

  return {
    intent: 'general_chat', goal: null, topic: input.state.current_topic,
    action: 'none', meditationId: namedId, confidence: 0.7, continuation: Boolean(input.state.current_topic),
    reason: input.state.current_topic ? 'general_message_keeps_recent_context_available' : 'new_general_conversation'
  };
}

export function directMeditationResponse(input: {
  language: 'en' | 'ru';
  intent: LunaRuntimeIntent;
  title: string;
  continuation: boolean;
}) {
  const { title } = input;
  if (input.language === 'ru') {
    if (input.intent === 'sleep') return `Давай сделаем этот вечер немного тише. Сейчас лучше всего подойдёт ${title}.`;
    if (input.intent === 'focus') return `${title} лучше всего подойдёт для ясности и мягкого фокуса.`;
    if (input.intent === 'reset') return `Давай устроим мыслям мягкую перезагрузку. Сейчас лучше всего подойдёт ${title}.`;
    if (input.intent === 'breathing') return `Давай немного замедлимся. Сейчас лучше всего подойдёт ${title}.`;
    if (input.intent === 'anxiety') return `Похоже, сейчас непросто. Я выбрала ${title}, чтобы помочь немного замедлиться.`;
    if (input.continuation) return `${title} — именно та практика, о которой мы говорили.`;
    return `${title} сейчас подходит лучше всего.`;
  }

  if (input.intent === 'sleep') return `Let's make tonight a little quieter. ${title} fits this moment best.`;
  if (input.intent === 'focus') return `${title} fits the kind of clarity and gentle focus you need right now.`;
  if (input.intent === 'reset') return `Let's give your mind a softer reset. ${title} fits this moment best.`;
  if (input.intent === 'breathing') return `Let's slow things down a little. ${title} fits this moment best.`;
  if (input.intent === 'anxiety') return `That sounds like a lot to carry. I chose ${title} to help things settle a little.`;
  if (input.continuation) return `${title} is the practice we were talking about.`;
  return `${title} feels like the right practice for this moment.`;
}
