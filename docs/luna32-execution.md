# Luna 3.2 execution

Authoritative source: `luna-meditation/luna-telegram-mvp`, production `main`
`2eaad97551637bdc1112fd4c1d55a00844028f89`; development branch
`feature/luna-3-2-complete-upgrade`. All four specification parts read together;
Part 4 wins on beta access, existing daily quotas and three-tab navigation.

## Order

1. P0: diagnose both supplied production request references; fix bounded output,
   context switching/removal, safe diagnostics, retry/idempotency and metering.
2. Server foundation: reusable typed tools, explicit consent for durable writes,
   reversible promotional beta entitlement and shared successful-answer quota,
   atomic global cost reservations and editable private admin configuration.
3. Product: Dark-only, compact Home/chat, astrology discovery/calendar/path,
   inline profile/compatibility tools, explicit saved dreams, preserved Tarot.
4. Commercial readiness: existing payment adapters/ledgers remain authoritative;
   new proposed prices, packages and rewards stay OFF pending owner approval.
5. Node 22 tests/build/lint, isolated PostgreSQL migration/reapply/rollback and
   authorization/concurrency tests; authenticated staging E2E and mobile checks.
6. Fresh encrypted Luna-only backup/two restores before production schema
   changes. PR/backend-first/frontend release only if every P0 gate passes.

## Verified initial diagnosis

Read-only Railway logs show both supplied astrology requests reached OpenAI.
HTTP 200 returned `status: incomplete`, `finishReason: max_output_tokens`, with
an 800-token request cap. No evidence of failed Telegram authentication, missing
chart ownership or failed context lookup in these two traces. One explicit retry
also failed visible-output validation. The database records both requests as
`failed_retryable`, `quota_charged: false`, user message present, no assistant
message. Existing successful-answer refund works for those failures. Metering
currently overwrites attempts by logical request ID and leaves estimated cost
NULL, so spend protection needs immutable per-attempt accounting.

No private birth data, user messages, API response text or secrets belong here.

## Approvals and gates

- Owner approved up to six new neutral staging provider calls / $0.03.
  Zero provider calls used for Luna 3.2 so far.
- No existing monthly global budget setting found in exposed Railway variable
  names or audited release tables. Owner approved $30/month inside Luna on
  2026-10-16. This does not change the OpenAI account's billing configuration.
  Owner explicitly selected a TOTAL $30 October ceiling, including spend before
  the release, not an additional $30. Owner will provide October spend. Until
  then production activation remains blocked; never assume a zero baseline.
- Part 4 preserves existing daily limits; do not silently substitute Part 3's
  provisional 30/day. Owner can adjust private runtime settings later.
- Beta access is promotional, never a paid subscription or balance mutation.
- Proposed 500/3500-Star plans and unapproved Seed packages stay disabled.
- No new project, paid service, real payment or production QA transaction.
- Existing unrelated local QA drafts are not part of this release.

## Local verification / staging preparation

- New additive migration applied/reapplied only to `funvzpmpbgazsisehiru` under
  `luna32_beta_ai_budget_and_dreams` / `luna32_reviewed_budget_attempt_guard`.
  Five forced-RLS tables; four service-only SECURITY INVOKER RPCs. All beta and
  generation switches are OFF. Unrelated schema fingerprint unchanged:
  `59d78828d25b31907f42ae2c229d9216`.
- Isolated native PostgreSQL17: 14 new checks plus 17 existing foundation checks
  pass, including rollback, permission denials, concurrency, unknown spend,
  account erasure, duplicate leases, attempt cap and crash recovery.
- Full Node22 tests: backend307 passed / 1 integration fixture skipped;
  frontend181 passed, including the staging-command authorization guard.
- Browser mobile checks: 24 viewport/language/stale-theme cases, 192 screen
  states. This uses offline UI fixtures and does NOT prove real Telegram login,
  Supabase persistence, Safari or physical-device behavior.
- Staging package uses the existing site only. Its temporary QA command needs
  a high-entropy bearer credential, exact site/database, short expiry and a
  one-shot private database claim. Credentials never enter Git or public files.
  The worker permits at most six actual provider calls/$0.03, respects the
  existing tool-route limiter, and restores beta/generation OFF after testing.

Status: implementation in progress; production is still Luna 3.1. No new
production migration, environment update, merge or deployment has occurred.
