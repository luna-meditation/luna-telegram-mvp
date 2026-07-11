import crypto from 'node:crypto';
import { z } from 'zod';
import { env } from './config.js';
import { getUserAccess, supabase, upsertUser, type TelegramUserInput } from './db.js';
import { memoryCandidateSchema, memoryCategories, safetyCategory, validatedMeditationId, validMemoryCandidates } from './luna-ai-policy.js';

const languageSchema = z.enum(['en', 'ru']);
const modelResultSchema = z.object({
  message: z.string().min(1).max(5000),
  conversationTitle: z.string().min(1).max(60).nullable(),
  recommendedMeditationId: z.string().uuid().nullable(),
  memoryCandidates: z.array(memoryCandidateSchema).max(3)
});

export const lunaChatInputSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(env.AI_MAX_MESSAGE_LENGTH),
  language: languageSchema,
  requestId: z.string().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/)
});

export class LunaAiError extends Error {
  constructor(public code: string, message: string, public status = 500) {
    super(message);
    this.name = 'LunaAiError';
  }
}

type OpenAiResponse = {
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
};

const activeRequests = new Set<number>();

function userHash(telegramId: number) {
  return crypto.createHash('sha256').update(String(telegramId)).digest('hex').slice(0, 12);
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

function systemPrompt(language: 'en' | 'ru', catalogJson: string, contextJson: string) {
  return `You are Luna, the calm, emotionally attentive mindfulness companion inside the Luna Meditation app.
You are not a generic chatbot, therapist, doctor, or emergency service. Listen carefully, respond with warmth and grounded emotional intelligence, help the user slow down, and suggest one small practical next step when useful.

Tone: calm, warm, concise, human, never patronizing, never falsely mystical, never repetitive. Do not begin every response with thanks. Do not recommend breathing every time. Ask at most one thoughtful question. Most replies are 2-6 short mobile-friendly paragraphs. Never diagnose or make medical claims.

Reply in ${language === 'ru' ? 'Russian' : 'English'}, unless the user clearly asks to use another language. Never invent user history, completed activities, memories, or meditation content. Use remembered details only when supplied below and genuinely relevant.

Meditations: recommend only an exact id from CATALOG. If none fits, return null. Never invent titles, durations, access, or URLs.
Memory: return only durable details explicitly grounded in the user's own message. Do not save greetings, temporary feelings, diagnoses, highly sensitive details, or your own inferences. Use snake_case keys and confidence below 1 unless explicitly stated.

USER_CONTEXT:
${contextJson}

CATALOG:
${catalogJson}`;
}

function extractOutputText(response: OpenAiResponse) {
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if ((content.type === 'output_text' || content.type === 'text') && content.text) return content.text;
    }
  }
  throw new LunaAiError('malformed_response', 'OpenAI returned no text response.', 502);
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

async function dailyUsage(telegramId: number) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('telegram_id', telegramId)
    .eq('request_status', 'completed')
    .gte('created_at', start.toISOString());
  if (error) throw error;
  return count ?? 0;
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
  const [{ data: recent }, { data: memories }, { data: user }, { data: checkin }, { data: catalog }] = await Promise.all([
    supabase.from('ai_messages').select('role, content, created_at').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(env.AI_RECENT_MESSAGE_LIMIT),
    supabase.from('user_memories').select('category, memory_key, memory_value').eq('telegram_id', telegramId).eq('is_active', true).order('updated_at', { ascending: false }).limit(30),
    supabase.from('users').select('first_name, language_code, profile_goals, ai_memory_enabled').eq('telegram_id', telegramId).maybeSingle(),
    supabase.from('daily_checkins').select('mood, sleep_range, available_minutes, local_date').eq('telegram_id', telegramId).order('local_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('meditations').select('id, title, subtitle, description, category, duration, premium, mood, translations').eq('published', true).order('created_at', { ascending: false }).limit(40)
  ]);

  const context = {
    profile: user ? { firstName: user.first_name, goals: user.profile_goals } : null,
    latestCheckin: checkin ?? null,
    memories: user?.ai_memory_enabled && env.AI_MEMORY_ENABLED ? relevantMemories(currentMessage, memories ?? []) : []
  };
  return { recent: [...(recent ?? [])].reverse(), context, catalog: catalog ?? [], memoryEnabled: Boolean(user?.ai_memory_enabled && env.AI_MEMORY_ENABLED) };
}

