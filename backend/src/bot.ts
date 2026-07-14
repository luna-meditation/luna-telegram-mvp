import { Context, Markup, Telegraf } from 'telegraf';
import { env } from './config.js';
import {
  getAdminStats,
  getUserAccess,
  recordSuccessfulPayment,
  upsertUser
} from './db.js';
import { isPlanId, plans, type PlanId } from './plans.js';
import { paymentEligibility } from './payment-policy.js';

export const bot = new Telegraf(env.BOT_TOKEN);

type BotLanguage = 'en' | 'ru';

function botLanguage(languageCode?: string): BotLanguage {
  return languageCode?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

const botCopy = {
  en: {
    openApp: 'Open Luna App',
    tryFreePractice: 'Try Free Practice',
    explorePremium: 'Explore Premium',
    welcome: 'Welcome to Luna 🌙\n\nYour premium AI meditation guide for deeper sleep, calmer thoughts, and emotional balance.\n\nBegin with a free practice or explore Luna Premium.'
  },
  ru: {
    openApp: 'Открыть Luna',
    tryFreePractice: 'Попробовать бесплатно',
    explorePremium: 'Luna Premium',
    welcome: 'Добро пожаловать в Luna 🌙\n\nТвой премиальный AI-гид по медитациям для глубокого сна, спокойствия и эмоционального баланса.\n\nНачни с бесплатной практики или открой Luna Premium.'
  }
} satisfies Record<BotLanguage, Record<string, string>>;

function miniAppButton(language: BotLanguage) {
  return Markup.button.webApp(botCopy[language].openApp, env.MINI_APP_URL);
}

function mainKeyboard(language: BotLanguage) {
  return Markup.inlineKeyboard([
    [miniAppButton(language)],
    [
      Markup.button.callback(botCopy[language].tryFreePractice, 'open_free'),
      Markup.button.callback(botCopy[language].explorePremium, 'plans')
    ]
  ]);
}

function plansKeyboard(language: BotLanguage, plan: string) {
  if (plan === 'Lifetime') return Markup.inlineKeyboard([[miniAppButton(language)]]);
  if (plan === 'Monthly') {
    return Markup.inlineKeyboard([
      [Markup.button.callback(`Lifetime - ${plans.lifetime.amountStars} Stars`, 'buy_lifetime')],
      [miniAppButton(language)]
    ]);
  }
  return Markup.inlineKeyboard([
    [Markup.button.callback(`Monthly - ${plans.monthly.amountStars} Stars`, 'buy_monthly')],
    [Markup.button.callback(`Lifetime - ${plans.lifetime.amountStars} Stars`, 'buy_lifetime')],
    [miniAppButton(language)]
  ]);
}

function plansMessage(language: BotLanguage, plan: string) {
  if (plan === 'Lifetime') return language === 'ru'
    ? 'Premium навсегда уже активен. Повторная покупка не нужна.'
    : 'Lifetime Premium is already active. No further purchase is needed.';
  if (plan === 'Monthly') return language === 'ru'
    ? `Месячный Premium активен. При желании можно перейти на Lifetime за ${plans.lifetime.amountStars} Stars.`
    : `Monthly Premium is active. You can upgrade to Lifetime for ${plans.lifetime.amountStars} Stars.`;
  return language === 'ru'
    ? `Выбери доступ Luna:\n\nМесяц: ${plans.monthly.amountStars} Stars на 30 дней\nНавсегда: ${plans.lifetime.amountStars} Stars`
    : `Choose your Luna access:\n\nMonthly: ${plans.monthly.amountStars} Stars for 30 days\nLifetime: ${plans.lifetime.amountStars} Stars`;
}

function invoicePayload(plan: PlanId, telegramId: number) {
  return JSON.stringify({ plan, telegramId, source: 'luna' });
}

async function ensureUser(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  await upsertUser({
    telegram_id: from.id,
    username: from.username,
    first_name: from.first_name,
    last_name: from.last_name,
    language_code: from.language_code
  });
}

export async function sendStarsInvoice(chatId: number, telegramId: number, planId: PlanId) {
  const plan = plans[planId];

  await bot.telegram.callApi('sendInvoice', {
    chat_id: chatId,
    title: `Luna ${plan.title}`,
    description:
      planId === 'monthly'
        ? 'Unlock Luna premium meditations and breathing practices for 30 days.'
        : 'Unlock Luna premium meditations and breathing practices forever.',
    payload: invoicePayload(planId, telegramId),
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: plan.title, amount: plan.amountStars }],
    start_parameter: `luna_${planId}`
  });
}

