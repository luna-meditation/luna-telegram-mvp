import { clarificationHash } from './luna-ai-pending.js';

export const lunaConversationGoals = [
  'sleep', 'focus', 'anxiety', 'reset', 'breathing', 'journal', 'premium', 'relationship', 'science'
] as const;

export type LunaConversationGoal = typeof lunaConversationGoals[number];

export type LunaConversationState = {
  version: 1;
  current_topic: string | null;
  current_goal: LunaConversationGoal | null;
  current_intent: string | null;
  current_meditation_id: string | null;
  current_recommendation_id: string | null;
  previous_assistant_question: string | null;
  previous_assistant_question_hash: string | null;
  last_user_decision: string | null;
  assistant_messages_since_question: number;
  language: 'en' | 'ru' | null;
  updated_at: string;
};

export type RecentConversationMessage = {
  role?: string | null;
  content?: string | null;
  metadata?: unknown;
};

const emptyState = (): LunaConversationState => ({
  version: 1,
  current_topic: null,
  current_goal: null,
  current_intent: null,
  current_meditation_id: null,
  current_recommendation_id: null,
  previous_assistant_question: null,
  previous_assistant_question_hash: null,
  last_user_decision: null,
  assistant_messages_since_question: 4,
  language: null,
  updated_at: new Date(0).toISOString()
});

function nullableString(value: unknown, maxLength = 500) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;
}

function normalizeGoal(value: unknown): LunaConversationGoal | null {
  return typeof value === 'string' && lunaConversationGoals.includes(value as LunaConversationGoal)
    ? value as LunaConversationGoal
    : null;
}

export function normalizeConversationState(value: unknown): LunaConversationState {
  const fallback = emptyState();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const candidate = value as Record<string, unknown>;
  const count = Number(candidate.assistant_messages_since_question);
  return {
    version: 1,
    current_topic: nullableString(candidate.current_topic, 120),
    current_goal: normalizeGoal(candidate.current_goal),
    current_intent: nullableString(candidate.current_intent, 80),
    current_meditation_id: nullableString(candidate.current_meditation_id, 100),
    current_recommendation_id: nullableString(candidate.current_recommendation_id, 100),
    previous_assistant_question: nullableString(candidate.previous_assistant_question),
    previous_assistant_question_hash: nullableString(candidate.previous_assistant_question_hash, 64),
    last_user_decision: nullableString(candidate.last_user_decision, 160),
    assistant_messages_since_question: Number.isFinite(count) ? Math.max(0, Math.min(20, Math.floor(count))) : 4,
    language: candidate.language === 'en' || candidate.language === 'ru' ? candidate.language : null,
    updated_at: nullableString(candidate.updated_at, 40) ?? fallback.updated_at
  };
}

export function lastAssistantQuestion(message: string) {
  const trimmed = message.trim();
  if (!trimmed.includes('?')) return null;
  const sentences = trimmed.split(/(?<=[.!?])\s+/u);
  return [...sentences].reverse().find((sentence) => sentence.includes('?'))?.slice(0, 500) ?? null;
}

export function assistantQuestionHash(message: string) {
  const question = lastAssistantQuestion(message);
  return question ? clarificationHash(question) : null;
}

export function recoverConversationState(stored: unknown, recent: RecentConversationMessage[]) {
  const state = normalizeConversationState(stored);
  const assistants = recent.filter((message) => message.role === 'assistant');
  const latestAssistant = assistants.at(-1);
  const latestMetadata = latestAssistant?.metadata as {
    recommendedMeditationId?: unknown;
    meditationAction?: { meditationId?: unknown } | null;
    resolvedIntent?: unknown;
  } | null;
  const latestRecommendation = nullableString(
    latestMetadata?.recommendedMeditationId ?? latestMetadata?.meditationAction?.meditationId,
    100
  );
  const question = state.previous_assistant_question ?? lastAssistantQuestion(latestAssistant?.content ?? '');
  const messagesSinceQuestion = question && !state.previous_assistant_question
    ? 0
    : state.assistant_messages_since_question;

  return {
    ...state,
    current_intent: state.current_intent ?? nullableString(latestMetadata?.resolvedIntent, 80),
    current_meditation_id: state.current_meditation_id ?? latestRecommendation,
    current_recommendation_id: state.current_recommendation_id ?? latestRecommendation,
    previous_assistant_question: question,
    previous_assistant_question_hash: state.previous_assistant_question_hash ?? (question ? clarificationHash(question) : null),
    assistant_messages_since_question: messagesSinceQuestion
  } satisfies LunaConversationState;
}

export function updateConversationState(input: {
  previous: LunaConversationState;
  intent: string;
  goal: LunaConversationGoal | null;
  topic: string | null;
  meditationId: string | null;
  assistantMessage: string;
  userDecision: string;
  language: 'en' | 'ru';
  clearMeditationContext?: boolean;
}) {
  const question = lastAssistantQuestion(input.assistantMessage);
  const meditationId = input.meditationId
    ?? (input.clearMeditationContext ? null : input.previous.current_meditation_id);
  const recommendationId = input.meditationId
    ?? (input.clearMeditationContext ? null : input.previous.current_recommendation_id);
  return {
    version: 1,
    current_topic: input.topic ?? input.previous.current_topic,
    current_goal: input.goal ?? input.previous.current_goal,
    current_intent: input.intent,
    current_meditation_id: meditationId,
    current_recommendation_id: recommendationId,
    previous_assistant_question: question ?? input.previous.previous_assistant_question,
    previous_assistant_question_hash: question
      ? clarificationHash(question)
      : input.previous.previous_assistant_question_hash,
    last_user_decision: input.userDecision.trim().slice(0, 160) || input.previous.last_user_decision,
    assistant_messages_since_question: question
      ? 0
      : Math.min(20, input.previous.assistant_messages_since_question + 1),
    language: input.language,
    updated_at: new Date().toISOString()
  } satisfies LunaConversationState;
}
