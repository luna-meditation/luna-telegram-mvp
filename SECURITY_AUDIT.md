# Luna Security Audit Notes

Date: 2026-07-09

## Fixed in this pass

- Telegram Mini App fallback authentication is disabled in production even if `ALLOW_UNVERIFIED_TELEGRAM_WEBAPP` is set by mistake.
- Production CORS now allows the configured Mini App origin and explicit `FRONTEND_ORIGIN` values instead of trusting every Netlify/Vercel domain.
- Backend responses now include basic security headers and hide `X-Powered-By`.
- JSON request body size is limited to 1 MB for normal API routes.
- Admin and payment API routes have a lightweight in-memory rate limit.
- Admin Storage uploads are also covered by the admin rate limit.
- Telegram Stars checkout now verifies that the invoice payload Telegram user matches the real Telegram payer.
- Successful Telegram Stars payments now validate payload shape before updating access.
- Payment recording is idempotent by Telegram charge id and protected by unique database indexes.
- Check-in and generic API error logging no longer prints raw request bodies.
- Temporary player debug logs are development-only in the frontend.
- Vite/esbuild dev-server advisories were resolved by upgrading frontend and website Vite to a patched version.

## Secret scan

No committed secret values were found in the repository scan. The scan only matched documentation, placeholders, and runtime environment variable names.

## Dependency audit

`pnpm audit --audit-level moderate` reports no known vulnerabilities after the Vite upgrade.

## Remaining recommendations

- Move rate limiting to a shared store such as Redis if the backend scales beyond one instance.
- Add stricter validation schemas for admin meditation create/update payloads.
- Add monitoring/alerting for payment rejects, webhook errors, and repeated 401/403 responses.
- If direct Supabase access is ever added from the frontend, revisit RLS policies for all user-owned tables before shipping.
- Keep `BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and Telegram webhook URLs only in deployment environment variables.
