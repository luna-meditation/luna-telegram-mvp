import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import { ZodError } from 'zod';
import { requireTelegramWebApp, type AuthenticatedRequest } from './auth.js';
import { env } from './config.js';
import { bot, configureTelegramBot, createStarsInvoiceLink, sendStarsInvoice } from './bot.js';
import {
  createMeditation,
  createSupportRequest,
  deleteCategory,
  deleteMeditation,
  getAdminDashboard,
  getAdminSupportRequests,
  getCategories,
  getFavorites,
  getHistory,
  getMeditationById,
  getMeditations,
  getPractices,
  getRecentSuccessfulPayments,
  getProfileStats,
  getTodayCheckin,
  getUserAccess,
  getWellnessSummary,
  markPracticeComplete,
  plantMoonGardenElement,
  recordBreathSession,
  recordSceneMoonSeed,
  startPlaybackSession,
  heartbeatPlaybackSession,
  supabase,
  updateMoonGardenDevState,
  updateUserAvatar,
  updateUserGoals,
  updateUserLanguage,
  updateUserNotificationPreferences,
  updateMeditation,
  updateAdminUserAccess,
  updateSupportRequestStatus,
  upsertCategory,
  upsertDailyCheckin,
  upsertFavorite,
  upsertHistory,
  upsertUser,
  type DailyCheckinInput,
  type MeditationInput
} from './db.js';
import { runMigrations } from './migrations.js';
import { isPlanId, isValidTelegramInvoiceUrl, plans } from './plans.js';
import { paymentEligibility } from './payment-policy.js';
import { logBackendError, type RequestWithId } from './error-logging.js';
import { PlaybackInputError } from './playback-security.js';
import { getBackendVersion } from './version.js';
import {
  clearLunaConversations,
  deleteLunaConversation,
  deleteLunaMemory,
  getLunaConversation,
  getLunaMemory,
  listLunaConversations,
  LunaAiError,
  sendLunaMessage,
  getLunaProviderHealth,
  setLunaMemoryEnabled
} from './luna-ai.js';
import { startReminderScheduler } from './reminders.js';
import { supportRequestInputSchema, supportStatusInputSchema } from './support-policy.js';

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
  } catch (error) {
    logBackendError(error, { endpoint: 'CORS origin validation' });
    return false;
  }
}

app.use((req, res, next) => {
  const incomingRequestId = req.header('x-request-id');
  const requestId = incomingRequestId && /^[A-Za-z0-9._:-]{1,128}$/.test(incomingRequestId)
    ? incomingRequestId
    : crypto.randomUUID();
  (req as RequestWithId).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

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

function isAvatarUpload(contentType: string, fileName: string) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(contentType) && /\.(jpe?g|png|webp)$/i.test(fileName);
}

function storagePathFromPublicUrl(publicUrl?: string | null, bucket = 'avatars') {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(publicUrl.slice(index + marker.length));
}

app.use('/api/admin', rateLimit({ windowMs: 60_000, max: 120 }));
app.use('/api/payments', rateLimit({ windowMs: 60_000, max: 30 }));
app.use('/api/luna', rateLimit({ windowMs: 60_000, max: 30 }));
app.use('/api/client-events', rateLimit({ windowMs: 60_000, max: 120 }));
app.use('/api/support', rateLimit({ windowMs: 60_000, max: 8 }));

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

app.post(
  '/api/profile/avatar',
  requireTelegramWebApp,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '2mb' }),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const contentType = req.header('content-type') ?? '';
      const originalName = req.header('x-file-name') ?? 'avatar.webp';

      if (!isAvatarUpload(contentType, originalName)) {
        res.status(400).json({ error: 'Please upload a JPEG, PNG, or WebP image.' });
        return;
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: 'Avatar image is empty.' });
        return;
      }

      const extension = contentType === 'image/png' ? 'png' : contentType === 'image/jpeg' ? 'jpg' : 'webp';
      const storagePath = `${authReq.telegramUser.telegram_id}/${crypto.randomUUID()}.${extension}`;
      const currentProfile = await getProfileStats(authReq.telegramUser.telegram_id);
      const previousPath = storagePathFromPublicUrl(currentProfile.user?.avatar_url);

      const { error } = await supabase.storage
        .from('avatars')
        .upload(storagePath, req.body, { contentType, upsert: false });

      if (error) throw error;

      const { data } = supabase.storage.from('avatars').getPublicUrl(storagePath);
      const user = await updateUserAvatar(authReq.telegramUser.telegram_id, data.publicUrl);

      if (previousPath && previousPath !== storagePath) {
        await supabase.storage.from('avatars').remove([previousPath]).catch((error) => {
          logBackendError(error, { req: req as RequestWithId, endpoint: 'POST /api/profile/avatar cleanup' });
          return undefined;
        });
      }

      res.json({ avatarUrl: data.publicUrl, user });
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

