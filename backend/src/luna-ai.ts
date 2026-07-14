import crypto from 'node:crypto';
import { z } from 'zod';
import { env } from './config.js';
import { getUserAccess, supabase, upsertUser, type TelegramUserInput } from './db.js';
import { logBackendError } from './error-logging.js';
import { buildLunaSystemPrompt, detectedIntents, recommendationGoals } from './luna/prompts/index.js';
import {
  memoryCandidateSchema,
  memoryCategories,
  avoidLibraryInstructionWhenCardExists,
  containsMasculineLunaSelfReference,
  detectConversationLanguage,
  enforceLunaFeminineIdentity,
  formatMeditationDuration,
  hasInternalDataLeak,
  enforceCardClaimConsistency,
  isReadyMeditationRequest,
  isVulnerableMessage,
  safetyCategory,
  sanitizeMeditationFacts,
  sanitizeMeditationCatalogKeys,
  sanitizeVisibleAssistantMessage,
  semanticMeditationRecommendation,
  meditationCardInstruction,
  meditationIdMentionedInText,
  validMemoryCandidates,
  type RecommendationCatalogItem
} from './luna-ai-policy.js';
import {
  clarificationHash,
  createPendingClarification,
  inferPendingStateFromRecent,
  resolvePendingReply,
  type PendingLunaState
} from './luna-ai-pending.js';

const languageSchema = z.enum(['en', 'ru']);
const meditationActionSchema = z.object({
  type: z.literal('meditation_card'),
  meditationId: z.string().trim().min(1).max(100)
});
const modelResultSchema = z.object({
  message: z.string().min(1).max(5000),
  detectedIntent: z.enum(detectedIntents),
  recommendationIntent: z.object({
    needed: z.boolean(),
    goal: z.enum(recommendationGoals).nullable(),
    preferredCatalogKey: z.string().min(1).max(100).nullable()
  }),
  meditationAction: meditationActionSchema.nullable(),
  conversationTitle: z.string().min(1).max(60).nullable(),
  memoryCandidates: z.array(memoryCandidateSchema).max(3)
});
const tolerantModelResultSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  detectedIntent: z.enum(detectedIntents).optional(),
  recommendationIntent: z.object({
    needed: z.boolean().optional(),
    goal: z.enum(recommendationGoals).nullable().optional(),
    preferredCatalogKey: z.string().trim().min(1).max(100).nullable().optional()
  }).optional(),
  conversationTitle: z.string().trim().min(1).max(60).nullable().optional(),
  meditationAction: z.unknown().optional(),
  action: z.unknown().optional(),
  recommendedMeditationId: z.string().trim().min(1).nullable().optional(),
  memoryCandidates: z.array(memoryCandidateSchema).max(3).optional()
}).passthrough().transform((value) => {
  const actionCandidate = value.meditationAction ?? value.action ?? null;
  const action = meditationActionSchema.safeParse(actionCandidate);
  return {
    message: value.message,
    detectedIntent: value.detectedIntent ?? 'chat',
    recommendationIntent: {
      needed: value.recommendationIntent?.needed ?? Boolean(value.recommendedMeditationId || action.success),
      goal: value.recommendationIntent?.goal ?? null,
      preferredCatalogKey: value.recommendationIntent?.preferredCatalogKey ?? value.recommendedMeditationId ?? (action.success ? action.data.meditationId : null)
    },
    meditationAction: action.success ? action.data : null,
    conversationTitle: value.conversationTitle ?? null,
    memoryCandidates: value.memoryCandidates ?? []
  };
});

export const lunaChatInputSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(env.AI_MAX_MESSAGE_LENGTH),
  language: languageSchema,
  requestId: z.string().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/)
});

export type LunaRequestState = 'pending' | 'processing' | 'completed' | 'failed_retryable' | 'failed_non_retryable' | 'quota_exhausted';

export class LunaAiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 500,
    public retryable = false,
    public requestState: LunaRequestState = retryable ? 'failed_retryable' : 'failed_non_retryable',
    public resetAt: string | null = null
  ) {
    super(message);
    this.name = 'LunaAiError';
  }
}

type OpenAiContentItem = {
  type?: string;
  text?: string;
  refusal?: string;
  parsed?: unknown;
  content?: unknown;
};

type OpenAiOutputItem = {
  type?: string;
  role?: string;
  status?: string;
  finish_reason?: string;
  content?: OpenAiContentItem[] | string;
};

type OpenAiResponse = {
  id?: string;
  model?: string;
  status?: string;
  output_text?: string;
  output?: OpenAiOutputItem[];
  message?: { content?: OpenAiContentItem[] | string };
  choices?: Array<{ finish_reason?: string; message?: { content?: OpenAiContentItem[] | string } }>;
  incomplete_details?: { reason?: string };
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  _requestId?: string | null;
};

type ExtractedOpenAiText = { text: string; refusal: string | null; path: string };

function userHash(telegramId: number) {
  return crypto.createHash('sha256').update(String(telegramId)).digest('hex').slice(0, 12);
}

function safeReference(value?: string | null) {
  return value ? crypto.createHash('sha256').update(value).digest('hex').slice(0, 12) : null;
}

function safetyResponse(language: 'en' | 'ru', category: 'self_harm' | 'medical_emergency' | 'violence') {
  if (category === 'medical_emergency') return language === 'ru'
    ? 'Это может требовать срочной медицинской помощи. Пожалуйста, прямо сейчас свяжись с местной экстренной службой или попроси человека рядом сделать это. Не оставайся один или одна и не полагайся на Luna в экстренной ситуации.'
    : 'This may need urgent medical care. Please contact your local emergency service now, or ask someone nearby to do it for you. Do not stay alone or rely on Luna during an emergency.';
  if (category === 'violence') return language === 'ru'
    ? 'Твоя безопасность сейчас важнее всего. Если можешь, перейди в безопасное место, свяжись с местной экстренной службой и позови человека, которому доверяешь. Luna не может вмешаться в экстренную ситуацию.'
    : 'Your immediate safety matters most. If you can, move to a safer place, contact your local emergency service, and reach someone you trust. Luna cannot intervene in an emergency.';
  return language === 'ru'
    ? 'Мне очень жаль, что тебе сейчас так тяжело. Я не могу обеспечить экстренную помощь, поэтому, пожалуйста, прямо сейчас свяжись с местной экстренной службой или кризисной линией и позови человека, которому доверяешь, чтобы он побыл рядом. Если есть непосредственная опасность, отойди от всего, чем можно навредить себе, и не оставайся один или одна.'
    : "I'm really sorry you're carrying this right now. I can't provide emergency help, so please contact your local emergency service or crisis line now, and ask someone you trust to stay with you. If there is immediate danger, move away from anything you could use to hurt yourself and do not stay alone.";
}

export function systemPrompt(language: 'en' | 'ru', catalogJson: string, contextJson: string) {
  return buildLunaSystemPrompt({
    language,
    catalog: JSON.parse(catalogJson) as unknown,
    context: JSON.parse(contextJson) as unknown
  });
}

