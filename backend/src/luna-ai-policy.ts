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

function memoryCandidateIsGrounded(candidate: z.infer<typeof memoryCandidateSchema>, sourceMessage: string) {
  const source = normalize(sourceMessage);
  const genericTokens = new Set(['user', 'person', 'prefers', 'preference', 'likes', 'like', 'usually', 'often', 'тебе', 'пользователь', 'любит', 'предпочитает']);
  const meaningfulTokens = normalize(`${candidate.key.replace(/_/g, ' ')} ${candidate.value}`)
    .split(' ')
    .filter((token) => token.length >= 4 && !genericTokens.has(token));
  return meaningfulTokens.some((token) => source.includes(token));
}

export function validMemoryCandidates(candidates: unknown[], sourceMessage?: string) {
  return candidates.flatMap((candidate) => {
    const parsed = memoryCandidateSchema.safeParse(candidate);
    if (!parsed.success || parsed.data.confidence < 0.78) return [];
    if (sourceMessage && !memoryCandidateIsGrounded(parsed.data, sourceMessage)) return [];
    return [parsed.data];
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
  catalogKey?: string | null;
  title: string;
  category?: string | null;
  mood?: string | null;
  duration?: number | string | null;
  premium?: boolean | null;
  published?: boolean | null;
  language?: string | null;
  summary?: string | null;
  tags?: string[] | null;
};

const cardClaimPatterns = [
  /(?:карточк[ауи]\s+(?:ниже|здесь)|показываю\s+(?:карточк|медитац)|я\s+(?:открыла|показала)\s+карточк|открой\s+карточк[ау]\s+ниже)/i,
  /(?:card\s+(?:below|here)|showing\s+(?:the\s+)?(?:card|meditation)|i (?:opened|showed) the card|tap the card below)/i
];

export function messageClaimsMeditationCard(message: string) {
  return cardClaimPatterns.some((pattern) => pattern.test(message));
}

export function enforceCardClaimConsistency(message: string, language: LunaLanguage, hasRecommendation: boolean) {
  if (hasRecommendation || !messageClaimsMeditationCard(message)) return message;
  return language === 'ru'
    ? 'Я могу помочь подобрать медитацию, когда пойму, что тебе сейчас нужнее всего.'
    : 'I can help choose a meditation once I understand what would support you most right now.';
}

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
    /(?:пришли|отправь|дай|подбери|посоветуй|выбери|покажи|можешь\s+(?:сюда\s+)?прислать|сюда\s+прислать|можно\s+(?:её\s+)?увидеть|увидеть\s+(?:её\s+)?(?:здесь|в\s+чате)|что\s+(?:мне\s+)?послушать|медитац|практик[ау]\s+из\s+приложения)/i.test(message);
}

export function isVulnerableMessage(message: string) {
  return /\b(?:anxious|anxiety|panic|overwhelmed|lonely|grief|grieving|loss|lost someone|bereaved|mourning|heartbroken|burned out|burnt out|exhausted|scared|afraid|hopeless)\b/i.test(message) ||
    /(?:тревог|паник|перегруж|одинок|утрат|умер|сконч|похорон|гор(?:е|ю)|разбит|выгор|истощ|страшно|боюсь|безнад)/i.test(message);
}

function isExplicitPremiumRequest(message: string) {
  return /\b(?:premium|paid|subscription|пре?миум|платн|подписк)\b/i.test(message);
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

const intentKeywords: Record<string, RegExp> = {
  stress_reset: /(soft reset|stress reset|gentle reset|reset|restart|перезагруз|сброс|мягк.*перезагруз)/i,
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

type RecommendationMetadataField = 'title' | 'category' | 'mood' | 'summary' | 'tags';

const recommendationMetadataWeights: Record<RecommendationMetadataField, number> = {
  category: 12,
  mood: 10,
  title: 8,
  summary: 6,
  tags: 6
};

const recommendationMetadataTerms: Record<string, Partial<Record<RecommendationMetadataField, string[]>>> = {
  anxiety: {
    category: ['anxiety', 'stress'], mood: ['calm', 'relief', 'settle'], title: ['anxiety', 'relief'],
    summary: ['anxiety', 'worry', 'stress', 'settle'], tags: ['anxiety', 'stress', 'calm']
  },
  stress_reset: {
    category: ['breath', 'reset', 'quick'], mood: ['calm', 'relief', 'reset'], title: ['reset', 'breath'],
    summary: ['reset', 'breath', 'calm', 'stress', 'release'], tags: ['reset', 'breath', 'calm']
  },
  sleep: {
    category: ['sleep', 'rest'], mood: ['sleep', 'rest', 'night'], title: ['sleep', 'night'],
    summary: ['sleep', 'rest', 'night', 'release'], tags: ['sleep', 'rest', 'night']
  },
  self_kindness: {
    category: ['self', 'compassion', 'kindness'], mood: ['kindness', 'compassion', 'soft'], title: ['self', 'love'],
    summary: ['self', 'kindness', 'compassion', 'criticism', 'shame'], tags: ['self', 'compassion']
  },
  focus: {
    category: ['focus', 'clarity'], mood: ['focus', 'clarity', 'attention'], title: ['focus', 'clarity'],
    summary: ['focus', 'clarity', 'attention', 'mental noise'], tags: ['focus', 'clarity']
  },
  grounding: {
    category: ['grounding', 'balance'], mood: ['grounded', 'balance', 'center'], title: ['ground', 'balance', 'center'],
    summary: ['ground', 'balance', 'center', 'scattered'], tags: ['grounding', 'balance']
  },
  morning: {
    category: ['morning', 'focus'], mood: ['morning', 'focus', 'energy'], title: ['morning', 'clarity'],
    summary: ['morning', 'start', 'clarity', 'energy'], tags: ['morning', 'focus']
  }
};

function recommendationScoreDetails(item: RecommendationCatalogItem, intent: string) {
  const profile = recommendationMetadataTerms[intent];
  if (!profile) return { score: 0, matchedFields: [] as RecommendationMetadataField[] };
  const fields: Record<RecommendationMetadataField, string> = {
    title: item.title ?? '',
    category: item.category ?? '',
    mood: item.mood ?? '',
    summary: item.summary ?? '',
    tags: item.tags?.join(' ') ?? ''
  };

  return (Object.entries(profile) as Array<[RecommendationMetadataField, string[]]>).reduce((result, [field, terms]) => {
    const haystack = normalize(fields[field]);
    const matched = terms.some((term) => haystack.includes(normalize(term)));
    if (matched) {
      result.score += recommendationMetadataWeights[field];
      result.matchedFields.push(field);
    }
    return result;
  }, { score: 0, matchedFields: [] as RecommendationMetadataField[] });
}

export type MeditationRecommendationDecision = {
  meditationId: string | null;
  intent: string | null;
  score: number;
  runnerUpScore: number;
  ambiguous: boolean;
  reason: string;
};

export function rankMeditationRecommendation(input: {
  message: string;
  catalog: RecommendationCatalogItem[];
  language?: LunaLanguage;
  modelRecommendationId?: string | null;
  modelRecommendationGoal?: string | null;
  intentOverride?: string | null;
  emotionalState?: string | null;
  contextSignals?: string[];
  forceRecommendation?: boolean;
  recentAssistantRecommendations?: Array<string | null | undefined>;
  recentMessages?: Array<{ role?: string | null; content?: string | null }>;
  vulnerable?: boolean;
}): MeditationRecommendationDecision {
  const recentRecommendations = input.recentAssistantRecommendations ?? [];
  const explicitlyRequested = isReadyMeditationRequest(input.message) || Boolean(input.forceRecommendation);
  const noMatch = (reason: string, intent: string | null = null): MeditationRecommendationDecision => ({
    meditationId: null, intent, score: 0, runnerUpScore: 0, ambiguous: false, reason
  });
  if (isInChatGuidanceRequest(input.message) && !explicitlyRequested) return noMatch('in_chat_guidance_requested');
  if (isAmbiguousSleepyTiredContext(input.message) && !explicitlyRequested) return noMatch('sleep_or_focus_context_is_ambiguous');
  if (!explicitlyRequested && recentRecommendations.slice(-3).some(Boolean)) return noMatch('recommendation_cooldown');

  if (/^(?:thanks?|thank you|okay|ok|got it|спасибо|понятно|хорошо|ок)[.! ]*$/i.test(input.message.trim())) return noMatch('conversation_closure');

  const recentContext = (input.recentMessages ?? [])
    .filter((message) => message.role !== 'assistant')
    .slice(-4)
    .map((message) => message.content ?? '')
    .join('\n');
  const goalIntent: Record<string, string> = {
    sleep: 'sleep', anxiety: 'anxiety', focus: 'focus', grounding: 'grounding', self_compassion: 'self_kindness',
    morning_clarity: 'morning', stress_reset: 'stress_reset'
  };
  const normalizedOverride = input.intentOverride === 'reset' || input.intentOverride === 'breathing'
    ? 'stress_reset'
    : input.intentOverride;
  const intent = detectIntent(input.message)
    ?? (normalizedOverride && recommendationMetadataTerms[normalizedOverride] ? normalizedOverride : null)
    ?? (explicitlyRequested ? detectIntent(`${recentContext}\n${input.message}`) : null)
    ?? (input.emotionalState ? detectIntent(input.emotionalState) : null)
    ?? (input.contextSignals?.length ? detectIntent(input.contextSignals.join('\n')) : null)
    ?? (input.modelRecommendationGoal ? goalIntent[input.modelRecommendationGoal] ?? null : null);

  const avoidPremium = Boolean(input.vulnerable ?? isVulnerableMessage(input.message)) && !isExplicitPremiumRequest(input.message);
  const available = input.catalog.filter((item) => (
    item.id && item.title && item.published !== false &&
    (!input.language || !item.language || item.language === input.language) &&
    !(avoidPremium && item.premium)
  ));
  if (explicitlyRequested && !intent) {
    if (input.modelRecommendationId && available.some((item) => item.id === input.modelRecommendationId)) {
      return { meditationId: input.modelRecommendationId, intent: null, score: 100, runnerUpScore: 0, ambiguous: false, reason: 'validated_explicit_catalog_selection' };
    }
    const latestRecent = [...recentRecommendations].reverse().find(Boolean);
    if (latestRecent && available.some((item) => item.id === latestRecent)) {
      return { meditationId: latestRecent, intent: null, score: 80, runnerUpScore: 0, ambiguous: false, reason: 'continued_recent_recommendation' };
    }
  }
  if (!intent) return noMatch('no_resolved_recommendation_intent');

  const ranked = available
    .map((item) => ({ item, ...recommendationScoreDetails(item, intent) }))
    .filter((entry) => entry.score >= 16 && (explicitlyRequested || !recentRecommendations.includes(entry.item.id)))
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));

  const best = ranked[0];
  const runnerUp = ranked[1];
  if (!best) return noMatch('no_catalog_item_reached_semantic_threshold', intent);
  if (runnerUp && runnerUp.score === best.score) {
    const normalizedMessage = normalize(input.message);
    const modelItemWasNamed = input.modelRecommendationId
      ? available.some((item) => item.id === input.modelRecommendationId && (
        normalizedMessage.includes(normalize(item.title)) ||
        Boolean(item.catalogKey && normalizedMessage.includes(normalize(item.catalogKey)))
      ))
      : false;
    if (modelItemWasNamed && input.modelRecommendationId) {
      return {
        meditationId: input.modelRecommendationId,
        intent,
        score: best.score,
        runnerUpScore: runnerUp.score,
        ambiguous: false,
        reason: 'explicit_catalog_title_resolved_tie'
      };
    }
    return {
      meditationId: null,
      intent,
      score: best.score,
      runnerUpScore: runnerUp.score,
      ambiguous: true,
      reason: 'equally_ranked_catalog_matches'
    };
  }

  const modelItem = input.modelRecommendationId ? available.find((item) => item.id === input.modelRecommendationId) : null;
  const modelScore = modelItem ? recommendationScoreDetails(modelItem, intent).score : 0;
  if (modelItem && modelScore >= 16 && modelScore >= best.score && (explicitlyRequested || !recentRecommendations.includes(modelItem.id))) {
    return {
      meditationId: modelItem.id,
      intent,
      score: modelScore,
      runnerUpScore: best.item.id === modelItem.id ? runnerUp?.score ?? 0 : best.score,
      ambiguous: false,
      reason: `model_selection_validated_by_${intent}_metadata`
    };
  }

  return {
    meditationId: best.item.id,
    intent,
    score: best.score,
    runnerUpScore: runnerUp?.score ?? 0,
    ambiguous: false,
    reason: `${intent}_matched_${best.matchedFields.join('_')}`
  };
}

export function semanticMeditationRecommendation(input: Parameters<typeof rankMeditationRecommendation>[0]) {
  return rankMeditationRecommendation(input).meditationId;
}

export function meditationIdMentionedInText(message: string, catalog: RecommendationCatalogItem[]) {
  const normalizedMessage = normalize(message);
  if (!normalizedMessage) return null;
  const matches = catalog.filter((item) => item.id && item.title && normalizedMessage.includes(normalize(item.title)));
  return matches.length === 1 ? matches[0]?.id ?? null : null;
}

export function meditationCardInstruction(language: LunaLanguage) {
  return language === 'ru'
    ? 'Карточка практики уже здесь — начни, когда захочешь.'
    : 'The practice is ready here whenever you want to begin.';
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

export function sanitizeMeditationFacts(message: string, catalog: RecommendationCatalogItem[], language: LunaLanguage = 'en') {
  let next = message;
  for (const item of catalog) {
    if (!item.title || !item.duration) continue;
    const duration = formatMeditationDuration(item.duration, language);
    const title = escapeRegExp(item.title);
    const durationPattern = '(\\d+\\s*(?:minute|minutes|min|минут|мин))(?![A-Za-zА-Яа-я])';
    const titleThenDuration = new RegExp(`(${title}[^.!?\\n]{0,80}?)${durationPattern}`, 'giu');
    const durationThenTitle = new RegExp(`${durationPattern}([^.!?\\n]{0,80}?${title})`, 'giu');
    next = next
      .replace(titleThenDuration, (_match, before: string) => `${before}${duration}`)
      .replace(durationThenTitle, (_match, _duration: string, after: string) => `${duration}${after}`);
  }
  return next;
}

export function sanitizeMeditationCatalogKeys(message: string, catalog: RecommendationCatalogItem[]) {
  let next = message;
  for (const item of catalog) {
    const key = item.catalogKey?.trim();
    if (!key || !item.title || !key.includes('-')) continue;
    next = next.replace(new RegExp(`\\b${escapeRegExp(key)}\\b`, 'gi'), item.title);
  }
  return next;
}
