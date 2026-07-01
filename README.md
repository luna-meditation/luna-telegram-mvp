# Luna Telegram MVP

Luna is an AI-guided wellness MVP built around a Telegram bot, Telegram Mini App, Telegram Stars payments, and Supabase PostgreSQL.

## Structure

- `frontend/` - React + Vite + TypeScript Telegram Mini App.
- `backend/` - Node.js + Express + Telegraf bot/API.
- `database/schema.sql` - Supabase PostgreSQL tables, indexes, RLS starter policies, and sample practices.
- `website/` - simple marketing landing page with Telegram entry buttons.

## Quick Start

1. Copy environment files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp website/.env.example website/.env
```

2. Fill in bot, Mini App, webhook, and Supabase values.

3. Install dependencies:

```bash
pnpm install
```

4. Run locally:

```bash
pnpm run dev
```

## Telegram Setup Notes

- Create a bot with BotFather and set `BOT_TOKEN` and `BOT_USERNAME`.
- Configure a Mini App and short name with BotFather.
- Set `MINI_APP_URL` to the deployed frontend HTTPS URL.
- Set `WEBHOOK_URL` to the deployed backend HTTPS URL.
- Telegram Stars invoices use `currency: "XTR"` and an empty provider token.

## Deployment

- Frontend Mini App: Netlify or Vercel from `frontend/`.
- Backend bot/API: Render or Railway from `backend/`.
- Website landing page: Netlify or Vercel from `website/`, or merge its button/text changes into your existing site.

## Database

Run `database/schema.sql` in Supabase SQL editor. The backend uses `SUPABASE_SERVICE_ROLE_KEY`, so keep it server-side only.