function valueToText(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? '' : serialized.trim();
  }
  return '';
}

function pathJoin(base: string, key: string | number) {
  return typeof key === 'number' ? `${base}[${key}]` : base ? `${base}.${key}` : key;
}

function firstKnownAssistantText(value: unknown, path: string, seen = new WeakSet<object>()): { text: string; path: string } | null {
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? { text, path } : null;
  }

  if (!value || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const match = firstKnownAssistantText(value[index], pathJoin(path, index), seen);
      if (match) return match;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  const priorityKeys = ['text', 'value', 'output_text', 'input_text', 'content', 'message', 'parsed', 'refusal'];

  for (const key of priorityKeys) {
    if (!(key in record)) continue;
    if (key === 'parsed') {
      const text = valueToText(record[key]);
      if (text) return { text, path: pathJoin(path, key) };
    }
    const match = firstKnownAssistantText(record[key], pathJoin(path, key), seen);
    if (match) return match;
  }

  return null;
}

function fallbackOutputText(value: unknown, path: string, seen = new WeakSet<object>()): { text: string; path: string } | null {
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? { text, path } : null;
  }

  if (!value || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const match = fallbackOutputText(value[index], pathJoin(path, index), seen);
      if (match) return match;
    }
    return null;
  }

  const skippedKeys = new Set([
    'id', 'object', 'type', 'role', 'status', 'model', 'finish_reason', 'reason',
    'name', 'metadata', 'schema', 'instructions', 'catalog', 'usage'
  ]);

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (skippedKeys.has(key)) continue;
    const match = fallbackOutputText(child, pathJoin(path, key), seen);
    if (match) return match;
  }

  return null;
}

function recursiveOutputText(response: OpenAiResponse) {
  const output = response.output as unknown;
  if (!output) return null;
  return firstKnownAssistantText(output, 'output') ?? fallbackOutputText(output, 'output');
}

export function extractOpenAiText(response: OpenAiResponse): ExtractedOpenAiText {
  const topLevelText = typeof response.output_text === 'string' ? response.output_text.trim() : '';
  if (topLevelText) return { text: topLevelText, refusal: null, path: 'output_text' };

  const directCandidates: Array<{ value: unknown; path: string }> = [
    { value: response.message?.content, path: 'message.content' },
    ...((response.choices ?? []).map((choice, index) => ({ value: choice.message?.content, path: `choices[${index}].message.content` })))
  ];

  for (const candidate of directCandidates) {
    const text = firstKnownAssistantText(candidate.value, candidate.path);
    if (text) return { text: text.text, refusal: null, path: text.path };
  }

  for (const item of response.output ?? []) {
    if (item.content) {
      const refusal = firstKnownAssistantText(item.content, 'output.content.refusal');
      if (item.type === 'refusal' && refusal) return { text: '', refusal: refusal.text, path: refusal.path };
    }
  }

  const outputText = recursiveOutputText(response);
  if (outputText) {
    if (outputText.path.endsWith('.refusal')) return { text: '', refusal: outputText.text, path: outputText.path };
    return { text: outputText.text, refusal: null, path: outputText.path };
  }

  const refusal = firstKnownAssistantText(response, 'response');
  if (refusal && refusal.path.endsWith('.refusal')) return { text: '', refusal: refusal.text, path: refusal.path };

  console.error('[Luna AI OpenAI extraction failed]', {
    model: response.model ?? env.AI_CHAT_MODEL,
    status: response.status ?? 'unknown',
    outputItems: response.output?.length ?? 0,
    incompleteReason: response.incomplete_details?.reason ?? null
  });
  throw new LunaAiError('malformed_response', 'OpenAI returned no assistant text anywhere in the response.', 502);
}

