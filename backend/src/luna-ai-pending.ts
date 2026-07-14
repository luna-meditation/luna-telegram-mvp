import crypto from 'node:crypto';
import { semanticMeditationRecommendation, type RecommendationCatalogItem } from './luna-ai-policy.js';

export type PendingAction = 'choose_meditation' | 'show_meditation_card';
export type PendingIntent = 'sleep' | 'focus' | 'stress_reset' | 'meditation_request';

export type PendingLunaState = {
  pending_intent: PendingIntent;
  pending_meditation_id: string | null;
  pending_action: PendingAction;
  pending_clarification: string;
  clarification_hash: string | null;
  expires_at: string;
};

export type PendingResolution = {
  meditationId: string;
  resolvedIntent: Exclude<PendingIntent, 'meditation_request'> | 'show_meditation_card';
  clearPending: true;
};

const pendingTtlMs = 15 * 60 * 1000;

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-zа-я0-9]+/gi, ' ').trim();
}

export function clarificationHash(value: string) {
  return crypto.createHash('sha256').update(normalize(value)).digest('hex').slice(0, 24);
}

export function createPendingClarification(input: {
  clarification: string;
  intent?: PendingIntent;
  meditationId?: string | null;
  action?: PendingAction;
}) : PendingLunaState {
  return {
    pending_intent: input.intent ?? 'meditation_request',
    pending_meditation_id: input.meditationId ?? null,
    pending_action: input.action ?? (input.meditationId ? 'show_meditation_card' : 'choose_meditation'),
    pending_clarification: input.clarification,
    clarification_hash: clarificationHash(input.clarification),
    expires_at: new Date(Date.now() + pendingTtlMs).toISOString()
  };
}

export function normalizePendingState(value: unknown): PendingLunaState | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PendingLunaState>;
  if (
    typeof candidate.pending_intent !== 'string'
    || typeof candidate.pending_action !== 'string'
    || typeof candidate.pending_clarification !== 'string'
    || typeof candidate.expires_at !== 'string'
    || !['sleep', 'focus', 'stress_reset', 'meditation_request'].includes(candidate.pending_intent)
    || !['choose_meditation', 'show_meditation_card'].includes(candidate.pending_action)
  ) return null;
  const expiresAt = new Date(candidate.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return {
    pending_intent: candidate.pending_intent as PendingIntent,
    pending_meditation_id: typeof candidate.pending_meditation_id === 'string' ? candidate.pending_meditation_id : null,
    pending_action: candidate.pending_action as PendingAction,
    pending_clarification: candidate.pending_clarification,
    clarification_hash: typeof candidate.clarification_hash === 'string' ? candidate.clarification_hash : null,
    expires_at: candidate.expires_at
  };
}

function shortIntent(message: string): Exclude<PendingIntent, 'meditation_request'> | null {
  const normalized = normalize(message);
  if (/^(?:sleep|bed|сон|спать|уснуть|сна)$/.test(normalized)) return 'sleep';
  if (/^(?:focus|clarity|attention|фокус|внимание|сосредоточиться)$/.test(normalized)) return 'focus';
  if (/^(?:reset|restart|soft reset|gentle reset|перезагрузка|перезагрузиться|сброс|мягкая перезагрузка)$/.test(normalized)) return 'stress_reset';
  return null;
}

function isConfirmation(message: string) {
  return /^(?:yes|yeah|yep|ok|okay|show|show it|send it|send her|open|open it|да|ага|покажи|пришли|пришли её|пришли ее|открой|открывай)[.! ]*$/i.test(message.trim());
}

function isExplicitTopicChange(message: string) {
  const normalized = normalize(message);
  if (!normalized || shortIntent(message) || isConfirmation(message)) return false;
  return normalized.length > 24;
}

function intentMessage(intent: Exclude<PendingIntent, 'meditation_request'>) {
  if (intent === 'sleep') return 'sleep rest night meditation';
  if (intent === 'focus') return 'focus clarity attention meditation';
  return 'soft reset breath calm stress meditation';
}

function resolveCatalogIntent(
  intent: Exclude<PendingIntent, 'meditation_request'>,
  message: string,
  catalog: RecommendationCatalogItem[]
) {
  return semanticMeditationRecommendation({
    message: `${intentMessage(intent)} ${message} meditation`,
    catalog,
    modelRecommendationGoal: intent,
    recentAssistantRecommendations: [],
    recentMessages: [],
    vulnerable: false
  });
}

export function resolvePendingReply(
  message: string,
  state: PendingLunaState | null,
  catalog: RecommendationCatalogItem[]
): PendingResolution | { clearPending: true } | null {
  const active = normalizePendingState(state);
  if (!active) return null;

  if (active.pending_meditation_id && isConfirmation(message)) {
    const selected = catalog.find((item) => item.id === active.pending_meditation_id && item.published !== false);
    if (selected) return { meditationId: selected.id, resolvedIntent: 'show_meditation_card', clearPending: true };
  }

  const intent = shortIntent(message);
  if (intent && (active.pending_action === 'choose_meditation' || active.pending_intent === 'meditation_request')) {
    const meditationId = resolveCatalogIntent(intent, message, catalog);
    if (meditationId) return { meditationId, resolvedIntent: intent, clearPending: true };
  }

  return isExplicitTopicChange(message) ? { clearPending: true } : null;
}

export function inferPendingStateFromRecent(
  stored: unknown,
  recent: Array<{ role?: string | null; content?: string | null; metadata?: unknown }>
) {
  const normalizedStored = normalizePendingState(stored);
  if (normalizedStored) return normalizedStored;

  const latestAssistant = [...recent].reverse().find((message) => message.role === 'assistant');
  if (!latestAssistant) return null;
  const content = latestAssistant.content ?? '';
  if (/(сон|фокус|перезагруз|sleep|focus|reset)/i.test(content) && /\?/u.test(content)) {
    return createPendingClarification({ clarification: content });
  }

  const metadata = latestAssistant.metadata as { recommendedMeditationId?: unknown; pending_action?: unknown } | null;
  const meditationId = typeof metadata?.recommendedMeditationId === 'string' ? metadata.recommendedMeditationId : null;
  if (meditationId && (metadata?.pending_action === 'show_meditation_card' || /(?:карточк|показать|открыть|show|open|card)/i.test(content))) {
    return createPendingClarification({
      clarification: content,
      meditationId,
      action: 'show_meditation_card'
    });
  }
  return null;
}
