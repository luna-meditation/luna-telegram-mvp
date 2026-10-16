# Luna 3.2 database gate (not applied to production)

Migration: `20261016112135_luna32_beta_ai_budget_and_dreams.sql`.
Production: `vkcdtasbdoeilgfucoax`; existing staging: `funvzpmpbgazsisehiru`.
No new cloud project or paid database resource is needed.

## Dependencies / scope

Requires existing `public.users(telegram_id)`, `ai_chat_requests` (owner,
client_request_id, quota_charged, created_at), and `luna_tarot_readings` (owner,
client_reading_id, status, interpretation, created_at). Only creates/updates
`luna32_*` objects. It does not replace existing RPCs, policies, triggers,
payments, balances, subscriptions, achievements or other applications' objects.
The three legacy tables are read for a unified allowance, never modified by
these new RPCs.

All five new tables use forced RLS and deny anon/authenticated. Telegram
identities are validated by the existing server; Supabase Auth claims cannot
substitute a Telegram owner. Four RPCs are SECURITY INVOKER, have an empty
search_path and grant execution only to service_role. The server always binds
the owner; users and model tool arguments cannot supply it.

## Before production

1. Compare current columns/types, service-role SELECT grants, migration ledger
   and a Luna-only schema/permission fingerprint with the staging review.
2. Create a fresh encrypted Luna-only backup, verify checksum, restore twice
   into isolated PG17 and check data/security/media completeness. Do not copy
   user rows into staging. Preserve recovery keys separately from Git/chat.
3. Verify current-month provider cost baseline. Legacy `ai_usage` can overwrite
   retries and may contain NULL costs; its sum alone is not a verified baseline.
   Use provider billing evidence or a documented conservative bound. If this
   cannot be established, leave generation disabled: do not assume zero cost.
   Owner selected a TOTAL $30 October ceiling and is supplying the already
   spent amount. It is not a fresh additional $30 allowance at release time.
4. Verify exact new migration hash against the native-PG17 test evidence.
5. Apply ONLY this migration in one transaction. Check default flags OFF,
   monthly cap $30, ACL/RLS, dependency grants and unchanged unrelated objects.

## Activation

Backend `LUNA32_ENABLED` stays false until migration and backend compatibility
checks pass. New `public_beta` and `generation_enabled` are false by default.
Activation needs an explicit finite promotion window, verified baseline month,
approved cap $30 (30,000,000 micro-USD) and the existing daily quota policy.
Do not activate new prices, Seed packages, paid readings or referral rewards.
Staging's neutral AI test additionally has a 6-provider-call/$0.03 ceiling.

The global lock is held only during short SQL reservations/settlements, never
during provider calls. Unknown billed outcomes keep their full cost hold.
An unexpected cost overrun turns generation off. Removing a user's private
audit rows never refunds anonymous monthly spend. A failed answer releases the
successful-answer allowance, not actual provider cost. A 3-minute crashed lease
can be retried with a new immutable attempt; old uncertain cost remains held.

## Verification / safe rollback

Run server-authenticated QA, ownership denials, quota/concurrency, provider error,
history-reopen/no-generation and beta/no-charge checks before frontend release.
Compare schema/security and balances/paid rights before/after; verify the other
application's fingerprint is unchanged. A physical Telegram test is separate
from a local browser check.

If a regression occurs: first set `generation_enabled=false` and
`public_beta=false` in **luna32_runtime_settings only**. This reversible
feature-off rollback is covered by the isolated test. Keep the ledger, dream
records, holds and totals; never DROP these objects after real data exists.
Saved results and non-AI practices must remain accessible. Do not fall back to
an old backend with unmetered generation enabled. If code rollback is necessary,
disable all provider-generation flags before running the old backend. Restore
user data only with separate approval and a tested targeted recovery procedure.

Current status: native PG17 review passed14 new checks; migration installed and
reapplied to the existing staging project only. All staging activation settings
remain OFF outside the separately authorized, finite QA smoke-test. No
production SQL, configuration change or deployment executed.
