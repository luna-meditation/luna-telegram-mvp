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

- Initial authorization: six neutral staging provider calls / $0.03. Five calls
  have completed, actual usage-derived cost $0.00693655, rounded immutable
  ledger total6939 micro-USD, unknown spend0. Saved single RU, three EN and five
  RU readings reopen and replay without any new generation or Seed charge.
- The real `calculate_compatibility` tool completed. Its final provider answer
  was completed too, but validation rejected `memoryCandidates.0.key` (safe log
  category `schema`, code `invalid_string`). Raw private/provider text was not
  logged. Fix: discard invalid optional memory suggestions, never repair them
  into facts, while keeping strict visible-answer validation and consent gates.
  EN/RU regression tests pass; real staging verification is still pending.
- Owner then explicitly approved one more staging publication and at most two
  additional calls/$0.01: seven cumulative calls, still below the original
  $0.03 total. The next one-shot worker reuses all three saved readings and both
  synthetic charts; unpaid persistence tests run before AI. Its short QA-only
  answer cap1100 keeps conservative reservations within the additional budget;
  the normal backend cap2600 is unchanged. Generation/beta restore OFF on exit.
- No existing monthly global budget setting found in exposed Railway variable
  names or audited release tables. Owner approved $30/month inside Luna on
  2026-10-16. This does not change the OpenAI account's billing configuration.
  Owner explicitly selected a TOTAL $30 October ceiling, including spend before
  the release, not an additional $30. Owner will provide October spend. Until
  then production activation remains blocked; never assume a zero baseline.
  The later owner estimate "$1 or $2, unsure" is not verified billing evidence
  and must not be recorded as a confirmed baseline.
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
- Full Node22 tests: backend310 passed / 1 integration fixture skipped by
  default; frontend183 passed, including the staging-command guard and strict
  production baseline/recovery release gate. The optional exact-production-RPC
  integration check runs separately on synthetic local PostgreSQL.
- Backend/frontend TypeScript, lint, backend build and real-SDK staging frontend
  production-mode build pass locally. No cloud build is needed.
- Browser mobile checks: 24 viewport/language/stale-theme cases, 192 screen
  states. This uses offline UI fixtures and does NOT prove real Telegram login,
  Supabase persistence, Safari or physical-device behavior.
- Three additional local browser regressions pass: opening an older conversation
  beyond history page one, preserving cache on503 and clearing it on404.
- Another24 Tarot browser cases pass: widths360/375/390/393, EN/RU, one/three/five
  cards, interactive reveal, zoom, full images, orientation metadata and tab
  persistence. These too are offline fixtures, not physical Telegram proof.
- Staging package uses the existing site only. Its temporary QA command needs
  a high-entropy bearer credential, exact site/database, short expiry and a
  one-shot private database claim. Credentials never enter Git or public files.
  The worker permits at most seven cumulative actual provider calls/$0.03 and
  two new calls/$0.01 under the latest explicit owner approval, respects the
  existing tool-route limiter, and restores beta/generation OFF after testing.
- Three staging publications so far: `6ad21861c936e638a960d11c`, configuration
  fix `6ad21d042da3472f7614b604`, and `6ad22185dc733b2b581122af` (Ready, source
  `f561800d152170aa99672a34677ed71221a45e22`). Connector upsert reported success
  for a missing flag; the flag was verified absent. Personal rejects explicit
  scope customization; creating the nonsecret flag with default scopes worked.
  Owner authorized one additional corrected staging publication after the
  optional-memory failure was diagnosed. No production publication is allowed
  while the critical verification/budget gates fail.
- Fresh encrypted backup captured2026-10-16T12:46:10Z:48 tables/1484 rows/33
  functions, restored twice with exact checksums, RLS, definitions and ACLs.
  Media28 objects/239528218 bytes, current immutable versions matched and every
  encrypted archive decrypted/content hash verified locally. Other application
  rows/buckets excluded; no plaintext backup or recovery keys in Git/chat.
- The exact restored production schema also passes apply/reapply/transactional
  rollback of the new migration,12 anon/authenticated permission denials and
  service-role positives; all48 old tables/1484 rows and ACLs stay unchanged.

Production release remains blocked on verified TOTAL October provider spend,
cutover/in-flight accounting and completion of staging AI/physical-device gates.

Status: implementation in progress; production is still Luna 3.1. No new
production migration, environment update, merge or deployment has occurred.
