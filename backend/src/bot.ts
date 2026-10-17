import { Context, Markup, Telegraf } from 'telegraf';
import { env } from './config.js';
import {
  getAdminStats,
  getUserAccess,
  recordSuccessfulPayment,
  upsertUser
} from './db.js';
import {
  isPaymentPayloadPlanId,
  isPlanId,
  isValidTelegramInvoiceUrl,
  plans,
  type PlanId
} from './plans.js';
import { paymentEligibility,validExistingPlanPayment } from './payment-policy.js';
import { logBackendError } from './error-logging.js';
import {validateLuna21Precheckout,fulfillLuna21Payment} from './luna21-commerce.js';
import {attributeValidatedReferral} from './luna30-referrals.js';
import {createLuna30Commerce} from './luna30-commerce.js';
import {supabase} from './db.js';
import {FoundationError} from './foundation-error.js';
import {botLanguage,luna35BotCopy,welcomeKeyboard,botCommands,miniAppLink} from './luna35-bot-policy.js';
import {recordFunnel} from './luna35-funnel.js';

export const bot = new Telegraf(env.BOT_TOKEN);
const luna30Commerce=createLuna30Commerce(supabase,env,input=>bot.telegram.callApi('createInvoiceLink',input));

type BotLanguage = 'en' | 'ru';

const botCopy = {
  en: {
    openApp: 'Open Luna App',
    tryFreePractice: 'Try Free Practice',
    explorePremium: 'Explore Premium',
    welcome: luna35BotCopy.en.welcome
  },
  ru: {
    openApp: 'Открыть Luna',
    tryFreePractice: 'Попробовать бесплатно',
    explorePremium: 'Luna Premium',
    welcome: luna35BotCopy.ru.welcome
  }
} satisfies Record<BotLanguage, Record<string, string>>;

function miniAppButton(language: BotLanguage) {
  return Markup.button.webApp(botCopy[language].openApp, env.MINI_APP_URL);
}

function plansKeyboard(language: BotLanguage, plan: string) {
  if (plan === 'Lifetime') return Markup.inlineKeyboard([[miniAppButton(language)]]);
  if (plan === 'Monthly') {
    return Markup.inlineKeyboard([[miniAppButton(language)]]);
  }
  return Markup.inlineKeyboard([
    [Markup.button.callback(`Annual - ${plans.annual.amountStars} Stars`, 'buy_annual')],
    [miniAppButton(language)]
  ]);
}

function plansMessage(language: BotLanguage, plan: string) {
  if (plan === 'Lifetime') return language === 'ru'
    ? 'Premium навсегда уже активен. Повторная покупка не нужна.'
    : 'Lifetime Premium is already active. No further purchase is needed.';
  if (plan === 'Monthly') return language === 'ru'
    ? 'Premium уже активен. Ваши действующие права сохранены.'
    : 'Premium is active. Your existing access is preserved.';
  return language === 'ru'
    ? `Действующий годовой доступ: ${plans.annual.amountStars} Stars на 12 месяцев. Новые планы готовятся; Lifetime больше не продаётся.`
    : `Existing annual access: ${plans.annual.amountStars} Stars for 12 months. New plans are being prepared; Lifetime is no longer on sale.`;
}

function invoicePayload(plan: PlanId, telegramId: number, requestId?: string) {
  return JSON.stringify({ plan, telegramId, source: 'luna', ...(requestId ? { requestId } : {}) });
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

export async function sendStarsInvoice(chatId: number, telegramId: number, planId: PlanId, requestId?: string) {
  if(planId==='lifetime')throw new FoundationError(409,'lifetime_not_on_sale','Existing Lifetime access is preserved; new Lifetime sales are closed.');
  const plan = plans[planId];

  try {
    await bot.telegram.callApi('sendInvoice', {
      chat_id: chatId,
      title: `Luna ${plan.title}`,
      description:
        planId === 'annual'
          ? 'Unlock Luna premium meditations and breathing practices for 12 months.'
          : 'Unlock Luna premium meditations and breathing practices forever.',
      payload: invoicePayload(planId, telegramId, requestId),
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: plan.title, amount: plan.amountStars }],
      start_parameter: `luna_${planId}`
    });
  } catch (error) {
    logBackendError(error, {
      endpoint: 'Telegram Bot API sendInvoice',
      requestId,
      telegramId,
      plan: planId,
      stage: 'telegram_invoice_create',
      telegramApiError: error,
      level: 'error'
    });
    throw error;
  }
}