async function saveUsage(input: {
  telegramId: number; conversationId?: string; requestId: string; status: string; latencyMs: number;
  usage?: OpenAiResponse['usage']; errorClass?: string;
}) {
  const { error } = await supabase.from('ai_usage').insert({
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
  });
  if (error) console.warn('[Luna AI usage save failed]', { user: userHash(input.telegramId), error: error.message });
}

async function saveMemories(telegramId: number, conversationId: string, sourceMessageId: string, candidates: z.infer<typeof memoryCandidateSchema>[]) {
  const valid = validMemoryCandidates(candidates);
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
  const telegramId = user.telegram_id;
  if (activeRequests.has(telegramId)) throw new LunaAiError('request_in_progress', 'A Luna response is already in progress.', 409);

  await upsertUser(user);
  const access = await getUserAccess(telegramId);
  const limit = access.hasPremium ? env.AI_PREMIUM_MAX_MESSAGES_PER_DAY : env.AI_MAX_MESSAGES_PER_DAY;
  const used = await dailyUsage(telegramId);
  if (used >= limit) throw new LunaAiError('daily_limit', 'Daily Luna message limit reached.', 429);

  activeRequests.add(telegramId);
  const startedAt = Date.now();
  let conversationId = input.conversationId;
  let userMessageId: string | undefined;
  let assistantMessageId: string | undefined;
  let conversationTitle = '';
  let createdConversation = false;
  try {
    if (conversationId) {
      const conversation = await ownedConversation(telegramId, conversationId);
      conversationTitle = conversation.title ?? '';
    } else {
      const { data, error } = await supabase.from('ai_conversations').insert({ telegram_id: telegramId, language: input.language }).select().single();
      if (error) throw error;
      conversationId = data.id;
      createdConversation = true;
    }

    if (!conversationId) throw new LunaAiError('conversation_create_failed', 'Conversation could not be created.', 500);
    const resolvedConversationId = conversationId;
    const { data: duplicateUser } = await supabase.from('ai_messages').select('id').eq('conversation_id', resolvedConversationId).eq('request_id', input.requestId).eq('role', 'user').maybeSingle();
    if (duplicateUser) {
      const { data: duplicateAssistant } = await supabase.from('ai_messages').select('id, role, content, metadata, created_at').eq('conversation_id', resolvedConversationId).eq('request_id', input.requestId).eq('role', 'assistant').maybeSingle();
      if (duplicateAssistant) return { conversationId: resolvedConversationId, message: duplicateAssistant, duplicate: true, remaining: Math.max(0, limit - used) };
      throw new LunaAiError('request_in_progress', 'This message is already being processed.', 409);
    }

    const { data: userMessage, error: userMessageError } = await supabase.from('ai_messages').insert({
      conversation_id: resolvedConversationId, telegram_id: telegramId, role: 'user', content: input.message, request_id: input.requestId
    }).select().single();
    if (userMessageError) throw userMessageError;
    userMessageId = userMessage.id;

    const safety = safetyCategory(input.message);
    if (safety) {
      const responseText = safetyResponse(input.language, safety);
      const { data: assistant, error } = await supabase.from('ai_messages').insert({
        conversation_id: resolvedConversationId, telegram_id: telegramId, role: 'assistant', content: responseText,
        request_id: input.requestId, metadata: { safetyState: safety }
      }).select().single();
      if (error) throw error;
      assistantMessageId = assistant.id;
      await supabase.from('ai_conversations').update({ title: conversationTitle || (input.language === 'ru' ? 'Нужна поддержка' : 'Need Support'), updated_at: new Date().toISOString(), last_message_at: new Date().toISOString() }).eq('id', resolvedConversationId);
      await saveUsage({ telegramId, conversationId: resolvedConversationId, requestId: input.requestId, status: 'safety_response', latencyMs: Date.now() - startedAt });
      return { conversationId: resolvedConversationId, message: assistant, duplicate: false, remaining: Math.max(0, limit - used - 1) };
    }

    const { recent, context, catalog, memoryEnabled } = await loadContext(telegramId, resolvedConversationId, input.message);
    const catalogForModel = catalog.map((item) => ({
      id: item.id, title: item.title, subtitle: item.subtitle, description: item.description,
      category: item.category, duration: item.duration, language: input.language,
      premium: item.premium, mood: item.mood, translation: item.translations?.[input.language] ?? null
    }));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.AI_REQUEST_TIMEOUT_MS);
    let openAiResponse: OpenAiResponse;
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: env.AI_CHAT_MODEL,
          store: false,
          instructions: systemPrompt(input.language, JSON.stringify(catalogForModel), JSON.stringify(context)),
          input: recent.map((message) => ({ role: message.role, content: message.content })),
          max_output_tokens: env.AI_MAX_OUTPUT_TOKENS,
          text: {
            format: {
              type: 'json_schema', name: 'luna_companion_response', strict: true,
              schema: {
                type: 'object', additionalProperties: false,
                properties: {
                  message: { type: 'string' },
                  conversationTitle: { type: ['string', 'null'] },
                  recommendedMeditationId: { type: ['string', 'null'] },
                  memoryCandidates: {
                    type: 'array', maxItems: 3,
                    items: {
                      type: 'object', additionalProperties: false,
                      properties: {
                        category: { type: 'string', enum: memoryCategories }, key: { type: 'string' },
                        value: { type: 'string' }, confidence: { type: 'number' }
                      },
                      required: ['category', 'key', 'value', 'confidence']
                    }
                  }
                },
                required: ['message', 'conversationTitle', 'recommendedMeditationId', 'memoryCandidates']
              }
            }
          }
        })
      });
      const body = await response.text();
      if (!response.ok) {
        const code = response.status === 429 ? 'openai_rate_limit' : response.status === 401 ? 'openai_auth' : 'openai_error';
        throw new LunaAiError(code, `OpenAI request failed with status ${response.status}.`, response.status === 429 ? 429 : 502);
      }
      openAiResponse = JSON.parse(body) as OpenAiResponse;
    } finally {
      clearTimeout(timeout);
    }

    const parsed = modelResultSchema.parse(JSON.parse(extractOutputText(openAiResponse)));
    const recommendedMeditationId = validatedMeditationId(parsed.recommendedMeditationId, catalog.map((item) => item.id));
    const { data: assistant, error: assistantError } = await supabase.from('ai_messages').insert({
      conversation_id: resolvedConversationId, telegram_id: telegramId, role: 'assistant', content: parsed.message,
      request_id: input.requestId,
      metadata: { recommendedMeditationId, safetyState: 'none' }
    }).select().single();
    if (assistantError) throw assistantError;
    assistantMessageId = assistant.id;

    const fallbackTitle = input.message.split(/\s+/).slice(0, 6).join(' ').slice(0, 60);
    const { error: conversationError } = await supabase.from('ai_conversations').update({
      title: conversationTitle || parsed.conversationTitle?.trim() || fallbackTitle,
      language: input.language,
      updated_at: new Date().toISOString(), last_message_at: new Date().toISOString()
    }).eq('id', resolvedConversationId).eq('telegram_id', telegramId);
    if (conversationError) throw conversationError;

    if (memoryEnabled) await saveMemories(telegramId, resolvedConversationId, userMessage.id, parsed.memoryCandidates);
    await saveUsage({ telegramId, conversationId: resolvedConversationId, requestId: input.requestId, status: 'completed', latencyMs: Date.now() - startedAt, usage: openAiResponse.usage });
    console.info('[Luna AI request completed]', { user: userHash(telegramId), conversationId: resolvedConversationId, model: env.AI_CHAT_MODEL, latencyMs: Date.now() - startedAt, tokens: openAiResponse.usage?.total_tokens ?? 0 });
    return { conversationId: resolvedConversationId, message: assistant, duplicate: false, remaining: Math.max(0, limit - used - 1) };
  } catch (error) {
    const errorClass = error instanceof LunaAiError ? error.code : error instanceof z.ZodError ? 'malformed_response' : error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'internal_error';
    await saveUsage({ telegramId, conversationId, requestId: input.requestId, status: 'failed', latencyMs: Date.now() - startedAt, errorClass });
    console.error('[Luna AI request failed]', { user: userHash(telegramId), conversationId, errorClass, latencyMs: Date.now() - startedAt });
    if (assistantMessageId) await supabase.from('ai_messages').delete().eq('id', assistantMessageId).eq('telegram_id', telegramId);
    if (userMessageId) await supabase.from('ai_messages').delete().eq('id', userMessageId).eq('telegram_id', telegramId);
    if (createdConversation && conversationId) await supabase.from('ai_conversations').delete().eq('id', conversationId).eq('telegram_id', telegramId);
    if (error instanceof LunaAiError) throw error;
    if (error instanceof z.ZodError) throw new LunaAiError('malformed_response', 'Luna returned an invalid response.', 502);
    if (error instanceof Error && error.name === 'AbortError') throw new LunaAiError('timeout', 'Luna response timed out.', 504);
    throw error;
  } finally {
    activeRequests.delete(telegramId);
  }
}