function stripJsonFence(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function tryParseJson(text: string, context?: { telegramId?: number; requestId?: string }) {
  try {
    return JSON.parse(stripJsonFence(text)) as unknown;
  } catch (error) {
    logBackendError(error, {
      endpoint: 'Luna OpenAI response JSON parse',
      telegramId: context?.telegramId,
      requestId: context?.requestId,
      level: 'info',
      expected: true
    });
    return null;
  }
}

export function normalizeOpenAiModelResult(
  extracted: { text: string; refusal: string | null },
  language: 'en' | 'ru',
  context?: { telegramId?: number; requestId?: string }
) {
  if (extracted.refusal) {
    return modelResultSchema.parse({
      message: extracted.refusal,
      detectedIntent: 'other',
      recommendationIntent: { needed: false, goal: null, preferredCatalogKey: null },
      meditationAction: null,
      conversationTitle: language === 'ru' ? 'Нужна поддержка' : 'Need Support',
      memoryCandidates: []
    });
  }

  const text = extracted.text.trim();
  const parsedJson = text ? tryParseJson(text, context) : null;

  if (parsedJson && typeof parsedJson === 'object') {
    const parsed = tolerantModelResultSchema.parse(parsedJson);
    return modelResultSchema.parse(parsed);
  }

  if (text) {
    return modelResultSchema.parse({
      message: text,
      detectedIntent: 'chat',
      recommendationIntent: { needed: false, goal: null, preferredCatalogKey: null },
      meditationAction: null,
      conversationTitle: null,
      memoryCandidates: []
    });
  }

  throw new LunaAiError('malformed_response', 'OpenAI returned no usable assistant message.', 502);
}

function extractFinishReason(response: OpenAiResponse) {
  const outputReason = response.output?.find((item) => item.finish_reason)?.finish_reason;
  return outputReason ?? response.choices?.find((choice) => choice.finish_reason)?.finish_reason ?? response.incomplete_details?.reason ?? response.status ?? 'unknown';
}

function openAiOutputTypes(response: OpenAiResponse) {
  return (response.output ?? []).map((item) => ({
    type: item.type ?? 'unknown',
    status: item.status ?? null,
    contentTypes: Array.isArray(item.content)
      ? item.content.map((content) => content.type ?? 'unknown')
      : typeof item.content
  }));
}

function classifyOpenAiHttpError(status: number, body: string, context?: { telegramId?: number; requestId?: string }) {
  let apiCode = '';
  let apiType = '';
  try {
    const parsed = JSON.parse(body) as { error?: { code?: unknown; type?: unknown } };
    apiCode = typeof parsed.error?.code === 'string' ? parsed.error.code : '';
    apiType = typeof parsed.error?.type === 'string' ? parsed.error.type : '';
  } catch (error) {
    logBackendError(error, { endpoint: 'Luna OpenAI error response JSON parse', telegramId: context?.telegramId, requestId: context?.requestId });
    // The status remains enough to classify a non-JSON upstream failure.
  }
  if (status === 401 || status === 403) return { code: 'openai_auth', retryable: false, apiCode, apiType };
  if (status === 429 && (apiCode === 'insufficient_quota' || apiType === 'insufficient_quota')) return { code: 'openai_quota', retryable: false, apiCode, apiType };
  if (status === 429) return { code: 'openai_rate_limit', retryable: true, apiCode, apiType };
  if (status === 404 || apiCode === 'model_not_found') return { code: 'openai_model', retryable: false, apiCode, apiType };
  if (status === 400 || status === 422) return { code: 'openai_validation', retryable: false, apiCode, apiType };
  if (status === 408) return { code: 'timeout', retryable: true, apiCode, apiType };
  if (status >= 500) return { code: 'temporary_upstream', retryable: true, apiCode, apiType };
  return { code: 'openai_error', retryable: false, apiCode, apiType };
}

let providerHealthCache: { expiresAt: number; value: { available: boolean; enabled: boolean; model: string; errorClass: string | null } } | null = null;

export async function getLunaProviderHealth(context: { requestId?: string; telegramId?: number } = {}) {
  const base = { enabled: env.AI_CHAT_ENABLED, model: env.AI_CHAT_MODEL };
  if (!env.AI_CHAT_ENABLED) return { ...base, available: false, errorClass: 'disabled' };
  if (!env.OPENAI_API_KEY) return { ...base, available: false, errorClass: 'missing_api_key' };
  if (providerHealthCache && providerHealthCache.expiresAt > Date.now()) return providerHealthCache.value;

  try {
    const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(env.AI_CHAT_MODEL)}`, {
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(5000)
    });
    const requestId = response.headers.get('x-request-id');
    const value = response.ok
      ? { ...base, available: true, errorClass: null }
      : { ...base, available: false, errorClass: classifyOpenAiHttpError(response.status, '').code };
    console.info('[Luna AI health]', {
      requestId,
      status: response.status,
      model: env.AI_CHAT_MODEL,
      available: value.available,
      errorClass: value.errorClass
    });
    providerHealthCache = { expiresAt: Date.now() + 60_000, value };
    return value;
  } catch (error) {
    const errorClass = error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'temporary_upstream';
    const value = { ...base, available: false, errorClass };
    logBackendError(error, { endpoint: 'GET OpenAI provider health', requestId: context.requestId, telegramId: context.telegramId });
    providerHealthCache = { expiresAt: Date.now() + 15_000, value };
    return value;
  }
}

export function shouldRetryOpenAiResponse(response: OpenAiResponse, extracted: ExtractedOpenAiText | null) {
  return !extracted && response.incomplete_details?.reason === 'max_output_tokens';
}

export function retryMaxOutputTokens(baseTokens = env.AI_MAX_OUTPUT_TOKENS) {
  return Math.min(Math.max(baseTokens * 2, 4000), 8192);
}

function compactText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}

function catalogKey(title: string) {
  return title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function explicitRecommendationMessage(input: {
  language: 'en' | 'ru';
  item: RecommendationCatalogItem;
}) {
  const title = input.item.title;
  if (input.language === 'ru') {
    return `Для этого лучше всего подойдёт ${title}. ${meditationCardInstruction('ru')}`;
  }
  return `For this, I'd recommend ${title}. ${meditationCardInstruction('en')}`;
}

function meditationCardFallback(language: 'en' | 'ru') {
  return language === 'ru'
    ? 'Я нашла эту практику, но сейчас не смогла открыть карточку. Попробуй ещё раз.'
    : 'I found this practice, but I could not open its card right now. Please try again.';
}

function meditationClarificationFallback(language: 'en' | 'ru') {
  return language === 'ru'
    ? 'Я хочу выбрать практику точно, а не угадывать. Тебе сейчас больше нужны сон, фокус или мягкая перезагрузка?'
    : 'I want to choose thoughtfully rather than guess. Are you looking for sleep, focus, or a gentler reset?';
}

function asksToShowMeditationCard(message: string) {
  return /(?:show|open|send|display|card|показать|открыть|пришл|карточк)/i.test(message) && /\?/u.test(message);
}

export type MeditationAction = z.infer<typeof meditationActionSchema>;

export function resolveMeditationAction(action: MeditationAction | null, catalog: RecommendationCatalogItem[]) {
  if (!action) return null;
  const item = catalog.find((candidate) => (
    candidate.published !== false &&
    (candidate.id === action.meditationId || candidate.catalogKey === action.meditationId)
  ));
  return item ? { type: 'meditation_card' as const, meditationId: item.id } : null;
}

function finalizeAssistantContent(input: {
  parsedMessage: string;
  language: 'en' | 'ru';
  catalog: RecommendationCatalogItem[];
  recommendedMeditationId: string | null;
  explicitRequest: boolean;
}) {
  const selected = input.recommendedMeditationId
    ? input.catalog.find((item) => item.id === input.recommendedMeditationId) ?? null
    : null;
  const baseMessage = input.explicitRequest && selected
    ? explicitRecommendationMessage({ language: input.language, item: selected })
    : input.parsedMessage;
  const factChecked = sanitizeMeditationCatalogKeys(sanitizeMeditationFacts(baseMessage, input.catalog, input.language), input.catalog);
  const noLibraryInstruction = avoidLibraryInstructionWhenCardExists(factChecked, input.language, Boolean(input.recommendedMeditationId));
  const safeVisible = sanitizeVisibleAssistantMessage(noLibraryInstruction, input.language);
  return enforceLunaFeminineIdentity(safeVisible, input.language);
}

function lunaStructuredTextFormat() {
  return {
    format: {
      type: 'json_schema',
      name: 'luna_companion_response',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          message: { type: 'string' },
          detectedIntent: { type: 'string', enum: detectedIntents },
          recommendationIntent: {
            type: 'object',
            additionalProperties: false,
            properties: {
              needed: { type: 'boolean' },
              goal: { type: ['string', 'null'], enum: [...recommendationGoals, null] },
              preferredCatalogKey: { type: ['string', 'null'] }
            },
            required: ['needed', 'goal', 'preferredCatalogKey']
          },
          meditationAction: {
            type: ['object', 'null'],
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['meditation_card'] },
              meditationId: { type: 'string' }
            },
            required: ['type', 'meditationId']
          },
          conversationTitle: { type: ['string', 'null'] },
          memoryCandidates: {
            type: 'array',
            maxItems: 3,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                category: { type: 'string', enum: memoryCategories },
                key: { type: 'string' },
                value: { type: 'string' },
                confidence: { type: 'number' }
              },
              required: ['category', 'key', 'value', 'confidence']
            }
          }
        },
        required: ['message', 'detectedIntent', 'recommendationIntent', 'meditationAction', 'conversationTitle', 'memoryCandidates']
      }
    }
  };
}

export function buildLunaOpenAiRequest(input: {
  language: 'en' | 'ru';
  catalog: Array<Record<string, unknown>>;
  context: unknown;
  recent: Array<{ role: string; content: string }>;
  maxOutputTokens?: number;
}) {
  return {
    model: env.AI_CHAT_MODEL,
    store: false,
    reasoning: { effort: env.AI_REASONING_EFFORT },
    instructions: systemPrompt(input.language, JSON.stringify(input.catalog), JSON.stringify(input.context)),
    input: input.recent.map((message) => ({ role: message.role, content: message.content })),
    max_output_tokens: input.maxOutputTokens ?? env.AI_MAX_OUTPUT_TOKENS,
    text: lunaStructuredTextFormat()
  };
}