export async function createStarsInvoiceLink(telegramId: number, planId: PlanId) {
  const plan = plans[planId];

  return bot.telegram.createInvoiceLink({
    title: `Luna ${plan.title}`,
    description:
      planId === 'monthly'
        ? 'Unlock Luna premium meditations and breathing practices for 30 days.'
        : 'Unlock Luna premium meditations and breathing practices forever.',
    payload: invoicePayload(planId, telegramId),
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: plan.title, amount: plan.amountStars }]
  });
}

export async function configureTelegramBot() {
  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Start Luna' },
    { command: 'app', description: 'Open Luna App' },
    { command: 'plans', description: 'View premium plans' },
    { command: 'library', description: 'Open practice library' },
    { command: 'profile', description: 'View your Luna profile' },
    { command: 'help', description: 'Show Luna help' },
    { command: 'admin', description: 'Admin stats' }
  ]);
}

bot.start(async (ctx) => {
  await ensureUser(ctx);
  const language = botLanguage(ctx.from?.language_code);
  await ctx.reply(botCopy[language].welcome, mainKeyboard(language));
});

bot.command('app', async (ctx) => {
  await ensureUser(ctx);
  const language = botLanguage(ctx.from?.language_code);
  await ctx.reply(language === 'ru' ? 'Открой Luna, когда нужен мягкий момент спокойствия.' : 'Open Luna whenever you need a softer moment.', Markup.inlineKeyboard([[miniAppButton(language)]]));
});

bot.command('plans', async (ctx) => {
  await ensureUser(ctx);
  if (!ctx.from) return;
  const language = botLanguage(ctx.from.language_code);
  const access = await getUserAccess(ctx.from.id);
  await ctx.reply(plansMessage(language, access.plan), plansKeyboard(language, access.plan));
});

bot.command('library', async (ctx) => {
  await ensureUser(ctx);
  const language = botLanguage(ctx.from?.language_code);
  await ctx.reply(language === 'ru' ? 'Библиотека практик Luna внутри Mini App.' : 'Your Luna practice library is inside the Mini App.', Markup.inlineKeyboard([[miniAppButton(language)]]));
});

bot.command('profile', async (ctx) => {
  await ensureUser(ctx);
  if (!ctx.from) return;
  const access = await getUserAccess(ctx.from.id);
  await ctx.reply(
    `Luna Profile\n\nPlan: ${access.plan}\nActive until: ${access.user?.active_until ?? 'Not active'}\nLifetime access: ${
      access.user?.lifetime_access ? 'Yes' : 'No'
    }`,
    Markup.inlineKeyboard([[miniAppButton(botLanguage(ctx.from?.language_code))]])
  );
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    'Luna commands:\n/start - Start Luna\n/app - Open Mini App\n/plans - View access plans\n/library - Open practice library\n/profile - View your access\n/help - Show help'
  );
});

bot.command('admin', async (ctx) => {
  if (!env.ADMIN_TELEGRAM_ID || ctx.from?.id !== env.ADMIN_TELEGRAM_ID) {
    await ctx.reply('Admin access only.');
    return;
  }

  const [, subcommand] = ctx.message.text.split(' ');
  if (subcommand !== 'stats') {
    await ctx.reply('Use /admin stats');
    return;
  }

  const stats = await getAdminStats();
  await ctx.reply(
    `Luna Stats\n\nTotal users: ${stats.totalUsers}\nPaid users: ${stats.paidUsers}\nMonthly users: ${stats.monthlyUsers}\nLifetime users: ${stats.lifetimeUsers}\nTotal Stars earned: ${stats.totalStars}`
  );
});

bot.action('plans', async (ctx) => {
  await ctx.answerCbQuery();
  if (!ctx.from) return;
  await ensureUser(ctx);
  const language = botLanguage(ctx.from.language_code);
  const access = await getUserAccess(ctx.from.id);
  await ctx.reply(plansMessage(language, access.plan), plansKeyboard(language, access.plan));
});

