import { useSyncExternalStore } from 'react';
import { apiDebugConfig, sendClientEvent, type ClientEventName } from './api';

export const frontendBuildMetadata = {
  commitSha: import.meta.env.VITE_COMMIT_SHA ?? import.meta.env.VITE_APP_VERSION ?? 'local',
  buildTimestamp: import.meta.env.VITE_BUILD_TIMESTAMP ?? 'local',
  deployEnvironment: import.meta.env.VITE_DEPLOY_ENV ?? (import.meta.env.DEV ? 'development' : 'production'),
  apiUrl: apiDebugConfig.apiBaseUrl
};

export type RuntimeDiagnostics = {
  lastPaymentStage: string | null;
  lastPaymentAt: string | null;
  lastPaymentRequestId: string | null;
  lastLunaStage: string | null;
  lastLunaAt: string | null;
  lastLunaIntent: string | null;
  lastLunaMeditationId: string | null;
};

const listeners = new Set<() => void>();
let snapshot: RuntimeDiagnostics = {
  lastPaymentStage: null,
  lastPaymentAt: null,
  lastPaymentRequestId: null,
  lastLunaStage: null,
  lastLunaAt: null,
  lastLunaIntent: null,
  lastLunaMeditationId: null
};

function publish(next: Partial<RuntimeDiagnostics>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

export function useRuntimeDiagnostics() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => snapshot
  );
}

function telegramDetails() {
  const webApp = window.Telegram?.WebApp;
  return {
    platform: webApp?.platform ?? null,
    webAppVersion: webApp?.version ?? null,
    hasTelegramWebApp: Boolean(webApp),
    hasOpenInvoice: typeof webApp?.openInvoice === 'function',
    urlHost: window.location.host
  };
}

function safeErrorDetails(details: Record<string, unknown>) {
  const error = details.error;
  const errorMessage = details.errorMessage ?? (error instanceof Error ? error.message : undefined);
  const errorName = details.errorName ?? (error instanceof Error ? error.name : undefined);
  return {
    errorName: typeof errorName === 'string' ? errorName.slice(0, 120) : null,
    errorMessage: typeof errorMessage === 'string' ? errorMessage.slice(0, 500) : null,
    callbackStatus: typeof details.callbackStatus === 'string'
      ? details.callbackStatus.slice(0, 40)
      : typeof details.status === 'string' ? details.status.slice(0, 40) : null,
    invoiceHost: typeof details.invoiceHost === 'string' ? details.invoiceHost.slice(0, 160) : null
  };
}

const paymentEventMap: Record<string, ClientEventName> = {
  button_clicked: 'payment_button_clicked',
  request_started: 'invoice_request_started',
  response_received: 'invoice_response_received',
  invoice_url_validated: 'invoice_url_validated',
  open_invoice_available: 'open_invoice_available',
  openInvoice_called: 'open_invoice_called',
  openInvoice_callback: 'open_invoice_callback',
  openInvoice_threw: 'open_invoice_exception',
  openInvoice_timeout: 'payment_timeout',
  telegram_api_unavailable: 'open_invoice_available',
  entitlement_refresh_started: 'entitlement_refresh_started',
  entitlement_refresh_completed: 'entitlement_refresh_completed',
  failed: 'payment_failed'
};

export function recordPaymentStage(stage: string, details: Record<string, unknown>, initData?: string) {
  const now = new Date().toISOString();
  publish({
    lastPaymentStage: stage,
    lastPaymentAt: now,
    lastPaymentRequestId: typeof details.requestId === 'string' ? details.requestId : snapshot.lastPaymentRequestId
  });

  const event = paymentEventMap[stage];
  if (!event || !initData) return;
  const telegram = telegramDetails();
  void sendClientEvent(event, {
    requestId: typeof details.requestId === 'string' ? details.requestId : null,
    plan: details.plan,
    frontendSha: frontendBuildMetadata.commitSha,
    backendSha: typeof details.backendSha === 'string' ? details.backendSha : null,
    ...telegram,
    ...safeErrorDetails(details)
  }, initData).catch(() => undefined);
}

export function recordLunaStage(stage: string, details: Record<string, unknown>, initData?: string) {
  const now = new Date().toISOString();
  publish({
    lastLunaStage: stage,
    lastLunaAt: now,
    lastLunaIntent: typeof details.intent === 'string' ? details.intent : snapshot.lastLunaIntent,
    lastLunaMeditationId: typeof details.meditationId === 'string' ? details.meditationId : snapshot.lastLunaMeditationId
  });
  if (!initData) return;
  const allowed: ClientEventName[] = [
    'luna_message_sent', 'pending_state_loaded', 'pending_state_value', 'model_request_started',
    'model_result_received', 'resolved_intent', 'resolved_meditation_id', 'card_action_generated',
    'card_render_attempted', 'card_render_success', 'card_render_failed', 'duplicate_reply_blocked'
  ];
  if (!allowed.includes(stage as ClientEventName)) return;
  void sendClientEvent(stage as ClientEventName, {
    requestId: typeof details.requestId === 'string' ? details.requestId : null,
    frontendSha: frontendBuildMetadata.commitSha,
    backendSha: typeof details.backendSha === 'string' ? details.backendSha : null,
    ...telegramDetails(),
    ...safeErrorDetails(details)
  }, initData).catch(() => undefined);
}