async function callOpenAiResponses(input: {
  requestBody: ReturnType<typeof buildLunaOpenAiRequest>;
  signal: AbortSignal;
  telegramId: number;
  requestId?: string;
  conversationId: string;
  attempt: number;
}) {
  console.info('[Luna AI OpenAI request]', {
    user: userHash(input.telegramId),
    conversationId: input.conversationId,
    attempt: input.attempt,
    model: input.requestBody.model,
    messageCount: input.requestBody.input.length,
    maxOutputTokens: input.requestBody.max_output_tokens
  });

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: input.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify(input.requestBody)
    });
  } catch (error) {
    logBackendError(error, { endpoint: 'POST https://api.openai.com/v1/responses', telegramId: input.telegramId, requestId: input.requestId });
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new LunaAiError('temporary_upstream', 'OpenAI could not be reached.', 502, true);
  }
  const body = await response.text();
  const openAiRequestId = response.headers.get('x-request-id');
  console.info('[Luna AI OpenAI response]', {
    user: userHash(input.telegramId),
    conversationId: input.conversationId,
    attempt: input.attempt,
    status: response.status,
    openAiRequestId,
    model: env.AI_CHAT_MODEL,
    responseBytes: body.length
  });

  if (!response.ok) {
    const failure = classifyOpenAiHttpError(response.status, body, { telegramId: input.telegramId, requestId: input.requestId });
    console.error('[Luna AI OpenAI API error]', {
      user: userHash(input.telegramId),
      conversationId: input.conversationId,
      openAiRequestId,
      httpStatus: response.status,
      model: input.requestBody.model,
      apiCode: failure.apiCode || null,
      apiType: failure.apiType || null,
      internalErrorClass: failure.code
    });
    throw new LunaAiError(failure.code, `OpenAI request failed with status ${response.status}.`, response.status === 429 ? 429 : 502, failure.retryable);
  }

  try {
    const parsed = JSON.parse(body) as OpenAiResponse;
    parsed._requestId = openAiRequestId;
    console.info('[Luna AI OpenAI response shape]', {
      user: userHash(input.telegramId),
      conversationId: input.conversationId,
      openAiRequestId,
      httpStatus: response.status,
      model: parsed.model ?? input.requestBody.model,
      responseStatus: parsed.status ?? 'unknown',
      outputItemTypes: openAiOutputTypes(parsed),
      finishReason: extractFinishReason(parsed)
    });
    return parsed;
  } catch (error) {
    logBackendError(error, { endpoint: 'POST https://api.openai.com/v1/responses JSON parse', telegramId: input.telegramId, requestId: input.requestId });
    throw new LunaAiError('malformed_response', 'OpenAI returned invalid JSON.', 502);
  }
}

async function ownedConversation(telegramId: number, conversationId: string) {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new LunaAiError('conversation_not_found', 'Conversation not found.', 404);
  return data;
}

type RequestReservation = {
  status: LunaRequestState;
  quota_charged: boolean;
  remaining: number;
  attempt_count: number;
  acquired: boolean;
};

function nextUtcReset() {
  const reset = new Date();
  reset.setUTCDate(reset.getUTCDate() + 1);
  reset.setUTCHours(0, 0, 0, 0);
  return reset.toISOString();
}

async function reserveChatRequest(telegramId: number, requestId: string, limit: number, conversationId?: string) {
  const { data, error } = await supabase.rpc('reserve_luna_chat_request', {
    p_telegram_id: telegramId,
    p_client_request_id: requestId,
    p_daily_limit: limit,
    p_conversation_id: conversationId ?? null
  });
  if (error) {
    logBackendError(error, {
      endpoint: 'Supabase RPC reserve_luna_chat_request',
      requestId,
      telegramId,
      rpcName: 'reserve_luna_chat_request',
      expectedParameterContract: 'p_telegram_id bigint, p_client_request_id text, p_daily_limit integer, p_conversation_id uuid'
    });
    throw error;
  }
  const reservation = (data?.[0] ?? null) as RequestReservation | null;
  if (!reservation) throw new LunaAiError('internal_error', 'Could not reserve Luna request.', 500);
  return reservation;
}

async function chatRequest(telegramId: number, requestId: string) {
  const { data, error } = await supabase.from('ai_chat_requests').select('*')
    .eq('telegram_id', telegramId).eq('client_request_id', requestId).maybeSingle();
  if (error) throw error;
  return data;
}

async function updateChatRequest(telegramId: number, requestId: string, values: Record<string, unknown>) {
  const { error } = await supabase.from('ai_chat_requests').update({ ...values, updated_at: new Date().toISOString() })
    .eq('telegram_id', telegramId).eq('client_request_id', requestId);
  if (error) throw error;
}

async function existingCompletedResponse(telegramId: number, requestId: string, remaining: number) {
  const request = await chatRequest(telegramId, requestId);
  if (!request?.assistant_message_id || !request.conversation_id) return null;
  const { data: message, error } = await supabase.from('ai_messages')
    .select('id, role, content, metadata, request_id, created_at')
    .eq('id', request.assistant_message_id).eq('telegram_id', telegramId).maybeSingle();
  if (error) throw error;
  return message ? { conversationId: request.conversation_id, message, duplicate: true, remaining, requestState: 'completed' as const } : null;
}

export function classifyLunaFailure(error: unknown) {
  if (error instanceof LunaAiError) {
    const retryableCodes = new Set(['timeout', 'rate_limit', 'openai_rate_limit', 'malformed_response', 'max_output_tokens', 'temporary_upstream', 'request_in_progress']);
    return { code: error.code, retryable: error.retryable || retryableCodes.has(error.code) };
  }
  if (error instanceof z.ZodError) return { code: 'permanent_validation', retryable: false };
  if (error instanceof Error && error.name === 'AbortError') return { code: 'timeout', retryable: true };
  return { code: 'unknown', retryable: true };
}

function relevantMemories(message: string, memories: Array<{ category: string; memory_key: string; memory_value: string }>) {
  const lower = message.toLowerCase();
  const categoryHints: Record<string, string[]> = {
    sleep: ['sleep', 'bed', 'night', 'сон', 'спать', 'ноч'],
    stress: ['stress', 'work', 'overwhelm', 'стресс', 'работ', 'перегруж'],
    routine: ['routine', 'morning', 'evening', 'habit', 'утр', 'вечер', 'привыч'],
    meditation_preference: ['meditation', 'practice', 'recommend', 'медитац', 'практик', 'подбери'],
    mindfulness_goal: ['goal', 'change', 'improve', 'цель', 'измен', 'улучш']
  };
  const alwaysRelevant = new Set(['identity_preference', 'communication_preference', 'avoidance_preference']);
  return memories.filter((memory) => {
    if (alwaysRelevant.has(memory.category)) return true;
    if ((categoryHints[memory.category] ?? []).some((hint) => lower.includes(hint))) return true;
    return memory.memory_key.split('_').some((token) => token.length > 4 && lower.includes(token));
  }).slice(0, 12);
}