app.get('/api/version', requireTelegramWebApp, (req, res) => {
  if (!assertAdmin(req, res)) return;
  res.json(getBackendVersion());
});

const clientEventNames = new Set([
  'payment_button_clicked', 'invoice_request_started', 'invoice_response_received', 'invoice_url_validated',
  'open_invoice_available', 'open_invoice_called', 'open_invoice_callback', 'open_invoice_exception',
  'payment_timeout', 'payment_failed', 'entitlement_refresh_started', 'entitlement_refresh_completed',
  'luna_message_sent', 'pending_state_loaded', 'pending_state_value', 'model_request_started',
  'model_result_received', 'resolved_intent', 'resolved_meditation_id', 'card_action_generated',
  'card_render_attempted', 'card_render_success', 'card_render_failed', 'duplicate_reply_blocked'
]);

function safeClientUrlHost(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).host || null;
  } catch {
    return null;
  }
}

app.post('/api/client-events', requireTelegramWebApp, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const event = typeof body.event === 'string' ? body.event.slice(0, 80) : '';

  if (!clientEventNames.has(event)) {
    res.status(400).json({ error: 'Unsupported client event.' });
    return;
  }

  const errorName = typeof body.errorName === 'string' ? body.errorName.slice(0, 120) : null;
  const errorMessage = typeof body.errorMessage === 'string' ? body.errorMessage.slice(0, 500) : null;
  const payload = {
    event,
    requestId: typeof body.requestId === 'string' ? body.requestId.slice(0, 128) : null,
    telegramId: authReq.telegramUser.telegram_id,
    plan: body.plan === 'monthly' || body.plan === 'lifetime' ? body.plan : null,
    frontendSha: typeof body.frontendSha === 'string' ? body.frontendSha.slice(0, 160) : 'unknown',
    backendSha: getBackendVersion().commitSha,
    platform: typeof body.platform === 'string' ? body.platform.slice(0, 40) : null,
    webAppVersion: typeof body.webAppVersion === 'string' ? body.webAppVersion.slice(0, 40) : null,
    urlHost: safeClientUrlHost(body.urlHost),
    hasTelegramWebApp: body.hasTelegramWebApp === true,
    hasOpenInvoice: body.hasOpenInvoice === true,
    callbackStatus: typeof body.callbackStatus === 'string' ? body.callbackStatus.slice(0, 40) : null,
    invoiceHost: safeClientUrlHost(body.invoiceHost),
    intent: typeof body.intent === 'string' ? body.intent.slice(0, 80) : null,
    meditationId: typeof body.meditationId === 'string' ? body.meditationId.slice(0, 120) : null,
    pendingIntent: typeof body.pendingIntent === 'string' ? body.pendingIntent.slice(0, 80) : null,
    pendingMeditationId: typeof body.pendingMeditationId === 'string' ? body.pendingMeditationId.slice(0, 120) : null,
    pendingAction: typeof body.pendingAction === 'string' ? body.pendingAction.slice(0, 80) : null,
    pendingStatePresent: body.pendingStatePresent === true,
    hasAssistantMessage: body.hasAssistantMessage === true,
    reason: typeof body.reason === 'string' ? body.reason.slice(0, 180) : null,
    errorName,
    errorMessage,
    serverRequestId: (req as RequestWithId).requestId ?? null
  };

  console.info('[Luna client telemetry]', payload);
  res.status(202).json({ ok: true });
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

app.get('/api/plans', (_req, res) => {
  res.json({ plans });
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
    const timezone = typeof req.query.timezone === 'string' ? req.query.timezone.slice(0, 64) : undefined;
    res.json({ meditations: await getMeditations(authReq.telegramUser.telegram_id, false, timezone) });
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

app.post('/api/history/session', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json(await startPlaybackSession(
      authReq.telegramUser.telegram_id,
      String(req.body.meditation_id ?? ''),
      String(req.body.local_date ?? '')
    ));
  } catch (error) {
    next(error);
  }
});

app.post('/api/history/session/heartbeat', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json(await heartbeatPlaybackSession(
      authReq.telegramUser.telegram_id,
      String(req.body.session_id ?? ''),
      req.body?.last_position
    ));
  } catch (error) {
    next(error);
  }
});