bot.action('open_free', async (ctx) => {
  await ctx.answerCbQuery();
  const language = botLanguage(ctx.from?.language_code);
  await ctx.reply(language === 'ru' ? 'Бесплатная практика уже ждет внутри Luna.' : 'Your free practice is waiting inside Luna.', Markup.inlineKeyboard([[miniAppButton(language)]]));
});

bot.action(/^buy_(monthly|lifetime)$/, async (ctx) => {
  await ctx.answerCbQuery();
  if (!ctx.from || !ctx.chat) return;
  await ensureUser(ctx);
  const planId = ctx.match[1];
  if (!isPlanId(planId)) return;
  const access = await getUserAccess(ctx.from.id);
  if (!paymentEligibility(access.plan, planId).allowed) {
    const language = botLanguage(ctx.from.language_code);
    await ctx.reply(plansMessage(language, access.plan), plansKeyboard(language, access.plan));
    return;
  }
  await sendStarsInvoice(ctx.chat.id, ctx.from.id, planId);
});

bot.on('pre_checkout_query', async (ctx) => {
  const payload = ctx.preCheckoutQuery.invoice_payload;
  try {
    const parsed = JSON.parse(payload) as { plan?: unknown; telegramId?: unknown };
    if (!isPlanId(parsed.plan) || typeof parsed.telegramId !== 'number' || !ctx.from || parsed.telegramId !== ctx.from.id) {
      await ctx.answerPreCheckoutQuery(false, 'Invalid Luna payment payload.');
      return;
    }
    const access = await getUserAccess(ctx.from.id);
    if (!paymentEligibility(access.plan, parsed.plan).allowed) {
      await ctx.answerPreCheckoutQuery(false, access.plan === 'Lifetime' ? 'Lifetime Premium is already active.' : 'Monthly Premium is already active.');
      return;
    }
    await ctx.answerPreCheckoutQuery(true);
  } catch {
    await ctx.answerPreCheckoutQuery(false, 'Invalid Luna payment payload.');
  }
});

bot.on('successful_payment', async (ctx) => {
  if (!ctx.from) return;
  const payment = ctx.message.successful_payment;

  try {
    const payload = JSON.parse(payment.invoice_payload) as { plan?: unknown; telegramId?: unknown };

    if (!isPlanId(payload.plan) || typeof payload.telegramId !== 'number' || payload.telegramId !== ctx.from.id) {
      console.warn('[Luna payment rejected]', { telegramId: ctx.from.id, reason: 'invalid_payload' });
      return;
    }

    const result = await recordSuccessfulPayment({
      telegram_id: ctx.from.id,
      plan: payload.plan,
      telegram_payment_charge_id: payment.telegram_payment_charge_id,
      provider_payment_charge_id: payment.provider_payment_charge_id
    });

    const language = botLanguage(ctx.from.language_code);
    const firstName = ctx.from.first_name || (language === 'ru' ? 'друг' : 'friend');
    const planName = payload.plan === 'lifetime'
      ? (language === 'ru' ? 'Premium навсегда' : 'Lifetime Premium')
      : (language === 'ru' ? 'месячный Premium' : 'Monthly Premium');
    const confirmation = result.isNewPayment
      ? language === 'ru'
        ? `Добро пожаловать в Luna Premium, ${firstName} 🌙\n\nТеперь тебе доступны вся библиотека медитаций и расширенные разговоры с Luna.${result.seedsGranted ? '\n\nЯ также добавила 40 лунных семян в твой сад.' : ''}\n\nТвой план: ${planName}. Я рядом, когда понадобится тихая минута.`
        : `Welcome to Luna Premium, ${firstName} 🌙\n\nYour full meditation library is now open, and your Luna conversations have expanded.${result.seedsGranted ? '\n\nI also added 40 Moon Seeds to your garden.' : ''}\n\nYour plan: ${planName}. I’ll be here whenever you need a quiet moment.`
      : language === 'ru'
        ? 'Этот платёж уже подтверждён. Твой Premium-доступ активен.'
        : 'This payment is already confirmed. Your Premium access is active.';
    await ctx.reply(
      confirmation,
      Markup.inlineKeyboard([[Markup.button.webApp(language === 'ru' ? 'Открыть Luna' : 'Open Luna', env.MINI_APP_URL)]])
    );
  } catch (error) {
    console.error('[Luna payment processing failed]', {
      telegramId: ctx.from.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