const inFlightInvoiceLinks = new Map<string, Promise<string>>();

export async function createStarsInvoiceLink(telegramId: number, planId: PlanId, requestId?: string) {
  if(planId==='lifetime')throw new FoundationError(409,'lifetime_not_on_sale','Existing Lifetime access is preserved; new Lifetime sales are closed.');
  const key = `${telegramId}:${planId}`;
  const existing = inFlightInvoiceLinks.get(key);
  if (existing) return existing;

  const plan = plans[planId];
  let invoiceRequest: Promise<string>;
  invoiceRequest = bot.telegram.createInvoiceLink({
    title: `Luna ${plan.title}`,
    description:
      planId === 'annual'
        ? 'Unlock Luna premium meditations and breathing practices for 12 months.'
        : 'Unlock Luna premium meditations and breathing practices forever.',
    payload: invoicePayload(planId, telegramId, requestId),
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: plan.title, amount: plan.amountStars }]
  }).then((invoiceLink) => {
    if (!isValidTelegramInvoiceUrl(invoiceLink)) {
      const error = new Error('Telegram returned an invalid invoice URL.');
      logBackendError(error, {
        endpoint: 'Telegram Bot API createInvoiceLink response',
        requestId,
        telegramId,
        plan: planId,
        stage: 'invoice_link_response_validation',
        telegramApiError: error,
        level: 'error'
      });
      throw error;
    }
    return invoiceLink;
  }).then((invoiceLink) => {
    setTimeout(() => {
      if (inFlightInvoiceLinks.get(key) === invoiceRequest) inFlightInvoiceLinks.delete(key);
    }, 30_000);
    return invoiceLink;
  }).catch((error) => {
    if (inFlightInvoiceLinks.get(key) === invoiceRequest) inFlightInvoiceLinks.delete(key);
    logBackendError(error, {
      endpoint: 'Telegram Bot API createInvoiceLink',
      requestId,
      telegramId,
      plan: planId,
      stage: 'telegram_invoice_create',
      telegramApiError: error,
      level: 'error'
    });
    throw error;
  });

  inFlightInvoiceLinks.set(key, invoiceRequest);
  return invoiceRequest;
}

export async function configureTelegramBot() {
  const identity=await bot.telegram.getMe();
  if(identity.username!==env.BOT_USERNAME.replace(/^@/,''))throw new Error('Bot identity mismatch');
  for(const language of ['en','ru'] as const){
    const copy=luna35BotCopy[language];
    await bot.telegram.setMyCommands(botCommands(language),{language_code:language});
    await bot.telegram.setMyName(copy.name,language);
    await bot.telegram.setMyDescription(copy.description,language);
    await bot.telegram.setMyShortDescription(copy.short,language);
  }
  await bot.telegram.setMyCommands(botCommands('en'));
  await bot.telegram.setMyName(luna35BotCopy.en.name);
  await bot.telegram.setMyDescription(luna35BotCopy.en.description);
  await bot.telegram.setMyShortDescription(luna35BotCopy.en.short);
  await bot.telegram.setChatMenuButton({menuButton:{type:'web_app',text:'Open Luna',web_app:{url:env.MINI_APP_URL}}});
}

bot.start(async (ctx) => {
  await ensureUser(ctx);
  if(env.LUNA30_REFERRALS_ENABLED&&ctx.from?.id&&ctx.startPayload){try{await attributeValidatedReferral(ctx.from.id,ctx.startPayload);}catch(error){logBackendError(error,{endpoint:'Luna bot referral attribution'});}}
  const language = botLanguage(ctx.from?.language_code);
  const reply_markup=welcomeKeyboard(env.BOT_USERNAME,language,ctx.startPayload??'');
  try{await ctx.replyWithPhoto(new URL('/images/home/luna35-bot-welcome.jpg',env.MINI_APP_URL).toString(),{caption:luna35BotCopy[language].welcome,reply_markup});}
  catch{await ctx.reply(luna35BotCopy[language].welcome,{reply_markup});}
  if(ctx.from)await recordFunnel(supabase,ctx.from.id,'bot_welcome_sent',String(ctx.update.update_id),'bot');
});

for(const destination of ['tarot','astrology'] as const)bot.command(destination,async ctx=>{await ensureUser(ctx);const language=botLanguage(ctx.from?.language_code);await ctx.reply(destination==='tarot'?luna35BotCopy[language].tarot:luna35BotCopy[language].astrology,{reply_markup:{inline_keyboard:[[{text:luna35BotCopy[language].open,url:miniAppLink(env.BOT_USERNAME,destination)}]]}});});