async function loadContext(telegramId: number, conversationId: string, currentMessage: string) {
  const [{ data: recent }, { data: memories }, { data: user }, { data: checkin }, { data: catalog }, { data: conversation }] = await Promise.all([
    supabase.from('ai_messages').select('role, content, metadata, created_at').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(env.AI_RECENT_MESSAGE_LIMIT),
    supabase.from('user_memories').select('category, memory_key, memory_value').eq('telegram_id', telegramId).eq('is_active', true).order('updated_at', { ascending: false }).limit(30),
    supabase.from('users').select('first_name, language_code, profile_goals, ai_memory_enabled').eq('telegram_id', telegramId).maybeSingle(),
    supabase.from('daily_checkins').select('mood, sleep_range, available_minutes, local_date').eq('telegram_id', telegramId).order('local_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('meditations').select('id, title, subtitle, description, category, duration, cover_image, audio_file, premium, published, mood, play_count, created_at, translations').eq('published', true).order('created_at', { ascending: false }).limit(40),
    supabase.from('ai_conversations').select('pending_state').eq('id', conversationId).eq('telegram_id', telegramId).maybeSingle()
  ]);

  const recentMessages = [...(recent ?? [])].reverse();
  const pendingState = inferPendingStateFromRecent(conversation?.pending_state, recentMessages);
  const context = {
    profile: user ? { firstName: user.first_name, goals: user.profile_goals } : null,
    latestCheckin: checkin ?? null,
    memories: user?.ai_memory_enabled && env.AI_MEMORY_ENABLED ? relevantMemories(currentMessage, memories ?? []) : [],
    pendingState
  };
  return { recent: recentMessages, context, catalog: catalog ?? [], memoryEnabled: Boolean(user?.ai_memory_enabled && env.AI_MEMORY_ENABLED), pendingState };
}

async function saveUsage(input: {
  telegramId: number; conversationId?: string; requestId: string; status: string; latencyMs: number;
  usage?: OpenAiResponse['usage']; errorClass?: string;
}) {
  const { error } = await supabase.from('ai_usage').upsert({
    telegram_id: input.telegramId,
    conversation_id: input.conversationId ?? null,
    request_id: input.requestId,
    model: env.AI_CHAT_MODEL,
    input_tokens: input.usage?.input_tokens ?? 0,
    output_tokens: input.usage?.output_tokens ?? 0,
    total_tokens: input.usage?.total_tokens ?? 0,
    request_status: input.status,
    latency_ms: input.latencyMs,
    error_class: input.errorClass ?? null
  }, { onConflict: 'telegram_id,request_id' });
  if (error) console.warn('[Luna AI usage save failed]', { user: userHash(input.telegramId), error: error.message });
}

async function saveMemories(telegramId: number, conversationId: string, sourceMessageId: string, candidates: z.infer<typeof memoryCandidateSchema>[], sourceMessage: string) {
  const valid = validMemoryCandidates(candidates, sourceMessage);
  if (!valid.length) return;
  const rows = valid.map((candidate) => ({
    telegram_id: telegramId,
    category: candidate.category,
    memory_key: candidate.key,
    memory_value: candidate.value,
    confidence: candidate.confidence,
    source_conversation_id: conversationId,
    source_message_id: sourceMessageId,
    is_active: true,
    updated_at: new Date().toISOString()
  }));
  const { error } = await supabase.from('user_memories').upsert(rows, { onConflict: 'telegram_id,category,memory_key' });
  if (error) console.warn('[Luna AI memory save failed]', { user: userHash(telegramId), error: error.message });
}

export async function listLunaConversations(telegramId: number) {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, title, language, status, created_at, updated_at, last_message_at')
    .eq('telegram_id', telegramId)
    .eq('status', 'active')
    .order('last_message_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return Promise.all((data ?? []).map(async (conversation) => {
    const { data: latest } = await supabase.from('ai_messages').select('content').eq('conversation_id', conversation.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    return { ...conversation, latestMessage: latest?.content ?? '' };
  }));
}

export async function getLunaConversation(telegramId: number, conversationId: string) {
  const conversation = await ownedConversation(telegramId, conversationId);
  const { data: messages, error } = await supabase.from('ai_messages').select('id, role, content, metadata, created_at').eq('conversation_id', conversationId).order('created_at');
  if (error) throw error;
  return { conversation, messages: messages ?? [] };
}

export async function deleteLunaConversation(telegramId: number, conversationId: string) {
  await ownedConversation(telegramId, conversationId);
  const { error } = await supabase.from('ai_conversations').delete().eq('id', conversationId).eq('telegram_id', telegramId);
  if (error) throw error;
}

export async function clearLunaConversations(telegramId: number) {
  const { error } = await supabase.from('ai_conversations').delete().eq('telegram_id', telegramId);
  if (error) throw error;
}

export async function getLunaMemory(telegramId: number) {
  const [{ data: user, error: userError }, { data: memories, error: memoryError }] = await Promise.all([
    supabase.from('users').select('ai_memory_enabled').eq('telegram_id', telegramId).single(),
    supabase.from('user_memories').select('id, category, memory_key, memory_value, created_at, updated_at').eq('telegram_id', telegramId).eq('is_active', true).order('updated_at', { ascending: false })
  ]);
  if (userError) throw userError;
  if (memoryError) throw memoryError;
  return { enabled: Boolean(user.ai_memory_enabled && env.AI_MEMORY_ENABLED), available: env.AI_MEMORY_ENABLED, memories: memories ?? [] };
}

export async function setLunaMemoryEnabled(telegramId: number, enabled: boolean) {
  const { error } = await supabase.from('users').update({ ai_memory_enabled: enabled }).eq('telegram_id', telegramId);
  if (error) throw error;
}

export async function deleteLunaMemory(telegramId: number, memoryId?: string) {
  let query = supabase.from('user_memories').delete().eq('telegram_id', telegramId);
  if (memoryId) query = query.eq('id', memoryId);
  const { error } = await query;
  if (error) throw error;
}

