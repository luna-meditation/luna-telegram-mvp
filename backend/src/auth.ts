import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from './config.js';
import type { TelegramUserInput } from './db.js';
import { logBackendError, type RequestWithId } from './error-logging.js';

export type AuthenticatedRequest = Request & {
  telegramUser: TelegramUserInput;
  /** Only from signed Telegram initData, never a body/query parameter. */
  telegramStartParam?: string;
};

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function validateTelegramSession(initData: string) {
  if (initData.length > 16384) throw new Error('Telegram WebApp auth data is too large.');
  const params = new URLSearchParams(initData);
  const keys = new Set<string>();
  for (const key of params.keys()) {
    if (keys.has(key)) throw new Error('Duplicate Telegram WebApp auth field.');
    keys.add(key);
  }
  const hash = params.get('hash');
  const userJson = params.get('user');
  const authDate = Number(params.get('auth_date'));

  if (!hash || !/^[0-9a-f]{64}$/i.test(hash) || !userJson || !Number.isSafeInteger(authDate) || authDate <= 0) {
    throw new Error('Missing Telegram WebApp auth data.');
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds < -60) throw new Error('Telegram WebApp auth date is in the future.');
  if (ageSeconds > env.TELEGRAM_AUTH_MAX_AGE_SECONDS) {
    throw new Error('Telegram WebApp auth data expired.');
  }

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (!safeCompare(calculatedHash, hash)) {
    throw new Error('Invalid Telegram WebApp signature.');
  }

  const user = JSON.parse(userJson) as {
    id?: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    language_code?: string;
  };

  if (!Number.isSafeInteger(user.id) || !user.id || user.id < 1) {
    throw new Error('Telegram WebApp user is missing.');
  }

  const telegramUser = {
    telegram_id: user.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    language_code: user.language_code
  } satisfies TelegramUserInput;
  const startParam=params.get('start_param');
  return {telegramUser,startParam:startParam&&/^[A-Za-z0-9_-]{1,512}$/.test(startParam)?startParam:undefined};
}

export function validateTelegramInitData(initData: string) {
  return validateTelegramSession(initData).telegramUser;
}

export function requireTelegramWebApp(req: Request, res: Response, next: NextFunction) {
  const initData = req.header('x-telegram-init-data');

  try {
    if (initData) {
      const verified = validateTelegramSession(initData);
      (req as AuthenticatedRequest).telegramUser = verified.telegramUser;
      (req as AuthenticatedRequest).telegramStartParam = verified.startParam;
      next();
      return;
    }

    if (env.ALLOW_UNVERIFIED_TELEGRAM_WEBAPP && process.env.NODE_ENV !== 'production') {
      const telegramId = Number(req.body?.telegram_id ?? req.params.telegramId);
      if (!telegramId) {
        res.status(401).json({ error: 'Telegram WebApp initData is required.' });
        return;
      }

      (req as AuthenticatedRequest).telegramUser = {
        telegram_id: telegramId,
        username: req.body?.username,
        first_name: req.body?.first_name,
        last_name: req.body?.last_name,
        language_code: req.body?.language_code
      };
      next();
      return;
    }

    res.status(401).json({ error: 'Telegram WebApp initData is required.' });
  } catch (error) {
    logBackendError(error, { req: req as RequestWithId, endpoint: 'Telegram WebApp authentication' });
    res.status(401).json({ error: error instanceof Error ? error.message : 'Invalid Telegram WebApp auth data.' });
  }
}
