import { z } from 'zod';

export const memoryCategories = [
  'identity_preference', 'communication_preference', 'mindfulness_goal', 'sleep', 'stress',
  'routine', 'meditation_preference', 'ongoing_context', 'avoidance_preference'
] as const;

export const memoryCandidateSchema = z.object({
  category: z.enum(memoryCategories),
  key: z.string().regex(/^[a-z0-9_]{3,64}$/),
  value: z.string().min(5).max(300),
  confidence: z.number().min(0).max(1)
});

export function validMemoryCandidates(candidates: unknown[]) {
  return candidates.flatMap((candidate) => {
    const parsed = memoryCandidateSchema.safeParse(candidate);
    return parsed.success && parsed.data.confidence >= 0.78 ? [parsed.data] : [];
  }).slice(0, 3);
}

export function isCrisisMessage(message: string) {
  return /\b(kill myself|suicide|end my life|hurt myself|cannot stay safe|can't stay safe)\b/i.test(message) ||
    /(покончи(ть)? с собой|самоубий|убить себя|навредить себе|не могу оставаться в безопасности)/i.test(message);
}

export function safetyCategory(message: string): 'self_harm' | 'medical_emergency' | 'violence' | null {
  if (isCrisisMessage(message)) return 'self_harm';
  if (/\b(chest pain|cannot breathe|can't breathe|severe bleeding|overdose|unconscious)\b/i.test(message) || /(боль в груди|не могу дышать|сильное кровотечение|передозиров|без сознания)/i.test(message)) return 'medical_emergency';
  if (/\b(immediate danger|being attacked|someone will hurt me|domestic violence)\b/i.test(message) || /(непосредственной опасности|на меня напали|меня избивают|домашнее насилие)/i.test(message)) return 'violence';
  return null;
}

export function validatedMeditationId(candidate: string | null, availableIds: Iterable<string>) {
  if (!candidate) return null;
  return new Set(availableIds).has(candidate) ? candidate : null;
}

export type RecommendationCatalogItem = {
  id: string;
  title: string;
  category?: string | null;
  mood?: string | null;
  duration?: number | null;
  premium?: boolean | null;
  language?: string | null;
  summary?: string | null;
};

const intentPriority: Record<string, string[]> = {
  anxiety: ['anxiety relief', 'breath reset'],
  sleep: ['deep sleep', 'let go'],
  self_kindness: ['self love'],
  grounding: ['inner balance', 'breath reset'],
  morning: ['morning clarity']
};

const intentKeywords: Record<string, RegExp> = {
  anxiety: /\b(anxious|anxiety|panic|worried|worry|stress|stressed|overwhelmed|нервнича|тревог|паник|стресс|перегруж)\b/i,
  sleep: /\b(can't sleep|cannot sleep|insomnia|sleep|bed|night|tired|уснуть|спать|сон|бессон|ноч)\b/i,
  self_kindness: /\b(self[- ]?criticism|hate myself|not good enough|shame|guilt|criticizing myself|самокрит|ненавижу себя|стыд|вина|недостаточно хорош)\b/i,
  grounding: /\b(ground|grounding|dissociate|scattered|unsteady|center|balance|заземл|рассеян|неустойчив|баланс|собраться)\b/i,
  morning: /\b(morning|start my day|wake up|routine|focus today|утро|утрен|начать день|рутин|просну)\b/i
};

function normalize(value: unknown) {
  return typeof value === 'string' ? value.toLowerCase().replace(/[^a-zа-я0-9]+/gi, ' ').trim() : '';
}

function detectIntent(message: string) {
  return Object.entries(intentKeywords).find(([, pattern]) => pattern.test(message))?.[0] ?? null;
}

function recommendationScore(item: RecommendationCatalogItem, intent: string) {
  const haystack = normalize(`${item.title} ${item.category ?? ''} ${item.mood ?? ''} ${item.summary ?? ''}`);
  const priority = intentPriority[intent] ?? [];
  const priorityIndex = priority.findIndex((title) => normalize(item.title).includes(title));
  let score = priorityIndex >= 0 ? 100 - priorityIndex * 10 : 0;

  const intentTerms: Record<string, string[]> = {
    anxiety: ['anxiety', 'relief', 'breath', 'stress', 'calm', 'тревог', 'стресс'],
    sleep: ['sleep', 'deep', 'night', 'let go', 'rest', 'сон'],
    self_kindness: ['self love', 'love', 'compassion', 'kindness', 'само'],
    grounding: ['inner balance', 'balance', 'ground', 'breath', 'center'],
    morning: ['morning', 'clarity', 'focus', 'energy']
  };

  for (const term of intentTerms[intent] ?? []) {
    if (haystack.includes(normalize(term))) score += 8;
  }

  return score;
}

export function semanticMeditationRecommendation(input: {
  message: string;
  catalog: RecommendationCatalogItem[];
  modelRecommendationId?: string | null;
  recentAssistantRecommendations?: Array<string | null | undefined>;
}) {
  const recentRecommendations = input.recentAssistantRecommendations ?? [];
  if (recentRecommendations.slice(-3).some(Boolean)) return null;

  const intent = detectIntent(input.message);
  if (!intent) return null;

  const available = input.catalog.filter((item) => item.id && item.title);
  const modelItem = input.modelRecommendationId ? available.find((item) => item.id === input.modelRecommendationId) : null;
  if (modelItem && recommendationScore(modelItem, intent) >= 16) return modelItem.id;

  const ranked = available
    .map((item) => ({ item, score: recommendationScore(item, intent) }))
    .filter((entry) => entry.score >= 16)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.item.id ?? null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sanitizeMeditationFacts(message: string, catalog: RecommendationCatalogItem[]) {
  let next = message;
  for (const item of catalog) {
    if (!item.title || !item.duration) continue;
    const minutes = Math.max(1, Math.ceil(item.duration / 60));
    const title = escapeRegExp(item.title);
    const titleThenDuration = new RegExp(`(${title}[^.!?\\n]{0,80}?)(\\b\\d+\\s*(?:minute|minutes|min|минут|мин)\\b)`, 'gi');
    const durationThenTitle = new RegExp(`(\\b\\d+\\s*(?:minute|minutes|min|минут|мин)\\b)([^.!?\\n]{0,80}?${title})`, 'gi');
    next = next
      .replace(titleThenDuration, (_match, before: string) => `${before}${minutes} min`)
      .replace(durationThenTitle, (_match, _duration: string, after: string) => `${minutes} min${after}`);
  }
  return next;
}
