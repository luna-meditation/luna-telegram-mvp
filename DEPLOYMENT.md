# Luna Deployment Guide

This guide prepares the Luna Telegram Mini App, bot/API, and website for GitHub-based deployment.

## 1. Push To GitHub

Initialize git if needed:

```bash
git init
git add .
git commit -m "Initial Luna Telegram Mini App MVP"
```

Create an empty GitHub repository, then connect and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/luna-telegram-mvp.git
git branch -M main
git push -u origin main
```

Do not commit real `.env` files. Keep only `.env.example` files in git.

## 2. Environment Variables

### Backend

Add these variables to Render or Railway:

```text
BOT_TOKEN=
BOT_USERNAME=
MINI_APP_URL=
WEBHOOK_URL=
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_TELEGRAM_ID=
PORT=4000
```

Notes:

- `BOT_TOKEN` comes from BotFather.
- `BOT_USERNAME` is the bot username without `@`.
- `MINI_APP_URL` is the deployed frontend HTTPS URL.
- `WEBHOOK_URL` is the deployed backend HTTPS URL, with no trailing slash.
- `SUPABASE_SERVICE_ROLE_KEY` must only be used on the backend.
- `ADMIN_TELEGRAM_ID` is your numeric Telegram user ID.

### Frontend Mini App

Add these variables to Netlify or Vercel:

```text
VITE_API_URL=
VITE_BOT_USERNAME=
```

Notes:

- `VITE_API_URL` is the deployed backend HTTPS URL.
- `VITE_BOT_USERNAME` is the bot username without `@`.

### Website

Add these variables if deploying the included website:

```text
VITE_BOT_USERNAME=
VITE_TELEGRAM_APP_SHORT_NAME=app-short-name
```

Replace `app-short-name` with the Mini App short name configured in BotFather.

## 3. Deploy Frontend Mini App To Netlify

Create a new Netlify site from the GitHub repository.

Use these settings:

```text
Base directory: frontend
Build command: pnpm install --frozen-lockfile && pnpm build
Publish directory: frontend/dist
```

Add the frontend environment variables from this guide.

After deploy, copy the Netlify HTTPS URL and set it as:

```text
MINI_APP_URL=https://your-mini-app.netlify.app
```

in the backend service.

## 4. Deploy Frontend Mini App To Vercel

Create a new Vercel project from the GitHub repository.

Use these settings:

```text
Root directory: frontend
Framework preset: Vite
Build command: pnpm build
Output directory: dist
Install command: pnpm install --frozen-lockfile
```

Add the frontend environment variables from this guide.

After deploy, copy the Vercel HTTPS URL and set it as `MINI_APP_URL` in the backend service.

## 5. Deploy Backend Bot/API To Render

Create a new Render Web Service from the GitHub repository.

Use these settings:

```text
Root directory: backend
Runtime: Node
Build command: pnpm install --frozen-lockfile && pnpm build
Start command: pnpm start
```

Add the backend environment variables from this guide.

After deploy, copy the Render HTTPS URL and set:

```text
WEBHOOK_URL=https://your-backend.onrender.com
```

Then redeploy or restart the service so the webhook is configured.

## 6. Deploy Backend Bot/API To Railway

Create a new Railway service from the GitHub repository.

Use these settings:

```text
Root directory: backend
Build command: pnpm install --frozen-lockfile && pnpm build
Start command: pnpm start
```

Add the backend environment variables from this guide.

After deploy, copy the Railway HTTPS URL and set:

```text
WEBHOOK_URL=https://your-backend.up.railway.app
```

Then redeploy or restart the service so the webhook is configured.

## 7. Deploy Website

The included website can be deployed separately to Netlify or Vercel.

Use these settings:

```text
Root/Base directory: website
Build command: pnpm install --frozen-lockfile && pnpm build
Publish/Output directory: website/dist or dist, depending on host settings
```

If you already have an existing marketing site, copy the Telegram button links and text from `website/index.html` into that site instead.

## 8. Configure Telegram Mini App In BotFather

In Telegram, open BotFather and configure the bot:

1. Use `/mybots`.
2. Select the Luna bot.
3. Open `Bot Settings`.
4. Open `Menu Button` or `Configure Mini App`, depending on the BotFather menu shown.
5. Set the Mini App URL to the deployed frontend HTTPS URL.
6. Set the Mini App short name, for example:

```text
app-short-name
```

The website can then link users to:

```text
https://t.me/BOT_USERNAME/app-short-name
```

Fallback link:

```text
https://t.me/BOT_USERNAME?start=luna
```

## 9. Set Telegram Webhook

The backend automatically calls `setWebhook` on startup when `WEBHOOK_URL` is present.

The webhook endpoint is:

```text
https://your-backend-domain.com/telegram/webhook
```

To set it manually, use:

```bash
curl "https://api.telegram.org/botBOT_TOKEN/setWebhook?url=https://your-backend-domain.com/telegram/webhook"
```

To check the webhook:

```bash
curl "https://api.telegram.org/botBOT_TOKEN/getWebhookInfo"
```

Replace `BOT_TOKEN` and `your-backend-domain.com` before running these commands.

## 10. Supabase Setup

Run `database/schema.sql` in the Supabase SQL editor.

The schema is safe to run multiple times. It uses `create table if not exists`, `create index if not exists`, and drops/recreates policies without deleting existing data.

## 11. Final Checklist

- GitHub repository contains no real `.env` files.
- Backend service has all backend environment variables.
- Frontend service has `VITE_API_URL` and `VITE_BOT_USERNAME`.
- BotFather Mini App URL points to the deployed frontend.
- Backend `WEBHOOK_URL` points to the deployed backend.
- Supabase schema has been run.
- Telegram Stars payments are tested from the bot using `/plans`.