app.post('/api/breath-sessions', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json(await recordBreathSession(authReq.telegramUser.telegram_id, req.body));
  } catch (error) {
    logBackendError(error, { req: req as RequestWithId, endpoint: 'POST /api/breath-sessions' });
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
    const requestId = (req as RequestWithId).requestId;
    const { chatId, plan } = req.body as {
      chatId?: number;
      plan?: unknown;
    };

    if (!chatId || !isPlanId(plan)) {
      res.status(400).json({ error: 'chatId and valid plan are required.' });
      return;
    }

    const access = await getUserAccess(authReq.telegramUser.telegram_id);
    if (!paymentEligibility(access.plan, plan).allowed) {
      res.status(409).json({ error: access.plan === 'Lifetime' ? 'Lifetime Premium is already active.' : 'Monthly Premium is already active.', code: 'plan_already_active' });
      return;
    }
    await sendStarsInvoice(chatId, authReq.telegramUser.telegram_id, plan, requestId);
    res.json({ ok: true, requestId, plan, amountStars: plan === 'monthly' ? 499 : 2499 });
  } catch (error) {
    logBackendError(error, {
      req: req as RequestWithId,
      endpoint: 'POST /api/payments/invoice',
      telegramId: (req as AuthenticatedRequest).telegramUser?.telegram_id,
      plan: typeof req.body?.plan === 'string' ? req.body.plan : null,
      stage: 'invoice_endpoint',
      level: 'error'
    });
    next(error);
  }
});

app.post('/api/payments/invoice-link', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const requestId = (req as RequestWithId).requestId;
    const { plan } = req.body as { plan?: unknown };

    if (!isPlanId(plan)) {
      res.status(400).json({ error: 'A valid plan is required.' });
      return;
    }

    const access = await getUserAccess(authReq.telegramUser.telegram_id);
    if (!paymentEligibility(access.plan, plan).allowed) {
      res.status(409).json({ error: access.plan === 'Lifetime' ? 'Lifetime Premium is already active.' : 'Monthly Premium is already active.', code: 'plan_already_active' });
      return;
    }
    const invoiceLink = await createStarsInvoiceLink(authReq.telegramUser.telegram_id, plan, requestId);
    if (!isValidTelegramInvoiceUrl(invoiceLink)) {
      const error = new Error('Telegram invoice link failed server validation.');
      logBackendError(error, {
        req: req as RequestWithId,
        endpoint: 'POST /api/payments/invoice-link response validation',
        telegramId: authReq.telegramUser.telegram_id,
        level: 'error'
      });
      res.status(502).json({ error: 'Telegram returned an invalid invoice link.', code: 'invalid_invoice_link', requestId });
      return;
    }
    console.info('[Luna invoice link created]', {
      user: crypto.createHash('sha256').update(String(authReq.telegramUser.telegram_id)).digest('hex').slice(0, 12),
      plan,
      amountStars: plan === 'monthly' ? 499 : 2499,
      requestId,
      invoiceHost: new URL(invoiceLink).hostname
    });
    res.json({ invoiceLink, requestId, plan, amountStars: plan === 'monthly' ? 499 : 2499 });
  } catch (error) {
    logBackendError(error, {
      req: req as RequestWithId,
      endpoint: 'POST /api/payments/invoice-link',
      telegramId: (req as AuthenticatedRequest).telegramUser?.telegram_id,
      plan: typeof req.body?.plan === 'string' ? req.body.plan : null,
      stage: 'invoice_link_endpoint',
      level: 'error'
    });
    next(error);
  }
});

app.get('/api/payments/recent', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json({ payments: await getRecentSuccessfulPayments(authReq.telegramUser.telegram_id) });
  } catch (error) {
    logBackendError(error, {
      req: req as RequestWithId,
      endpoint: 'GET /api/payments/recent',
      telegramId: (req as AuthenticatedRequest).telegramUser?.telegram_id,
      level: 'error'
    });
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
    res.json({ checkin: await getTodayCheckin(authReq.telegramUser.telegram_id, String(req.query.local_date ?? '')) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/checkins', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const input = req.body as DailyCheckinInput;

    if (
      !['calm', 'stressed', 'tired', 'anxious', 'focused', 'low_energy'].includes(input.mood) ||
      (input.sleep_range != null && !['less_than_4', '4_6', '6_8', '8_plus'].includes(input.sleep_range)) ||
      (input.available_minutes != null && !['3', '5', '10', '15_plus'].includes(input.available_minutes))
    ) {
      console.warn('[Luna check-in validation failed]', { telegramId: authReq.telegramUser.telegram_id });
      res.status(400).json({ error: 'Please complete the daily check-in.' });
      return;
    }

    await upsertUser(authReq.telegramUser);
    res.json({ checkin: await upsertDailyCheckin(authReq.telegramUser.telegram_id, input) });
  } catch (error) {
    logBackendError(error, { req: req as RequestWithId, endpoint: 'POST /api/checkins' });
    next(error);
  }
});

