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
  duration?: number | string | null;
  premium?: boolean | null;
  language?: string | null;
  summary?: string | null;
};

export function meditationDurationMinutes(seconds: number | string | null | undefined) {
  return Math.max(1, Math.round(Math.max(0, Number(seconds) || 0) / 60));
}

export function formatMeditationDuration(seconds: number | string | null | undefined, language: LunaLanguage) {
  const minutes = meditationDurationMinutes(seconds);
  return language === 'ru' ? `${minutes} мин` : `${minutes} min`;
}

export type LunaLanguage = 'en' | 'ru';

const cyrillicPattern = /[\u0400-\u04ff]/g;
const latinPattern = /[a-z]/gi;

export function detectConversationLanguage(message: string, fallback: LunaLanguage): LunaLanguage {
  const cyrillic = message.match(cyrillicPattern)?.length ?? 0;
  const latin = message.match(latinPattern)?.length ?? 0;
  if (cyrillic >= 2 && cyrillic >= latin * 0.35) return 'ru';
  if (latin >= 3 && latin > cyrillic * 2) return 'en';
  return fallback;
}

export function containsMasculineLunaSelfReference(message: string) {
  return /(?:^|[\s.!?])я\s+(?:понял|готов|переключился|создан|уверен|рад|сделал|решил)(?=$|[\s,.!?])/i.test(message);
}

export function enforceLunaFeminineIdentity(message: string, language: LunaLanguage) {
  if (language !== 'ru' || !containsMasculineLunaSelfReference(message)) return message;
  return 'Я рядом. Хочу ответить тебе бережно и точно — напиши, пожалуйста, ещё раз.';
}

const internalDataPatterns = [
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
  /https?:\/\/\S*(?:storage|supabase|audio)\S*/gi,
  /\b(?:recommendedMeditationId|audio_url|audioUrl|storage_path|database id|id\s*=)\b[^\n,.]*/gi,
  /```json[\s\S]*?```/gi
];

const playbackClaims = [
  /\b(?:i(?:'ve| have)? started|i(?:'ll| will) start|let me play|i(?:'m| am) starting)\b[^.!?]*/gi,
  /\b(?:я (?:запустила|включила|начну)|сейчас (?:запущу|включу))\b[^.!?]*/gi
];

export function sanitizeVisibleAssistantMessage(message: string, language: LunaLanguage) {
  let next = message;
  for (const pattern of internalDataPatterns) next = next.replace(pattern, '');
  for (const pattern of playbackClaims) {
    next = next.replace(pattern, language === 'ru' ? 'Медитация готова ниже — открой её, когда будешь готов(а)' : 'The meditation is ready below — open it whenever you are ready');
  }
  const inventedPath = /\b(?:open|go to|look in|tap)\s+(?:the\s+)?(?:settings|support|about)(?:\s+(?:page|section|menu))?\b|(?:^|[\s.!?])(?:открой|перейди|зайди|нажми)[^.!?\n]{0,48}(?:настройк|поддержк|о приложении|about)/i;
  if (inventedPath.test(next)) {
    return language === 'ru'
      ? 'Честно, я не уверена, что такой раздел сейчас есть, поэтому не хочу придумывать путь по интерфейсу.'
      : "Honestly, I'm not sure that section exists right now, so I don't want to invent a path through the app.";
  }
  return next.replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim();
}

const intentPriority: Record<string, string[]> = {
  anxiety: ['anxiety relief', 'breath reset'],
  sleep: ['deep sleep', 'let go'],
  self_kindness: ['self love'],
  focus: ['focused calm'],
  grounding: ['inner balance', 'breath reset'],
  morning: ['morning clarity']
};

const intentKeywords: Record<string, RegExp> = {
  anxiety: /\b(anxious|anxiety|panic|worried|worry|stress|stressed|overwhelmed|нервнича|тревог|паник|стресс|перегруж)\b/i,
  sleep: /\b(can't sleep|cannot sleep|insomnia|sleep|bed|night|tired|уснуть|спать|сон|бессон|ноч)\b/i,
  self_kindness: /\b(self[- ]?criticism|hate myself|not good enough|shame|guilt|criticizing myself|самокрит|ненавижу себя|стыд|вина|недостаточно хорош)\b/i,
  focus: /\b(overthink|thoughts won.t stop|mental noise|cannot focus|can't focus|concentrate|зацик|мысли не останавли|не могу сосредоточ|фокус)\b/i,
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
    focus: ['focused calm', 'focus', 'clarity', 'mental noise'],
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
  language?: LunaLanguage;
  modelRecommendationId?: string | null;
  recentAssistantRecommendations?: Array<string | null | undefined>;
}) {
  const recentRecommendations = input.recentAssistantRecommendations ?? [];
  const explicitlyRequested = /\b(recommend|meditation|what should i listen|send me|подбери|посоветуй|медитац|что послушать)\b/i.test(input.message);
  if (!explicitlyRequested && recentRecommendations.slice(-3).some(Boolean)) return null;

  if (/^(?:thanks?|thank you|okay|ok|got it|спасибо|понятно|хорошо|ок)[.! ]*$/i.test(input.message.trim())) return null;

  const intent = detectIntent(input.message);
  if (!intent) return null;

  const available = input.catalog.filter((item) => item.id && item.title && (!input.language || !item.language || item.language === input.language));
  const modelItem = input.modelRecommendationId ? available.find((item) => item.id === input.modelRecommendationId) : null;
  if (modelItem && recommendationScore(modelItem, intent) >= 16 && !recentRecommendations.includes(modelItem.id)) return modelItem.id;

  const ranked = available
    .map((item) => ({ item, score: recommendationScore(item, intent) }))
    .filter((entry) => entry.score >= 16 && !recentRecommendations.includes(entry.item.id))
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
    const minutes = meditationDurationMinutes(item.duration);
    const title = escapeRegExp(item.title);
    const titleThenDuration = new RegExp(`(${title}[^.!?\\n]{0,80}?)(\\b\\d+\\s*(?:minute|minutes|min|минут|мин)\\b)`, 'gi');
    const durationThenTitle = new RegExp(`(\\b\\d+\\s*(?:minute|minutes|min|минут|мин)\\b)([^.!?\\n]{0,80}?${title})`, 'gi');
    next = next
      .replace(titleThenDuration, (_match, before: string) => `${before}${minutes} min`)
      .replace(durationThenTitle, (_match, _duration: string, after: string) => `${minutes} min${after}`);
  }
  return next;
}
