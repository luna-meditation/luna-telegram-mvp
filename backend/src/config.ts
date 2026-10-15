import 'dotenv/config';
import { z } from 'zod';
import {assertStagingIsolation} from './staging-policy.js';

const envBoolean = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return value;
}, z.boolean());

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  BOT_USERNAME: z.string().min(1),
  MINI_APP_URL: z.string().url(),
  WEBHOOK_URL: z.string().url().optional(),
  FRONTEND_ORIGIN: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ADMIN_TELEGRAM_ID: z.coerce.number().optional(),
  TELEGRAM_AUTH_MAX_AGE_SECONDS: z.coerce.number().default(86400),
  ALLOW_UNVERIFIED_TELEGRAM_WEBAPP: envBoolean.default(false),
  RUN_MIGRATIONS: envBoolean.default(false),
  STAGING_MODE: envBoolean.default(false),
  STAGING_HOST: z.enum(['standalone', 'netlify']).default('standalone'),
  STAGING_SETUP_QA_BOT: envBoolean.default(false),
  STAGING_SUPABASE_PROJECT_REF: z.string().optional(),
  STAGING_ACCESS_PASSWORD: z.string().optional(),
  STAGING_TELEGRAM_IDS: z.string().optional(),
  FEATURE_GARDEN_ATOMIC: envBoolean.default(false),
  FEATURE_PERSONALIZATION: envBoolean.default(false),
  FEATURE_PERSONAL_MEMORY: envBoolean.default(false),
  FEATURE_AI_CENTRAL_EXPERIENCE: envBoolean.default(false),
  FEATURE_TAROT_SPREAD_AI_QA: envBoolean.default(false),
  STAGING_TAROT_AI_QA_OWNER_ID: z.coerce.number().int().positive().optional(),
  STAGING_TAROT_AI_QA_GRANT_ID: z.string().uuid().optional(),
  FEATURE_AI_MODES: envBoolean.default(false),
  FEATURE_TAROT_HISTORY: envBoolean.default(false),
  FEATURE_TAROT_AI: envBoolean.default(false),
  FEATURE_DAILY_CARD_V2: envBoolean.default(false),
  FEATURE_ECONOMY_REWARDS_V2: envBoolean.default(false),
  FEATURE_TAROT_PAID_READINGS: envBoolean.default(false),
  FEATURE_PREMIUM_V2: envBoolean.default(false),
  FEATURE_PAYMENT_ATOMIC: envBoolean.default(false),
  LUNA21_QA_ENABLED: envBoolean.default(false),
  LUNA21_QA_RESUME: envBoolean.default(false),
  LUNA21_QA_TELEGRAM_ID: z.coerce.number().int().positive().optional(),
  LUNA21_QA_RUN_ID: z.string().uuid().optional(),
  RELEASE_QA_TAROT_ENABLED: envBoolean.default(false),
  RELEASE_QA_TAROT_TELEGRAM_ID: z.coerce.number().int().positive().optional(),
  RELEASE_QA_TAROT_CLIENT_ID: z.string().uuid().optional(),
  TAROT_AI_DAILY_LIMIT: z.coerce.number().int().min(0).max(10).default(2),
  TAROT_AI_GLOBAL_DAILY_LIMIT: z.coerce.number().int().min(0).max(1000).default(200),
  TAROT_AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(512).max(2000).default(1600),
  FEATURE_NEW_NAVIGATION: envBoolean.default(false),
  FEATURE_TAROT_DAILY: envBoolean.default(false),
  FEATURE_TAROT_SPREADS: envBoolean.default(false),
  FEATURE_ASTROLOGY: envBoolean.default(false),
  FEATURE_MOON_SEEDS_WALLET_V2: envBoolean.default(false),
  FEATURE_MOON_SEEDS_PURCHASES: envBoolean.default(false),
  FEATURE_BREATHWORK_AUDIO: envBoolean.default(false),
  OPENAI_API_KEY: z.string().min(1).optional(),
  AI_CHAT_MODEL: z.string().min(1).default('gpt-5-mini'),
  AI_CHAT_ENABLED: envBoolean.default(false),
  AI_MEMORY_ENABLED: envBoolean.default(true),
  AI_MAX_MESSAGES_PER_DAY: z.coerce.number().int().positive().default(8),
  AI_PREMIUM_MAX_MESSAGES_PER_DAY: z.coerce.number().int().positive().default(40),
  AI_MAX_MESSAGE_LENGTH: z.coerce.number().int().min(100).max(10000).default(2000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(512).max(8192).default(2000),
  AI_REASONING_EFFORT: z.enum(['minimal', 'low', 'medium', 'high']).default('minimal'),
  AI_RECENT_MESSAGE_LIMIT: z.coerce.number().int().min(4).max(40).default(16),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(5000).max(120000).default(30000),
  AI_CONVERSATION_RETENTION_DAYS: z.coerce.number().int().min(30).max(365).default(90),
  REMINDER_SCHEDULER_ENABLED: envBoolean.default(true),
  PORT: z.coerce.number().default(4000)
});

export const env = envSchema.parse(process.env);
assertStagingIsolation(env);

export const telegramAppUrl =
  `https://t.me/${env.BOT_USERNAME}/app-short-name`;

export const telegramFallbackUrl =
  `https://t.me/${env.BOT_USERNAME}?start=luna`;