export async function sendLunaMessage(user: TelegramUserInput, rawInput: unknown) {
  if (!env.AI_CHAT_ENABLED) throw new LunaAiError('chat_disabled', 'Luna AI chat is not enabled.', 503);
  if (!env.OPENAI_API_KEY) throw new LunaAiError('missing_api_key', 'Luna AI is not configured.', 503);
  const input = lunaChatInputSchema.parse(rawInput);
  const responseLanguage = detectConversationLanguage(input.message, input.language);
  const telegramId = user.telegram_id;

  await upsertUser(user);
  const access = await getUserAccess(telegramId);
  const limit = access.hasPremium ? env.AI_PREMIUM_MAX_MESSAGES_PER_DAY : env.AI_MAX_MESSAGES_PER_DAY;
  const reservation = await reserveChatRequest(telegramId, input.requestId, limit, input.conversationId);
  console.info('[Luna AI request transition]', {
    user: userHash(telegramId), clientRequestId: input.requestId, state: reservation.status,
    quotaReserved: reservation.quota_charged, attempt: reservation.attempt_count
  });
  if (reservation.status === 'quota_exhausted') {
    throw new LunaAiError('quota_exhausted', 'Daily Luna message limit reached.', 429, false, 'quota_exhausted', nextUtcReset());
  }
  if (reservation.status === 'completed') {
    const completed = await existingCompletedResponse(telegramId, input.requestId, reservation.remaining);
    if (completed) return completed;
    await updateChatRequest(telegramId, input.requestId, {
      status: 'failed_retryable', quota_charged: false, error_code: 'missing_completed_response'
    });
    throw new LunaAiError('temporary_upstream', 'The completed Luna response could not be restored.', 503, true, 'failed_retryable');
  }
  if (!reservation.acquired) {
    throw new LunaAiError('request_in_progress', 'This message is already being processed.', 409, true, 'processing');
  }

  const startedAt = Date.now();
  let conversationId = input.conversationId;
  let userMessageId: string | undefined;
  let assistantMessageId: string | undefined;
  let conversationTitle = '';
  try {
    const storedRequest = await chatRequest(telegramId, input.requestId);
    conversationId = conversationId ?? storedRequest?.conversation_id ?? undefined;
    if (conversationId) {
      const conversation = await ownedConversation(telegramId, conversationId);
      conversationTitle = conversation.title ?? '';
    } else {
      const { data, error } = await supabase.from('ai_conversations').insert({ telegram_id: telegramId, language: input.language }).select().single();
      if (error) throw error;
      conversationId = data.id;
    }

    if (!conversationId) throw new LunaAiError('conversation_create_failed', 'Conversation could not be created.', 500);
    const resolvedConversationId = conversationId;
    await updateChatRequest(telegramId, input.requestId, { conversation_id: resolvedConversationId });
    const { data: duplicateUser } = await supabase.from('ai_messages').select('id, content').eq('conversation_id', resolvedConversationId).eq('request_id', input.requestId).eq('role', 'user').maybeSingle();
    if (duplicateUser) {
      const { data: duplicateAssistant } = await supabase.from('ai_messages').select('id, role, content, metadata, created_at').eq('conversation_id', resolvedConversationId).eq('request_id', input.requestId).eq('role', 'assistant').maybeSingle();
      userMessageId = duplicateUser.id;
      if (duplicateAssistant) {
        await updateChatRequest(telegramId, input.requestId, {
          status: 'completed', assistant_message_id: duplicateAssistant.id, completed_at: new Date().toISOString(), error_code: null
        });
        return { conversationId: resolvedConversationId, message: duplicateAssistant, duplicate: true, remaining: reservation.remaining, requestState: 'completed' as const };
      }
    }

    let userMessage = duplicateUser;
    if (!userMessage) {
      const { data, error: userMessageError } = await supabase.from('ai_messages').insert({
        conversation_id: resolvedConversationId, telegram_id: telegramId, role: 'user', content: input.message, request_id: input.requestId
      }).select('id, content').single();
      if (userMessageError) throw userMessageError;
      userMessage = data;
      userMessageId = data.id;
      await updateChatRequest(telegramId, input.requestId, { user_message_id: data.id });
    }

    const safety = safetyCategory(input.message);
    if (safety) {
      const responseText = safetyResponse(responseLanguage, safety);
      const { data: assistant, error } = await supabase.from('ai_messages').insert({
        conversation_id: resolvedConversationId, telegram_id: telegramId, role: 'assistant', content: responseText,
        request_id: input.requestId, metadata: { safetyState: safety }
      }).select().single();
      if (error) throw error;
      assistantMessageId = assistant.id;
      await supabase.from('ai_conversations').update({ title: conversationTitle || (input.language === 'ru' ? 'Нужна поддержка' : 'Need Support'), pending_state: {}, updated_at: new Date().toISOString(), last_message_at: new Date().toISOString() }).eq('id', resolvedConversationId);
      await saveUsage({ telegramId, conversationId: resolvedConversationId, requestId: input.requestId, status: 'safety_response', latencyMs: Date.now() - startedAt });
      await updateChatRequest(telegramId, input.requestId, {
        status: 'completed', assistant_message_id: assistant.id, completed_at: new Date().toISOString(), error_code: null
      });
      return { conversationId: resolvedConversationId, message: assistant, duplicate: false, remaining: reservation.remaining, requestState: 'completed' as const };
    }

    const { recent, context, catalog, memoryEnabled, pendingState } = await loadContext(telegramId, resolvedConversationId, input.message);
    console.info('[Luna AI pending state loaded]', {
      user: userHash(telegramId),
      requestId: input.requestId,
      conversationId: resolvedConversationId,
      pendingStatePresent: Boolean(pendingState),
      pendingState: pendingState ? {
        pending_intent: pendingState.pending_intent,
        pending_meditation_id: pendingState.pending_meditation_id,
        pending_action: pendingState.pending_action,
        clarification_hash: pendingState.clarification_hash,
        expires_at: pendingState.expires_at
      } : null
    });
    const catalogForPolicy = catalog.map((item) => ({
      id: item.id,
      catalogKey: catalogKey(item.title),
      title: item.translations?.[responseLanguage]?.title ?? item.title,
      category: item.category,
      mood: item.mood,
      duration: item.duration,
      language: responseLanguage,
      premium: item.premium,
      published: item.published,
      summary: compactText(item.translations?.[responseLanguage]?.subtitle ?? item.subtitle ?? item.description, 120)
    })) satisfies RecommendationCatalogItem[];
    const catalogForModel = catalogForPolicy.map((item) => ({
      catalogKey: item.catalogKey,
      title: item.title,
      category: item.category,
      mood: item.mood,
      duration: formatMeditationDuration(item.duration, responseLanguage),
      premium: item.premium,
      language: item.language,
      summary: item.summary
    }));
    const pendingResolution = resolvePendingReply(input.message, pendingState, catalogForPolicy);
    const resolvedPendingMeditation = pendingResolution && 'meditationId' in pendingResolution
      ? pendingResolution.meditationId
      : null;
    console.info('[Luna AI pending state resolved]', {
      user: userHash(telegramId),
      requestId: input.requestId,
      conversationId: resolvedConversationId,
      wasPending: Boolean(pendingState),
      resolvedIntent: pendingResolution && 'resolvedIntent' in pendingResolution ? pendingResolution.resolvedIntent : null,
      resolvedMeditationId: resolvedPendingMeditation,
      clearPending: Boolean(pendingResolution && 'clearPending' in pendingResolution && pendingResolution.clearPending)
    });
    const modelContext = {
      ...context,
      pendingResolution: pendingResolution && 'resolvedIntent' in pendingResolution
        ? { resolvedIntent: pendingResolution.resolvedIntent, meditationId: resolvedPendingMeditation, action: 'show_meditation_card' }
        : null
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.AI_REQUEST_TIMEOUT_MS);
    let openAiResponse: OpenAiResponse;
    let extracted: ExtractedOpenAiText | null = null;
    try {
      console.info('[Luna AI model request started]', {
        user: userHash(telegramId),
        requestId: input.requestId,
        conversationId: resolvedConversationId,
        pendingActionEnforced: Boolean(resolvedPendingMeditation),
        model: env.AI_CHAT_MODEL
      });
      openAiResponse = await callOpenAiResponses({
        requestBody: buildLunaOpenAiRequest({
          language: responseLanguage,
          catalog: catalogForModel,
          context: modelContext,
          recent,
          maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS
        }),
        signal: controller.signal,
        telegramId,
        requestId: input.requestId,
        conversationId: resolvedConversationId,
        attempt: 1
      });
      console.info('[Luna AI model result received]', {
        user: userHash(telegramId),
        requestId: input.requestId,
        conversationId: resolvedConversationId,
        model: openAiResponse.model ?? env.AI_CHAT_MODEL,
        status: openAiResponse.status ?? null
      });
      try {
        extracted = extractOpenAiText(openAiResponse);
      } catch (error) {
        logBackendError(error, { endpoint: 'Luna OpenAI response extraction', telegramId, requestId: input.requestId });
        if (!shouldRetryOpenAiResponse(openAiResponse, extracted)) throw error;
      }

      if (shouldRetryOpenAiResponse(openAiResponse, extracted)) {
        const retryTokens = retryMaxOutputTokens(env.AI_MAX_OUTPUT_TOKENS);
        console.warn('[Luna AI OpenAI retry]', JSON.stringify({
          user: userHash(telegramId),
          conversationId: resolvedConversationId,
          reason: openAiResponse.incomplete_details?.reason,
          firstMaxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
          retryMaxOutputTokens: retryTokens,
          reasoningEffort: env.AI_REASONING_EFFORT
        }, null, 2));
        openAiResponse = await callOpenAiResponses({
          requestBody: buildLunaOpenAiRequest({
            language: responseLanguage,
            catalog: catalogForModel,
            context: modelContext,
            recent,
            maxOutputTokens: retryTokens
          }),
          signal: controller.signal,
          telegramId,
          requestId: input.requestId,
          conversationId: resolvedConversationId,
          attempt: 2
        });
        extracted = extractOpenAiText(openAiResponse);
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!extracted) throw new LunaAiError('malformed_response', 'OpenAI returned no assistant text after retry.', 502);
    const finishReason = extractFinishReason(openAiResponse);
    console.info('[Luna AI OpenAI parsed response]', {
      user: userHash(telegramId),
      conversationId: resolvedConversationId,
      model: openAiResponse.model ?? env.AI_CHAT_MODEL,
      openAiRequestId: openAiResponse._requestId ?? null,
      responseStatus: openAiResponse.status ?? 'unknown',
      outputItemTypes: openAiOutputTypes(openAiResponse),
      finishReason,
      extractedPath: extracted.path,
      parsedResultType: extracted.refusal ? 'refusal' : extracted.text.trim().startsWith('{') ? 'structured_or_json_text' : 'plain_text',
      hasText: Boolean(extracted.text),
      hasRefusal: Boolean(extracted.refusal)
    });

    const recentAssistantRecommendations = recent
      .filter((message) => message.role === 'assistant')
      .slice(-4)
      .map((message) => {
        const metadata = message.metadata as { recommendedMeditationId?: string | null; meditationAction?: { meditationId?: string | null } | null } | null;
        return metadata?.recommendedMeditationId ?? metadata?.meditationAction?.meditationId ?? null;
      });
    const parsed = normalizeOpenAiModelResult(extracted, responseLanguage, { telegramId, requestId: input.requestId });
    const explicitMeditationRequest = isReadyMeditationRequest(input.message);
    const effectiveExplicitRequest = explicitMeditationRequest || Boolean(resolvedPendingMeditation);
    const validatedAction = resolveMeditationAction(parsed.meditationAction, catalogForPolicy);
    if (parsed.meditationAction && !validatedAction) {
      console.warn('[Luna AI meditation action rejected]', {
        user: userHash(telegramId),
        conversationId: resolvedConversationId,
        meditationId: parsed.meditationAction.meditationId,
        actionParsingResult: 'rejected',
        catalogMatch: false,
        catalogSize: catalogForPolicy.length
      });
    }
    const recommendationRequested = effectiveExplicitRequest || Boolean(parsed.meditationAction) || (
      parsed.recommendationIntent.needed && !recentAssistantRecommendations.slice(-3).some(Boolean)
    );
    let recommendedMeditationId = resolvedPendingMeditation ?? semanticMeditationRecommendation({
      message: resolvedPendingMeditation ? `${pendingResolution && 'resolvedIntent' in pendingResolution ? pendingResolution.resolvedIntent : ''} meditation ${input.message}` : input.message,
      catalog: catalogForPolicy,
      language: responseLanguage,
      modelRecommendationId: validatedAction?.meditationId
        ?? catalogForPolicy.find((item) => item.catalogKey === parsed.recommendationIntent.preferredCatalogKey)?.id
        ?? null,
      modelRecommendationGoal: parsed.recommendationIntent.goal,
      recentAssistantRecommendations,
      recentMessages: recent,
      vulnerable: isVulnerableMessage(input.message)
    });
    if (!recommendedMeditationId) {
      const mentionedId = meditationIdMentionedInText(parsed.message, catalogForPolicy);
      if (mentionedId && (effectiveExplicitRequest || parsed.recommendationIntent.needed)) {
        recommendedMeditationId = mentionedId;
        console.warn('[Luna AI recommendation repaired from title]', {
          user: userHash(telegramId),
          conversationId: resolvedConversationId,
          repaired: true
        });
      }
    }
    if (recommendationRequested && !recommendedMeditationId) {
      console.warn('[Luna AI meditation card fallback]', {
        user: userHash(telegramId),
        conversationId: resolvedConversationId,
        requestedMeditationId: parsed.meditationAction?.meditationId ?? parsed.recommendationIntent.preferredCatalogKey ?? null,
        catalogMatch: Boolean(validatedAction),
        actionParsingResult: parsed.meditationAction ? (validatedAction ? 'validated' : 'rejected') : 'not_requested',
        recommendationRequested: true
      });
    }
    const actionFailed = Boolean(parsed.meditationAction) && !validatedAction;
    console.info('[Luna AI resolved meditation]', {
      user: userHash(telegramId),
      requestId: input.requestId,
      conversationId: resolvedConversationId,
      recommendationRequested,
      selectedPublishedMeditationId: recommendedMeditationId,
      noCardReason: !recommendedMeditationId
        ? (recommendationRequested ? (actionFailed ? 'model_action_failed_or_no_catalog_match' : 'no_semantic_catalog_match') : 'recommendation_not_requested')
        : null
    });
    const visibleMessage = recommendationRequested && !recommendedMeditationId
      ? actionFailed ? meditationCardFallback(responseLanguage) : meditationClarificationFallback(responseLanguage)
      : finalizeAssistantContent({
      parsedMessage: parsed.message,
      language: responseLanguage,
      catalog: catalogForPolicy,
      recommendedMeditationId,
      explicitRequest: effectiveExplicitRequest
    });
    const previousClarificationHash = [...recent].reverse()
      .filter((message) => message.role === 'assistant')
      .map((message) => {
        const metadata = message.metadata as { clarificationHash?: unknown; clarification_hash?: unknown } | null;
        return typeof metadata?.clarificationHash === 'string'
          ? metadata.clarificationHash
          : typeof metadata?.clarification_hash === 'string' ? metadata.clarification_hash : null;
      })
      .find(Boolean) ?? null;
    const duplicateClarification = !recommendedMeditationId
      && clarificationHash(visibleMessage) === previousClarificationHash;
    if (duplicateClarification) {
      console.warn('[Luna AI duplicate clarification blocked]', {
        user: userHash(telegramId),
        requestId: input.requestId,
        conversationId: resolvedConversationId,
        clarificationHash: clarificationHash(visibleMessage)
      });
    }
    const safeVisibleMessage = duplicateClarification
      ? meditationCardFallback(responseLanguage)
      : visibleMessage;
    const shouldWaitForCardConfirmation = Boolean(recommendedMeditationId)
      && !effectiveExplicitRequest
      && asksToShowMeditationCard(parsed.message);
    const attachedMeditationId = shouldWaitForCardConfirmation ? null : recommendedMeditationId;
    const assistantContent = enforceCardClaimConsistency(safeVisibleMessage, responseLanguage, Boolean(attachedMeditationId));
    if (!assistantContent) throw new LunaAiError('malformed_response', 'Luna returned no safe visible message.', 502);
    if (hasInternalDataLeak(assistantContent)) {
      console.warn('[Luna AI internal data guard]', {
        user: userHash(telegramId),
        conversationId: resolvedConversationId
      });
      throw new LunaAiError('malformed_response', 'Luna returned unsafe internal data.', 502);
    }
    if (responseLanguage === 'ru' && containsMasculineLunaSelfReference(assistantContent)) {
      console.warn('[Luna AI identity guard]', { user: userHash(telegramId), conversationId: resolvedConversationId });
    }
    const recommendedMeditation = attachedMeditationId
      ? catalog.find((item) => item.id === attachedMeditationId) ?? null
      : null;
    const meditationAction = recommendedMeditation
      ? { type: 'meditation_card' as const, meditationId: recommendedMeditation.id }
      : null;
    console.info('[Luna AI card action generated]', {
      user: userHash(telegramId),
      requestId: input.requestId,
      conversationId: resolvedConversationId,
      meditationId: meditationAction?.meditationId ?? null,
      generated: Boolean(meditationAction)
    });
    const resolvedIntent = pendingResolution && 'resolvedIntent' in pendingResolution
      ? pendingResolution.resolvedIntent
      : null;
    const nextPendingState: PendingLunaState | null = shouldWaitForCardConfirmation
      ? createPendingClarification({ clarification: assistantContent, meditationId: recommendedMeditationId, action: 'show_meditation_card' })
      : recommendedMeditationId
        ? null
        : recommendationRequested
          ? createPendingClarification({ clarification: assistantContent })
          : pendingResolution && 'clearPending' in pendingResolution && pendingResolution.clearPending
            ? null
            : pendingState;
    const { data: assistant, error: assistantError } = await supabase.from('ai_messages').insert({
      conversation_id: resolvedConversationId, telegram_id: telegramId, role: 'assistant', content: assistantContent,
      request_id: input.requestId,
      metadata: {
        recommendedMeditationId: attachedMeditationId,
        meditationAction,
        recommendedMeditation,
        safetyState: 'none',
        resolvedIntent,
        pending_action: nextPendingState?.pending_action ?? null,
        pending_state: nextPendingState,
        clarificationHash: nextPendingState?.clarification_hash ?? null,
        duplicateClarificationBlocked: duplicateClarification
      }
    }).select().single();
    if (assistantError) throw assistantError;
    assistantMessageId = assistant.id;
    await updateChatRequest(telegramId, input.requestId, {
      status: 'completed', assistant_message_id: assistant.id, recommendation_id: attachedMeditationId,
      completed_at: new Date().toISOString(), error_code: null
    });

    const fallbackTitle = input.message.split(/\s+/).slice(0, 6).join(' ').slice(0, 60);
    const { error: conversationError } = await supabase.from('ai_conversations').update({
      title: conversationTitle || parsed.conversationTitle?.trim() || fallbackTitle,
      language: responseLanguage,
      pending_state: nextPendingState ?? {},
      updated_at: new Date().toISOString(), last_message_at: new Date().toISOString()
    }).eq('id', resolvedConversationId).eq('telegram_id', telegramId);
    if (conversationError) throw conversationError;

    if (memoryEnabled && userMessage?.id) await saveMemories(telegramId, resolvedConversationId, userMessage.id, parsed.memoryCandidates, input.message);
    await saveUsage({ telegramId, conversationId: resolvedConversationId, requestId: input.requestId, status: 'completed', latencyMs: Date.now() - startedAt, usage: openAiResponse.usage });
    const responsePayload = { conversationId: resolvedConversationId, message: assistant, duplicate: false, remaining: reservation.remaining, requestState: 'completed' as const };
    console.info('[Luna AI final response]', {
      user: userHash(telegramId),
      conversationId: resolvedConversationId,
      messageId: assistant.id,
      recommendationRef: safeReference(attachedMeditationId),
      recommendationRequested: effectiveExplicitRequest || parsed.recommendationIntent.needed,
      recommendationValidated: Boolean(recommendedMeditationId),
      recommendationCardAttached: Boolean(attachedMeditationId),
      messageLength: assistantContent.length
    });
    console.info('[Luna AI request completed]', { user: userHash(telegramId), conversationId: resolvedConversationId, model: env.AI_CHAT_MODEL, latencyMs: Date.now() - startedAt, tokens: openAiResponse.usage?.total_tokens ?? 0 });
    return responsePayload;
  } catch (error) {
    const failure = classifyLunaFailure(error);
    const errorClass = failure.code;
    const requestState: LunaRequestState = failure.retryable ? 'failed_retryable' : 'failed_non_retryable';
    await saveUsage({ telegramId, conversationId, requestId: input.requestId, status: 'failed', latencyMs: Date.now() - startedAt, errorClass });
    await updateChatRequest(telegramId, input.requestId, {
      status: requestState, error_code: errorClass, quota_charged: false,
      user_message_id: userMessageId ?? null, assistant_message_id: assistantMessageId ?? null
      }).catch((updateError) => {
        logBackendError(updateError, { endpoint: 'Luna request state save', telegramId, requestId: input.requestId });
      });
    logBackendError(error, { endpoint: 'POST /api/luna/chat', telegramId, requestId: input.requestId });
    if (error instanceof LunaAiError) throw new LunaAiError(error.code, error.message, error.status, failure.retryable, requestState);
    if (error instanceof z.ZodError) throw new LunaAiError('permanent_validation', 'Luna returned an invalid response.', 422, false, requestState);
    if (error instanceof Error && error.name === 'AbortError') throw new LunaAiError('timeout', 'Luna response timed out.', 504, true, requestState);
    throw new LunaAiError('unknown', 'Luna could not respond.', 502, true, requestState);
  }
}
