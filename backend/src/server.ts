import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import { requireTelegramWebApp, type AuthenticatedRequest } from './auth.js';
import { env } from './config.js';
import { bot, configureTelegramBot, createStarsInvoiceLink, sendStarsInvoice } from './bot.js';
import {
  createMeditation,
  deleteCategory,
  deleteMeditation,
  getAdminDashboard,
  getCategories,
  getFavorites,
  getHistory,
  getMeditationById,
  getMeditations,
  getPractices,
  getProfileStats,
  getTodayCheckin,
  getUserAccess,
  getWellnessSummary,
  markPracticeComplete,
  plantMoonGardenElement,
  recordBreathSession,
  recordSceneMoonSeed,
  supabase,
  updateMoonGardenDevState,
  updateUserLanguage,
  updateMeditation,
  updateAdminUserAccess,
  upsertCategory,
  upsertDailyCheckin,
  upsertFavorite,
  upsertHistory,
  upsertUser,
  type DailyCheckinInput,
  type MeditationInput
} from './db.js';
import { runMigrations } from './migrations.js';
import { isPlanId } from './plans.js';

const app = express();
app.disable('x-powered-by');

const configuredFrontendOrigins = env.FRONTEND_ORIGIN
  ? env.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];
const isProduction = process.env.NODE_ENV === 'production';
const miniAppOrigin = new URL(env.MINI_APP_URL).origin;

function isAllowedFrontendOrigin(origin: string) {
  if (origin === miniAppOrigin || configuredFrontendOrigins.includes(origin)) return true;

  try {
    const { hostname, protocol } = new URL(origin);
    return (
      !isProduction &&
      protocol === 'https:' &&
      (hostname.endsWith('.netlify.app') || hostname.endsWith('.vercel.app'))
    );
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedFrontendOrigin(origin)) {
      callback(null, true);
      return;
    }

    if (!isProduction && !configuredFrontendOrigins.length) {
      callback(null, true);
      return;
    }

    callback(null, false);
  }
}));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(options: { windowMs: number; max: number }) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    const key = `${req.ip}:${req.method}:${req.path}`;
    const current = rateLimitBuckets.get(key);

    if (!current || current.resetAt <= now) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (current.count >= options.max) {
      res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
      return;
    }

    current.count += 1;
    next();
  };
}

function assertAdmin(req: express.Request, res: express.Response) {
  const authReq = req as AuthenticatedRequest;

  if (!env.ADMIN_TELEGRAM_ID || authReq.telegramUser.telegram_id !== env.ADMIN_TELEGRAM_ID) {
    res.status(403).json({ error: 'Admin access only.' });
    return false;
  }

  return true;
}

function isMp3Upload(contentType: string, fileName: string) {
  return ['audio/mpeg', 'audio/mp3'].includes(contentType) && /\.mp3$/i.test(fileName);
}

function isCoverUpload(contentType: string, fileName: string) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(contentType) && /\.(jpe?g|png|webp)$/i.test(fileName);
}

app.use('/api/admin', rateLimit({ windowMs: 60_000, max: 120 }));
app.use('/api/payments', rateLimit({ windowMs: 60_000, max: 30 }));