bot.command('app', async (ctx) => {
  await ensureUser(ctx);
  const language = botLanguage(ctx.from?.language_code);
  await ctx.reply(language === 'ru' ? 'Ваше пространство для самопознания и спокойствия.' : 'Your space for self-discovery and inner calm.', Markup.inlineKeyboard([[miniAppButton(language)]]));
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
    `Luna Profile\n\nPlan: ${access.plan === 'Monthly' ? 'Premium' : access.plan}\nActive until: ${access.user?.active_until ?? 'Not active'}\nLifetime access: ${
      access.user?.lifetime_access ? 'Yes' : 'No'
    }`,
    Markup.inlineKeyboard([[miniAppButton(botLanguage(ctx.from?.language_code))]])
  );
});

bot.command('help', async (ctx) => {
  const language=botLanguage(ctx.from?.language_code);
  await ctx.reply(
    language==='ru'?'Luna: Таро, астрология, разговоры с AI и практики спокойствия.\n\n/app — открыть Luna\n/tarot — Таро\n/astrology — астрология\n/paysupport — поддержка по платежам\n\nДругие вопросы: Профиль → Поддержка.':'Luna: Tarot, astrology, meaningful AI conversations and calming practices.\n\n/app — Open Luna\n/tarot — Tarot\n/astrology — Astrology\n/paysupport — Payment support\n\nOther questions: Profile → Support.'
  );
});
bot.command('paysupport',async(ctx)=>{
 const language=botLanguage(ctx.from?.language_code);
 await ctx.reply(language==='ru'?'Открой Luna → Профиль → Поддержка и выбери «Платежи». Мы поможем проверить покупку.':'Open Luna → Profile → Support and choose Payments. We will help check your purchase.',Markup.inlineKeyboard([[miniAppButton(language)]]));
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

bot.action(/^buy_(annual|lifetime)$/, async (ctx) => {
  await ctx.answerCbQuery();
  if (!ctx.from || !ctx.chat) return;
  await ensureUser(ctx);
  const planId = ctx.match[1];
  if (!isPlanId(planId)) return;
  if(planId==='lifetime'){await ctx.reply(botLanguage(ctx.from.language_code)==='ru'?'Новые Lifetime-покупки закрыты. Все ранее купленные права сохранены.':'New Lifetime sales are closed. All previously purchased access is preserved.');return;}
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
    const parsed = JSON.parse(payload) as { plan?: unknown; telegramId?: unknown; requestId?: unknown;kind?:unknown };
    if(parsed.kind==='commerce'){
      const valid=Boolean(ctx.from)&&await luna30Commerce.precheckout(ctx.from!.id,parsed,ctx.preCheckoutQuery.currency,ctx.preCheckoutQuery.total_amount,ctx.preCheckoutQuery.id);
      await ctx.answerPreCheckoutQuery(valid,valid?undefined:'This Luna product is not on sale.');return;
    }
    if(parsed.kind==='tarot'){
      const valid=Boolean(ctx.from)&&await validateLuna21Precheckout(ctx.from!.id,parsed,ctx.preCheckoutQuery.currency,ctx.preCheckoutQuery.total_amount,ctx.preCheckoutQuery.id);
      await ctx.answerPreCheckoutQuery(valid,valid?undefined:'This Luna reading is unavailable.');return;
    }
    if (!isPaymentPayloadPlanId(parsed.plan) || typeof parsed.telegramId !== 'number' || !ctx.from || parsed.telegramId !== ctx.from.id) {
      await ctx.answerPreCheckoutQuery(false, 'Invalid Luna payment payload.');
      return;
    }
    if(!validExistingPlanPayment(parsed.plan,ctx.preCheckoutQuery.currency,ctx.preCheckoutQuery.total_amount)){
      await ctx.answerPreCheckoutQuery(false,'Invalid Luna payment amount or currency.');return;
    }
    if(parsed.plan==='lifetime'){await ctx.answerPreCheckoutQuery(false,'New Lifetime sales are closed. Previously purchased access is preserved.');return;}
    const access = await getUserAccess(ctx.from.id);
    if (!paymentEligibility(access.plan, parsed.plan).allowed) {
      await ctx.answerPreCheckoutQuery(false, access.plan === 'Lifetime' ? 'Lifetime Premium is already active.' : 'Premium access is already active.');
      return;
    }
    await ctx.answerPreCheckoutQuery(true);
  } catch (error) {
    logBackendError(error, {
      endpoint: 'Telegram pre_checkout_query',
      telegramId: ctx.from?.id ?? null,
      stage: 'pre_checkout_validation',
      level: 'error'
    });
    await ctx.answerPreCheckoutQuery(false, 'Invalid Luna payment payload.');
  }
});

bot.on('successful_payment', async (ctx) => {
  if (!ctx.from) return;
  const payment = ctx.message.successful_payment;
  let payload: { plan?: unknown; telegramId?: unknown; requestId?: unknown;kind?:unknown } | null = null;

  try {
    payload = JSON.parse(payment.invoice_payload) as { plan?: unknown; telegramId?: unknown; requestId?: unknown };
    if(payload?.kind==='commerce'){
      await luna30Commerce.fulfill(ctx.from.id,payload,payment);
      await ctx.reply(botLanguage(ctx.from.language_code)==='ru'?'Платёж подтверждён. Статус покупки доступен в Luna.':'Payment confirmed. Your purchase status is available in Luna.',Markup.inlineKeyboard([[miniAppButton(botLanguage(ctx.from.language_code))]]));return;
    }
    if(payload?.kind==='tarot'){
      await fulfillLuna21Payment(ctx.from.id,payload,payment.currency,payment.total_amount,payment.telegram_payment_charge_id);
      const language=botLanguage(ctx.from.language_code);
      await ctx.reply(language==='ru'?'Покупка подтверждена. Твой расклад доступен в Luna → Таро.':'Purchase confirmed. Your reading is available in Luna → Tarot.',Markup.inlineKeyboard([[miniAppButton(language)]]));return;
    }

    if (!isPaymentPayloadPlanId(payload.plan) || typeof payload.telegramId !== 'number' || payload.telegramId !== ctx.from.id) {
      console.warn('[Luna payment rejected]', { telegramId: ctx.from.id, reason: 'invalid_payload' });
      return;
    }

    if(!validExistingPlanPayment(payload.plan,payment.currency,payment.total_amount,payment.telegram_payment_charge_id)){
      console.warn('[Luna payment rejected]',{reason:'invalid_amount_or_currency'});return;
    }
    const result = await recordSuccessfulPayment({
      telegram_id: ctx.from.id,
      plan: payload.plan,
      telegram_payment_charge_id: payment.telegram_payment_charge_id,
      provider_payment_charge_id: payment.provider_payment_charge_id
    });
    console.info('[Luna successful payment recorded]', {
      telegramId: ctx.from.id,
      plan: payload.plan,
      requestId: typeof payload.requestId === 'string' ? payload.requestId : null,
      isNewPayment: result.isNewPayment,
      seedsGranted: result.seedsGranted
    });

    const language = botLanguage(ctx.from.language_code);
    const firstName = ctx.from.first_name || (language === 'ru' ? 'друг' : 'friend');
    const planName = payload.plan === 'lifetime'
      ? (language === 'ru' ? 'Premium навсегда' : 'Lifetime Premium')
      : payload.plan === 'annual'
        ? (language === 'ru' ? 'Premium на год' : 'Annual Premium')
        : (language === 'ru' ? 'Premium с ограниченным сроком' : 'Fixed-term Premium');
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
    logBackendError(error, {
      endpoint: 'Telegram successful_payment',
      telegramId: ctx.from.id,
      plan: isPaymentPayloadPlanId(payload?.plan) ? payload.plan : null,
      requestId: typeof payload?.requestId === 'string' ? payload.requestId : null,
      stage: 'successful_payment_callback',
      level: 'error'
    });
  }
});

// Older SDKs do not yet expose RefundedPayment in their message union. Accept
// only Telegram-authenticated updates and match an existing owned v3 receipt.
bot.on('message',async ctx=>{
 const message=ctx.message as unknown as {refunded_payment?:{currency:string;total_amount:number;telegram_payment_charge_id:string;invoice_payload:string}};
 const refund=message.refunded_payment;if(!refund||!ctx.from)return;
 let payload:unknown;try{payload=JSON.parse(refund.invoice_payload);}catch{return;}
 if(!payload||typeof payload!=='object'||!('kind'in payload)||payload.kind!=='commerce')return;
 try{await luna30Commerce.recordRefund(ctx.from.id,refund);}catch(error){logBackendError(error,{endpoint:'Telegram v3 refund reconciliation',telegramId:ctx.from.id,stage:'verified_refund_callback',level:'error'});}
});
