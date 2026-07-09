import 'dotenv/config';
import { z } from 'zod';

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
  ALLOW_UNVERIFIED_TELEGRAM_WEBAPP: z.coerce.boolean().default(false),
  RUN_MIGRATIONS: z.coerce.boolean().default(true),
  PORT: z.coerce.number().default(4000)
});

export const env = envSchema.parse(process.env);

export const telegramAppUrl =
  `https://t.me/${env.BOT_USERNAME}/app-short-name`;

export const telegramFallbackUrl =
  `https://t.me/${env.BOT_USERNAME}?start=luna`;