app.post(
  '/api/admin/storage/:kind',
  requireTelegramWebApp,
  express.raw({ type: ['audio/mpeg', 'audio/mp3', 'image/jpeg', 'image/png', 'image/webp'], limit: '100mb' }),
  async (req, res, next) => {
    try {
      if (!assertAdmin(req, res)) return;

      const kind = req.params.kind;
      const contentType = req.header('content-type') ?? '';
      const originalName = req.header('x-file-name') ?? `${kind}-${Date.now()}`;
      const extension = originalName.split('.').pop() || (contentType.startsWith('audio/') ? 'mp3' : 'webp');

      if (kind !== 'audio' && kind !== 'cover') {
        res.status(400).json({ error: 'Storage kind must be audio or cover.' });
        return;
      }

      if (kind === 'audio' && !isMp3Upload(contentType, originalName)) {
        res.status(400).json({ error: 'Please upload an MP3 audio file.' });
        return;
      }

      if (kind === 'cover' && !isCoverUpload(contentType, originalName)) {
        res.status(400).json({ error: 'Please upload a JPG, PNG, or WebP cover image.' });
        return;
      }

      const storagePath = `${kind}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage
        .from('meditations')
        .upload(storagePath, req.body, { contentType, upsert: false });

      if (error) throw error;

      const { data } = supabase.storage.from('meditations').getPublicUrl(storagePath);
      res.json({ path: storagePath, publicUrl: data.publicUrl });
    } catch (error) {
      next(error);
    }
  }
);

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'luna-backend' });
});

app.get('/api/debug/admin', requireTelegramWebApp, (req, res) => {
  if (!assertAdmin(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  const adminTelegramId = env.ADMIN_TELEGRAM_ID ?? null;

  res.json({
    telegramUserId: authReq.telegramUser.telegram_id,
    adminTelegramId,
    isAdmin: true,
    authenticationStatus: 'authenticated_admin',
    authenticationError: null
  });
});

app.post('/api/users/sync', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await upsertUser(authReq.telegramUser);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

app.get('/api/access/me', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const access = await getUserAccess(authReq.telegramUser.telegram_id);
    res.json(access);
  } catch (error) {
    next(error);
  }
});

app.get('/api/practices', async (_req, res, next) => {
  try {
    res.json({ practices: await getPractices() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/categories', async (_req, res, next) => {
  try {
    res.json({ categories: await getCategories() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/meditations', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json({ meditations: await getMeditations(authReq.telegramUser.telegram_id) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/favorites', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json({ favorites: await getFavorites(authReq.telegramUser.telegram_id) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/favorites/:meditationId', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json(await upsertFavorite(authReq.telegramUser.telegram_id, req.params.meditationId, Boolean(req.body.favorite)));
  } catch (error) {
    next(error);
  }
});

app.get('/api/history', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json({ history: await getHistory(authReq.telegramUser.telegram_id) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/history', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json(await upsertHistory(authReq.telegramUser.telegram_id, req.body));
  } catch (error) {
    next(error);
  }
});

app.post('/api/breath-sessions', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json(await recordBreathSession(authReq.telegramUser.telegram_id, req.body));
  } catch (error) {
    console.error('[Luna breath session save failed]', {
      telegramId: (req as Partial<AuthenticatedRequest>).telegramUser?.telegram_id ?? null,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
});

app.post('/api/scene-sessions/moon-seed', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json(await recordSceneMoonSeed(authReq.telegramUser.telegram_id, req.body));
  } catch (error) {
    next(error);
  }
});

app.post('/api/payments/invoice', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { chatId, plan } = req.body as {
      chatId?: number;
      plan?: unknown;
    };

    if (!chatId || !isPlanId(plan)) {
      res.status(400).json({ error: 'chatId and valid plan are required.' });
      return;
    }

    await sendStarsInvoice(chatId, authReq.telegramUser.telegram_id, plan);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/payments/invoice-link', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { plan } = req.body as { plan?: unknown };

    if (!isPlanId(plan)) {
      res.status(400).json({ error: 'A valid plan is required.' });
      return;
    }

    const invoiceLink = await createStarsInvoiceLink(authReq.telegramUser.telegram_id, plan);
    res.json({ invoiceLink });
  } catch (error) {
    next(error);
  }
});

app.post('/api/progress', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    await markPracticeComplete({
      telegram_id: authReq.telegramUser.telegram_id,
      practice_id: req.body.practice_id,
      mood_before: req.body.mood_before,
      mood_after: req.body.mood_after
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/checkins/today', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json({ checkin: await getTodayCheckin(authReq.telegramUser.telegram_id) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/checkins', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const input = req.body as DailyCheckinInput;

    if (
      !['less_than_4', '4_6', '6_8', '8_plus'].includes(input.sleep_range) ||
      !['calm', 'stressed', 'tired', 'anxious', 'focused', 'low_energy'].includes(input.mood) ||
      !['3', '5', '10', '15_plus'].includes(input.available_minutes)
    ) {
      console.warn('[Luna check-in validation failed]', { telegramId: authReq.telegramUser.telegram_id });
      res.status(400).json({ error: 'Please complete the daily check-in.' });
      return;
    }

    await upsertUser(authReq.telegramUser);
    res.json({ checkin: await upsertDailyCheckin(authReq.telegramUser.telegram_id, input) });
  } catch (error) {
    console.error('[Luna check-in save failed]', {
      telegramId: (req as Partial<AuthenticatedRequest>).telegramUser?.telegram_id ?? null,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
});

app.get('/api/wellness/summary', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json(await getWellnessSummary(authReq.telegramUser.telegram_id));
  } catch (error) {
    next(error);
  }
});

app.get('/api/profile/me', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json(await getProfileStats(authReq.telegramUser.telegram_id));
  } catch (error) {
    next(error);
  }
});

app.post('/api/moon-garden/plant', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const result = await plantMoonGardenElement(authReq.telegramUser.telegram_id, String(req.body?.elementId ?? ''));
    if ('error' in result) {
      res.status(result.status ?? 400).json(result);
      return;
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/moon-garden/dev', requireTelegramWebApp, async (req, res, next) => {
  try {
    if (!assertAdmin(req, res)) return;
    const authReq = req as AuthenticatedRequest;
    const result = await updateMoonGardenDevState(authReq.telegramUser.telegram_id, {
      action: String(req.body?.action ?? ''),
      seedBalance: req.body?.seedBalance,
      amount: req.body?.amount,
      stageLevel: req.body?.stageLevel
    });
    if ('error' in result) {
      res.status(result.status ?? 400).json(result);
      return;
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/profile/language', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const language = req.body?.language;

    if (language !== 'en' && language !== 'ru') {
      res.status(400).json({ error: 'Language must be en or ru.' });
      return;
    }

    res.json({ user: await updateUserLanguage(authReq.telegramUser.telegram_id, language) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/meditations', requireTelegramWebApp, async (req, res, next) => {
  try {
    if (!assertAdmin(req, res)) return;
    res.json({ meditations: await getMeditations(undefined, true) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/me', requireTelegramWebApp, async (req, res, next) => {
  try {
    if (!assertAdmin(req, res)) return;
    res.json({ admin: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/dashboard', requireTelegramWebApp, async (req, res, next) => {
  try {
    if (!assertAdmin(req, res)) return;
    res.json(await getAdminDashboard());
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/users/:telegramId/access', requireTelegramWebApp, async (req, res, next) => {
  try {
    if (!assertAdmin(req, res)) return;

    const telegramId = Number(req.params.telegramId);
    const action = req.body?.action as 'grant_monthly' | 'grant_lifetime' | 'extend_monthly' | 'remove_premium' | undefined;

    if (!Number.isFinite(telegramId)) {
      res.status(400).json({ error: 'Valid Telegram user ID is required.' });
      return;
    }

    if (!action || !['grant_monthly', 'grant_lifetime', 'extend_monthly', 'remove_premium'].includes(action)) {
      res.status(400).json({ error: 'Valid premium action is required.' });
      return;
    }

    res.json({ user: await updateAdminUserAccess(telegramId, action) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/meditations', requireTelegramWebApp, async (req, res, next) => {
  try {
    if (!assertAdmin(req, res)) return;
    res.json({ meditation: await createMeditation(req.body as MeditationInput) });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/admin/meditations/:id', requireTelegramWebApp, async (req, res, next) => {
  try {
    if (!assertAdmin(req, res)) return;
    res.json({ meditation: await updateMeditation(req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/meditations/:id', requireTelegramWebApp, async (req, res, next) => {
  try {
    if (!assertAdmin(req, res)) return;
    const meditation = await getMeditationById(req.params.id);
    await deleteMeditation(req.params.id);
    res.json({ ok: true, meditation });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/categories', requireTelegramWebApp, async (req, res, next) => {
  try {
    if (!assertAdmin(req, res)) return;
    res.json({ category: await upsertCategory(req.body) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/categories/:slug', requireTelegramWebApp, async (req, res, next) => {
  try {
    if (!assertAdmin(req, res)) return;
    await deleteCategory(req.params.slug);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use(bot.webhookCallback('/telegram/webhook'));

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  void next;
  console.error('[Luna API error]', {
    method: req.method,
    path: req.path,
    error: error instanceof Error ? error.message : 'Unknown error'
  });
  res.status(500).json({ error: 'Something went wrong.' });
});

app.listen(env.PORT, async () => {
  console.log(`Luna backend listening on ${env.PORT}`);
  await runMigrations();
  await configureTelegramBot();

  if (env.WEBHOOK_URL) {
    await bot.telegram.setWebhook(`${env.WEBHOOK_URL}/telegram/webhook`, {
      allowed_updates: ['message', 'callback_query', 'pre_checkout_query']
    });
    console.log('Telegram webhook configured.');
  } else {
    await bot.launch();
    console.log('Telegram bot launched with polling.');
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
