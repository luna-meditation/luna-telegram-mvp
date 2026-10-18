import crypto from 'node:crypto';
import type {NextFunction, Request, Response} from 'express';
import type {TelegramUserInput} from './db.js';

/** Public QA writes cannot race the finite synthetic provider budget window. */
export const isFiniteAiMutation = (method: string, path: string) =>
  method === 'POST' && /^\/api\/(?:luna\/|luna43\/|tarot\/|astrology\/)/.test(path);

export type StagingConfig = {
  STAGING_MODE: boolean;
  STAGING_HOST?: 'standalone' | 'netlify';
  STAGING_SUPABASE_PROJECT_REF?: string;
  STAGING_ACCESS_PASSWORD?: string;
  STAGING_TELEGRAM_IDS?: string;
  SUPABASE_URL: string;
  DATABASE_URL?: string;
  MINI_APP_URL: string;
  RUN_MIGRATIONS: boolean;
  ALLOW_UNVERIFIED_TELEGRAM_WEBAPP: boolean;
  REMINDER_SCHEDULER_ENABLED: boolean;
  WEBHOOK_URL?: string;
};

// Never repurpose either existing shared/other-app project for staging.
const protectedProjects = ['vkcdtasbdoeilgfucoax', 'nwpkfjotvpdnlgrovctf'];

/** Do not copy Telegram names/contact handles into the isolated QA database. */
export function stagingUserRecord(user: TelegramUserInput, staging: boolean) {
  return staging ? {telegram_id:user.telegram_id,first_name:'Luna QA',last_name:null,username:null,
    language_code:user.language_code === 'ru' ? 'ru' : 'en'} : user;
}

export function stagingTelegramIds(value: string | undefined): Set<number> {
  const values = value?.split(',').map(id => id.trim()) ?? [];
  if (!values.length || values.some(id => !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))) {
    throw new Error('Staging requires an explicit list of QA Telegram user IDs.');
  }
  return new Set(values.map(Number));
}

export function assertStagingIsolation(config: StagingConfig) {
  if (config.STAGING_HOST === 'netlify' && !config.STAGING_MODE) {
    throw new Error('The Netlify adapter is restricted to isolated staging.');
  }
  if (!config.STAGING_MODE) return;
  const ref = config.STAGING_SUPABASE_PROJECT_REF;
  if (!ref || !/^[a-z]{20}$/.test(ref) || protectedProjects.includes(ref)) {
    throw new Error('Staging requires a separate, explicitly identified Supabase project.');
  }
  const url = new URL(config.SUPABASE_URL);
  if (url.origin !== `https://${ref}.supabase.co` || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('Staging Supabase URL must match the approved isolated project.');
  }
  if (config.DATABASE_URL) {
    // Runtime staging uses only the explicitly matched Supabase Data API.
    // Schema administration is a separate, reviewed step, never startup work.
    throw new Error('Staging runtime must not have a direct database connection.');
  }
  if (new URL(config.MINI_APP_URL).protocol !== 'https:') {
    throw new Error('The external staging Mini App URL must use HTTPS.');
  }
  if (config.STAGING_HOST === 'netlify' && config.MINI_APP_URL !== 'https://luna-staging-itfl.netlify.app') {
    throw new Error('The Netlify staging host must match the reviewed QA project.');
  }
  // Netlify serves the static shell without team login so Telegram can open it.
  // Server data remains behind signed Telegram auth plus the explicit QA allowlist.
  // Standalone staging still requires its own access password.
  if (config.STAGING_HOST !== 'netlify' && (!config.STAGING_ACCESS_PASSWORD || config.STAGING_ACCESS_PASSWORD.length < 20)) {
    throw new Error('Private staging requires a server-only access password of at least 20 characters.');
  }
  stagingTelegramIds(config.STAGING_TELEGRAM_IDS);
  if (config.RUN_MIGRATIONS || config.ALLOW_UNVERIFIED_TELEGRAM_WEBAPP || config.REMINDER_SCHEDULER_ENABLED || config.WEBHOOK_URL) {
    throw new Error('Staging forbids automatic migrations, unsigned users, reminders and bot webhooks.');
  }
}

export function privateStagingGate(password: string) {
  const expected = Buffer.from(`luna:${password}`);
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    const auth = req.header('authorization');
    const actual = /^Basic [A-Za-z0-9+/]+={0,2}$/.test(auth ?? '')
      ? Buffer.from(auth!.slice(6), 'base64') : Buffer.alloc(0);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Luna private staging", charset="UTF-8"');
      res.status(401).send('Private Luna staging.');
      return;
    }
    next();
  };
}

export function stagingQaOnly(allowed: Set<number>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = (req as Request & {telegramUser?: {telegram_id: number}}).telegramUser?.telegram_id;
    if (!id || !allowed.has(id)) {
      res.status(403).json({code:'staging_qa_only'});
      return;
    }
    next();
  };
}
