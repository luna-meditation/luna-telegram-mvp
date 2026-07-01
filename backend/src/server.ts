import cors from 'cors';
import express from 'express';
import { env } from './config.js';
import { bot, sendStarsInvoice } from './bot.js';
import { getPractices, getProfileStats, getUserAccess, markPracticeComplete, upsertUser } from './db.js';
import { isPlanId } from './plans.js';

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'luna-backend' });
});

app.post('/api/users/sync', async (req, res, next) => {
  try {
    const user = await upsertUser(req.body);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

app.get('/api/access/:telegramId', async (req, res, next) => {
  try {
    const access = await getUserAccess(Number(req.params.telegramId));
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

app.post('/api/payments/invoice', async (req, res, next) => {
  try {
    const { chatId, telegramId, plan } = req.body as {
      chatId?: number;
      telegramId?: number;
      plan?: unknown;
    };

    if (!chatId || !telegramId || !isPlanId(plan)) {
      res.status(400).json({ error: 'chatId, telegramId, and valid plan are required.' });
      return;
    }

    await sendStarsInvoice(chatId, telegramId, plan);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/progress', async (req, res, next) => {
  try {
    await markPracticeComplete(req.body);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/profile/:telegramId', async (req, res, next) => {
  try {
    res.json(await getProfileStats(Number(req.params.telegramId)));
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