app.get('/api/wellness/summary', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json(await getWellnessSummary(authReq.telegramUser.telegram_id, String(req.query.local_date ?? '')));
  } catch (error) {
    next(error);
  }
});

app.get('/api/profile/me', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json(await getProfileStats(authReq.telegramUser.telegram_id, String(req.query.local_date ?? '')));
  } catch (error) {
    next(error);
  }
});

app.get('/api/luna/conversations', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json({ conversations: await listLunaConversations(authReq.telegramUser.telegram_id) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/luna/health', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json(await getLunaProviderHealth({
      requestId: (req as RequestWithId).requestId,
      telegramId: authReq.telegramUser.telegram_id
    }));
  } catch (error) {
    next(error);
  }
});

app.get('/api/luna/conversations/:id', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json(await getLunaConversation(authReq.telegramUser.telegram_id, req.params.id));
  } catch (error) {
    next(error);
  }
});

app.post('/api/luna/chat', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json(await sendLunaMessage(authReq.telegramUser, req.body));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/luna/conversations/:id', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    await deleteLunaConversation(authReq.telegramUser.telegram_id, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/luna/conversations', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    await clearLunaConversations(authReq.telegramUser.telegram_id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/luna/memory', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json(await getLunaMemory(authReq.telegramUser.telegram_id));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/luna/memory', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    await setLunaMemoryEnabled(authReq.telegramUser.telegram_id, Boolean(req.body?.enabled));
    res.json({ ok: true, enabled: Boolean(req.body?.enabled) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/luna/memory/:id', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    await deleteLunaMemory(authReq.telegramUser.telegram_id, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/luna/memory', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    await deleteLunaMemory(authReq.telegramUser.telegram_id);
    res.json({ ok: true });
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

app.post('/api/profile/goals', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json({ user: await updateUserGoals(authReq.telegramUser.telegram_id, req.body?.goals) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/profile/notifications', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    res.json({
      user: await updateUserNotificationPreferences(authReq.telegramUser.telegram_id, {
        remindersEnabled: Boolean(req.body?.remindersEnabled ?? req.body?.dailyReminder),
        reminderTypes: req.body?.reminderTypes,
        newContent: Boolean(req.body?.newContent),
        reminderTime: req.body?.reminderTime,
        timezone: req.body?.timezone,
        dailyReminder: Boolean(req.body?.remindersEnabled ?? req.body?.dailyReminder)
      })
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/support', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const input = supportRequestInputSchema.parse(req.body);
    res.status(201).json({ request: await createSupportRequest(authReq.telegramUser.telegram_id, input) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/profile/avatar', requireTelegramWebApp, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const currentProfile = await getProfileStats(authReq.telegramUser.telegram_id);
    const previousPath = storagePathFromPublicUrl(currentProfile.user?.avatar_url);
    const user = await updateUserAvatar(authReq.telegramUser.telegram_id, null);

    if (previousPath) {
      await supabase.storage.from('avatars').remove([previousPath]).catch((error) => {
        logBackendError(error, { req: req as RequestWithId, endpoint: 'DELETE /api/profile/avatar cleanup' });
        return undefined;
      });
    }

    res.json({ user });
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

app.get('/api/admin/support', requireTelegramWebApp, async (req, res, next) => {
  try {
    if (!assertAdmin(req, res)) return;
    res.json({ requests: await getAdminSupportRequests() });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/admin/support/:id', requireTelegramWebApp, async (req, res, next) => {
  try {
    if (!assertAdmin(req, res)) return;
    const { status } = supportStatusInputSchema.parse(req.body);
    res.json({ request: await updateSupportRequestStatus(req.params.id, status) });
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
  logBackendError(error, { req: req as RequestWithId });
  if (error instanceof LunaAiError) {
    res.status(error.status).json({
      error: error.message,
      code: error.code,
      requestState: error.requestState,
      retryable: error.retryable,
      resetAt: error.resetAt
    });
    return;
  }
  if (error instanceof PlaybackInputError) {
    res.status(400).json({ error: error.message, code: error.code });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Invalid request.', code: 'invalid_request' });
    return;
  }
  res.status(500).json({ error: 'Something went wrong.', code: 'internal_error' });
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

  startReminderScheduler();
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
