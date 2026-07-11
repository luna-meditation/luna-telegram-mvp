import 'dotenv/config';
import { z } from 'zod';

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
  RUN_MIGRATIONS: envBoolean.default(true),
  OPENAI_API_KEY: z.string().min(1).optional(),
  AI_CHAT_MODEL: z.string().min(1).default('gpt-5-mini'),
  AI_CHAT_ENABLED: envBoolean.default(false),
  AI_MEMORY_ENABLED: envBoolean.default(true),
  AI_MAX_MESSAGES_PER_DAY: z.coerce.number().int().positive().default(8),
  AI_PREMIUM_MAX_MESSAGES_PER_DAY: z.coerce.number().int().positive().default(40),
  AI_MAX_MESSAGE_LENGTH: z.coerce.number().int().min(100).max(10000).default(2000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(128).max(4096).default(800),
  AI_RECENT_MESSAGE_LIMIT: z.coerce.number().int().min(4).max(40).default(16),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(5000).max(120000).default(30000),
  PORT: z.coerce.number().default(4000)
});

export const env = envSchema.parse(process.env);

export const telegramAppUrl =
  `https://t.me/${env.BOT_USERNAME}/app-short-name`;

export const telegramFallbackUrl =
  `https://t.me/${env.BOT_USERNAME}?start=luna`;
