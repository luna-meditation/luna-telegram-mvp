import cors from 'cors';
import express from 'express';
import { requireTelegramWebApp, type AuthenticatedRequest } from './auth.js';
import { env } from './config.js';
import { bot, configureTelegramBot, createStarsInvoiceLink, sendStarsInvoice } from './bot.js';
import { getPractices, getProfileStats, getUserAccess, markPracticeComplete, upsertUser } from './db.js';
import { isPlanId } from './plans.js';

const app = express();

app.use(cors({ origin: env.FRONTEND_ORIGIN ?? true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'luna-backend' });
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

app.use(bot.webhookCallback('/telegram/webhook'));

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  void next;
  console.error(error);
  res.status(500).json({ error: 'Something went wrong.' });
});

app.listen(env.PORT, async () => {
  console.log(`Luna backend listening on ${env.PORT}`);
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
