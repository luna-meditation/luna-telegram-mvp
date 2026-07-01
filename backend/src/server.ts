import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import { requireTelegramWebApp, validateTelegramInitData, type AuthenticatedRequest } from './auth.js';
import { env } from './config.js';
import { bot, configureTelegramBot, createStarsInvoiceLink, sendStarsInvoice } from './bot.js';
import {
  createMeditation,
  deleteCategory,
  deleteMeditation,
  getCategories,
  getFavorites,
  getHistory,
  getMeditationById,
  getMeditations,
  getPractices,
  getProfileStats,
  getUserAccess,
  markPracticeComplete,
  supabase,
  updateMeditation,
  upsertCategory,
  upsertFavorite,
  upsertHistory,
  upsertUser,
  type MeditationInput
} from './db.js';
import { runMigrations } from './migrations.js';
import { isPlanId } from './plans.js';

const app = express();

const configuredFrontendOrigins = env.FRONTEND_ORIGIN
  ? env.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

function isAllowedFrontendOrigin(origin: string) {
  if (configuredFrontendOrigins.includes(origin)) return true;

  try {
    const { hostname, protocol } = new URL(origin);
    return (
      protocol === 'https:' &&
      (hostname.endsWith('.netlify.app') || hostname.endsWith('.vercel.app'))
    );
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || !configuredFrontendOrigins.length || isAllowedFrontendOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  }
}));

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

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'luna-backend' });
});

app.get('/api/debug/admin', (req, res) => {
  const initData = req.header('x-telegram-init-data');
  const adminTelegramId = env.ADMIN_TELEGRAM_ID ?? null;

  if (!adminTelegramId) {
    res.json({
      telegramUserId: null,
      adminTelegramId,
      isAdmin: false,
      authenticationStatus: 'admin_env_missing',
      authenticationError: 'ADMIN_TELEGRAM_ID is missing.'
    });
    return;
  }

  if (!initData) {
    res.json({
      telegramUserId: null,
      adminTelegramId,
      isAdmin: false,
      authenticationStatus: 'missing_init_data',
      authenticationError: 'Telegram WebApp initData is missing.'
    });
    return;
  }

  try {
    const telegramUser = validateTelegramInitData(initData);
    const isAdmin = telegramUser.telegram_id === adminTelegramId;

    res.json({
      telegramUserId: telegramUser.telegram_id,
      adminTelegramId,
      isAdmin,
      authenticationStatus: isAdmin ? 'authenticated_admin' : 'authenticated_not_admin',
      authenticationError: isAdmin ? null : 'Authenticated Telegram user ID does not match ADMIN_TELEGRAM_ID.'
    });
  } catch (error) {
    res.json({
      telegramUserId: null,
      adminTelegramId,
      isAdmin: false,
      authenticationStatus: 'invalid_init_data',
      authenticationError: error instanceof Error ? error.message : 'Telegram WebApp initData is invalid.'
    });
  }
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

app.get('/api/profile/me', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json(await getProfileStats(authReq.telegramUser.telegram_id));
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

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  void next;
  console.error(error);
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
