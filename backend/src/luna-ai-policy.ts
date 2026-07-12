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
  /\b(?:recommendedMeditationId|audio_url|audioUrl|storage_path|database id)\b[^\n,.]*/gi,
  /\bid\s*[=:]\s*[^\n,.]*/gi,
  /\b(?:with|с)\s+id\b[^\n,.]*/gi,
  /```json[\s\S]*?```/gi,
  /\{[^{}]*(?:recommendedMeditationId|audio_url|audioUrl|storage_path|"id"|id\s*:)[^{}]*\}/gi
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

export function hasInternalDataLeak(message: string) {
  return internalDataPatterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(message);
  });
}

export function isReadyMeditationRequest(message: string) {
  return /\b(?:recommend|suggest|send|give me|pick|choose|what should i listen|what to listen|meditation|practice from the app|audio practice)\b/i.test(message) ||
    /(?:пришли|отправь|дай|подбери|посоветуй|выбери|можешь\s+(?:сюда\s+)?прислать|сюда\s+прислать|что\s+(?:мне\s+)?послушать|медитац|практик[ау]\s+из\s+приложения)/i.test(message);
}

export function isInChatGuidanceRequest(message: string) {
  return /\b(?:guide me here|walk me through|do it with me|right here|in chat|i don't want to open audio|i do not want to open audio)\b/i.test(message) ||
    /(?:проведи\s+меня\s+сейчас|сделай\s+со\s+мной|прямо\s+здесь|в\s+чате|не\s+хочу\s+открывать\s+аудио|без\s+аудио)/i.test(message);
}

export function isAmbiguousSleepyTiredContext(message: string) {
  const sleepy = /\b(?:sleepy|tired|exhausted|drowsy)\b/i.test(message) || /(?:сонн|устал|уставш|выжат)/i.test(message);
  if (!sleepy) return false;
  const clearSleep = /\b(?:sleep|bed|rest|insomnia|night|go to sleep)\b/i.test(message) || /(?:спать|уснуть|сон\b|сна\b|кровать|отдых|ноч)/i.test(message);
  const clearFocus = /\b(?:focus|awake|energy|work|code|concentrate|clarity)\b/i.test(message) || /(?:фокус|вниман|взбодр|энерг|работ|код|ясност|сосредоточ)/i.test(message);
  return !clearSleep && !clearFocus;
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
  anxiety: /(anxious|anxiety|panic|worried|worry|stress|stressed|overwhelmed|нервнича|тревог|паник|стресс|перегруж)/i,
  sleep: /(can't sleep|cannot sleep|insomnia|sleep|bed|night|tired|уснуть|спать|сон\b|сна\b|бессон|ноч)/i,
  self_kindness: /(self[- ]?criticism|hate myself|not good enough|shame|guilt|criticizing myself|самокрит|ненавижу себя|стыд|вина|недостаточно хорош)/i,
  focus: /(overthink|thoughts won.t stop|mental noise|cannot focus|can't focus|concentrate|attention|clarity|зацик|мысли не останавли|не могу сосредоточ|фокус|вниман|ясност)/i,
  grounding: /(ground|grounding|dissociate|scattered|unsteady|center|balance|заземл|рассеян|неустойчив|баланс|собраться)/i,
  morning: /(morning|start my day|wake up|routine|focus today|утро|утрен|начать день|рутин|просну)/i
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
  recentMessages?: Array<{ role?: string | null; content?: string | null }>;
}) {
  const recentRecommendations = input.recentAssistantRecommendations ?? [];
  const explicitlyRequested = isReadyMeditationRequest(input.message);
  if (isInChatGuidanceRequest(input.message)) return null;
  if (isAmbiguousSleepyTiredContext(input.message) && !explicitlyRequested) return null;
  if (!explicitlyRequested && recentRecommendations.slice(-3).some(Boolean)) return null;

  if (/^(?:thanks?|thank you|okay|ok|got it|спасибо|понятно|хорошо|ок)[.! ]*$/i.test(input.message.trim())) return null;

  const recentContext = (input.recentMessages ?? [])
    .filter((message) => message.role !== 'assistant')
    .slice(-4)
    .map((message) => message.content ?? '')
    .join('\n');
  const intent = detectIntent(input.message) ?? (explicitlyRequested ? detectIntent(`${recentContext}\n${input.message}`) : null);

  const available = input.catalog.filter((item) => item.id && item.title && (!input.language || !item.language || item.language === input.language));
  if (explicitlyRequested && !intent) {
    if (input.modelRecommendationId && available.some((item) => item.id === input.modelRecommendationId)) return input.modelRecommendationId;
    const latestRecent = [...recentRecommendations].reverse().find(Boolean);
    if (latestRecent && available.some((item) => item.id === latestRecent)) return latestRecent;
  }
  if (!intent) return null;

  const modelItem = input.modelRecommendationId ? available.find((item) => item.id === input.modelRecommendationId) : null;
  if (modelItem && recommendationScore(modelItem, intent) >= 16 && (explicitlyRequested || !recentRecommendations.includes(modelItem.id))) return modelItem.id;

  const ranked = available
    .map((item) => ({ item, score: recommendationScore(item, intent) }))
    .filter((entry) => entry.score >= 16 && (explicitlyRequested || !recentRecommendations.includes(entry.item.id)))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.item.id ?? null;
}

export function meditationIdMentionedInText(message: string, catalog: RecommendationCatalogItem[]) {
  const normalizedMessage = normalize(message);
  if (!normalizedMessage) return null;
  const matches = catalog.filter((item) => item.id && item.title && normalizedMessage.includes(normalize(item.title)));
  return matches.length === 1 ? matches[0]?.id ?? null : null;
}

export function meditationCardInstruction(language: LunaLanguage) {
  return language === 'ru'
    ? 'Открой карточку ниже, когда будешь готов(а).'
    : 'Open the card below whenever you are ready.';
}

export function avoidLibraryInstructionWhenCardExists(message: string, language: LunaLanguage, hasRecommendation: boolean) {
  if (!hasRecommendation) return message;
  const libraryInstruction = /\b(?:open|go to|find it in|search(?: for)?|look in|tap)\s+(?:the\s+)?(?:library|catalog|meditation section)\b[^.!?]*(?:[.!?]|$)|(?:открой|перейди|найди|поищи|зайди)[^.!?\n]{0,72}(?:библиотек|каталог|раздел медитац)[^.!?]*(?:[.!?]|$)/gi;
  const next = message.replace(libraryInstruction, meditationCardInstruction(language));
  return next.replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim();
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
