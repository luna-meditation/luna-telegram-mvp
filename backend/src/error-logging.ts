import crypto from 'node:crypto';
import type { Request } from 'express';

export type RequestWithId = Request & {
  requestId?: string;
};

type ErrorContext = {
  req?: RequestWithId;
  endpoint?: string;
  requestId?: string | null;
  telegramId?: number | string | null;
  rpcName?: string;
  expectedParameterContract?: string;
  level?: 'error' | 'warn' | 'info';
  expected?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function errorMessage(error: unknown) {
  const record = asRecord(error);
  if (error instanceof Error && error.message) return error.message;
  if (typeof record?.message === 'string' && record.message) return record.message;
  return String(error);
}

function errorStack(error: unknown) {
  return error instanceof Error && error.stack
    ? error.stack
    : asRecord(error)?.stack ?? null;
}

function requestIdFrom(req?: RequestWithId) {
  if (req?.requestId) return req.requestId;
  const header = req?.headers['x-request-id'];
  return Array.isArray(header) ? header[0] ?? null : header ?? null;
}

function telegramIdFrom(req?: RequestWithId) {
  const authenticated = asRecord(req)?.telegramUser;
  const authenticatedTelegramId = asRecord(authenticated)?.telegram_id;
  if (typeof authenticatedTelegramId === 'number' || typeof authenticatedTelegramId === 'string') {
    return authenticatedTelegramId;
  }

  const bodyTelegramId = asRecord(req?.body)?.telegram_id;
  return typeof bodyTelegramId === 'number' || typeof bodyTelegramId === 'string' ? bodyTelegramId : null;
}

function supabaseErrorFrom(error: unknown) {
  const record = asRecord(error);
  const candidate = asRecord(record?.error) ?? record;
  const code = candidate?.code;
  const details = candidate?.details;
  const hint = candidate?.hint;
  if (typeof code !== 'string' && typeof details !== 'string' && typeof hint !== 'string') return null;
  return {
    code: typeof code === 'string' ? code : null,
    message: typeof candidate?.message === 'string' ? candidate.message : null,
    details: typeof details === 'string' ? details : null,
    hint: typeof hint === 'string' ? hint : null
  };
}

function openAiErrorFrom(error: unknown) {
  const record = asRecord(error);
  const response = asRecord(record?.response);
  const code = record?.code;
  const type = record?.type;
  const status = record?.status ?? response?.status;
  const requestId = record?.request_id ?? record?.requestId ?? response?.request_id;
  const name = record?.name;
  const isOpenAiError = typeof name === 'string' && name.toLowerCase().includes('openai')
    || typeof code === 'string' && (code.startsWith('openai_') || code.includes('quota'))
    || typeof requestId === 'string';
  if (!isOpenAiError && status === undefined && code === undefined && type === undefined) return null;
  return {
    name: typeof name === 'string' ? name : null,
    status: typeof status === 'number' || typeof status === 'string' ? status : null,
    code: typeof code === 'string' ? code : null,
    type: typeof type === 'string' ? type : null,
    requestId: typeof requestId === 'string' ? requestId : null,
    message: typeof record?.message === 'string' ? record.message : null
  };
}

export function logBackendError(error: unknown, context: ErrorContext = {}) {
  const req = context.req;
  const endpoint = context.endpoint ?? (req ? `${req.method} ${req.originalUrl || req.path}` : 'backend');
  const requestId = context.requestId ?? requestIdFrom(req) ?? `internal-${crypto.randomUUID()}`;
  const payload = {
    errorMessage: errorMessage(error),
    stack: errorStack(error),
    endpoint,
    requestId,
    telegramId: context.telegramId ?? telegramIdFrom(req),
    rpcName: context.rpcName ?? null,
    expectedParameterContract: context.expectedParameterContract ?? null,
    supabaseError: supabaseErrorFrom(error),
    openaiError: openAiErrorFrom(error),
    expected: context.expected ?? false,
    originalException: error
  };
  if (context.level === 'info') console.info('[Luna backend exception]', payload);
  else if (context.level === 'warn') console.warn('[Luna backend exception]', payload);
  else console.error('[Luna backend exception]', payload);
}
