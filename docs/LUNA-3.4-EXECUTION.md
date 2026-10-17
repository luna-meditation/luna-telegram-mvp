# Luna 3.4 execution and release gates

Baseline: production/main `80e2c6e73567dd97ca20f42ae286ce4522c5d68a` (Luna 3.3).
Development branch: `feature/luna-3-4-premium-foundation`.

## Implementation order

1. Audit existing rights, AI accounting, contextual workflows and commercial gates.
2. Mobile refinements, immediate mood feedback, accessible ambient sound sheet,
   audio coexistence, conversation attachments and contextual actions.
3. Exactly 50 deterministic achievements, verified event evidence, legacy archive,
   ten existing free-accessible statuses, distinct artwork and celebrations.
4. Central commercial catalog, server entitlements/periods, successful-use buckets,
   membership presentation, referrals/sharing/support and payment reconciliation.
5. Node 22 tests, isolated PostgreSQL and staging checks, encrypted backup with
   restoration, one reviewed release through development branch and PR.

## Non-negotiable boundaries

- Production remains unchanged until release gates pass.
- Do not rewrite existing balances, payment records or Lifetime/fixed-term rights.
- New purchases, reward amounts and commercial quotas remain disabled until a
  separately reviewed owner activation. The $100 AI safety budget baseline is
  preserved, not reset by this release.
- No real purchase or newly paid AI test without an explicit relevant allowance.
- No unrelated objects in the shared Supabase project.
- Existing recorded soundscapes and cinematic Home assets are reused.
- Browser/synthetic tests are not described as physical-iPhone or live-payment proof.

## Release gates (predeployment checks passed; publication still pending)

- [x] Existing and new frontend/backend unit tests; lint; type checks; local builds.
- [x] 50 IDs, rules, EN/RU and all artwork verified.
- [x] Owner isolation, anon/authenticated denial, RPC idempotency and concurrency.
- [x] No financial changes while gates are off; Lifetime preserved.
- [x] Mobile 360/375/390/393px, Telegram navigation, keyboard and safe areas.
- [x] Fresh encrypted Luna-only backup, Storage hashes, two isolated restores.
- [x] Four reviewed migrations isolated/staging-tested and verified in production.
- [x] Necessary real AI validation within separately authorized finite budgets.
- [ ] Reviewed production changes, single frontend/backend release and postflight.

Official references checked: OpenAI function calling (strict schemas and reasoning
continuation); Telegram Bot API Stars (XTR, verified successful_payment, 30-day-only
recurring period; annual access must be prepaid); Supabase RLS/function grants.

## Verification checkpoint — 17 October 2026

- Fresh encrypted Luna-only database snapshot: 53 tables / 1,634 rows, restored
  twice into separate local databases; row checksums, constraints, functions,
  policies, grants and existing financial rights match. Storage verification is
  running separately and must also pass before release.
- Four Luna 3.4 migrations exist only in the existing staging project. All new
  commercial, reward, referral and quota switches remain OFF. Production has not
  been migrated or deployed by this work.
- Isolated PostgreSQL 17: 43 checks passed (17 existing + 26 Luna 3.4), including
  concurrent reservations, final-state-only settlement, replay, RLS, idempotent
  refunds, annual monthly allocations and preservation of other-application data.
- Local mobile checks: 8 Luna 3.4 scenarios plus 24 general regression scenarios
  at 360/375/390/393 pixels in EN/RU. These use clearly marked synthetic fixtures,
  not evidence of a real Telegram login or a physical-device test.
- Exactly 50 unique achievement illustrations and ten distinct existing-status
  illustrations; Retina variants load on demand. No achievement Seeds payout.
- Fixed a quota lease ordering risk, nested sharing Back behavior, an escaped
  achievement-acknowledgement regex and cramped multi-line daily-card text.
- Owner has authorized at most four new staging AI calls totaling $0.03. Calls
  must be counted before dispatch, priced from actual usage, and results reopened
  without regeneration. This evidence is still pending.
- Live Stars purchases, external posting confirmation and physical iPhone payment
  callbacks are not verified. New financial features must remain disabled.

This checkpoint is not a production-release PASS report. The production builder
requires fresh, source-bound evidence and must not be bypassed.

## Final validation checkpoint — 17 October, production still unchanged

- Node.js 22.23.3: frontend 203 PASS; backend 397 PASS, one optional integration
  test skipped in the general suite (that RPC test passed separately against
  isolated PostgreSQL). Both type checks, lint and actual builds passed.
- Latest mobile 360/375/390/393 EN/RU checks: eight Luna 3.4 cases passed.
  The owner also confirmed on a physical iPhone that staging opens without a
  Netlify login, new achievement artwork is visible and saved AI text/buttons
  remain readable. This is owner-provided device evidence, not a simulated login.
- Fresh backup: 53 Luna tables, 1,634 rows, 37 functions; two isolated restores
  and exact security/checksum comparisons passed. All 28 encrypted Storage
  archives (avatars and meditations, 239,528,218 bytes) were decrypted in memory
  and their content hashes verified against fresh production metadata. No
  separate Supabase Storage upload/restore was performed.
- Real AI: four authorized calls cost $0.0050599, with no unknown spend. Three
  complete human-readable answers cover the exact saved Tarot cards, Russian
  localized orientation/new follow-up choices and the exact Sun–Jupiter aspect.
  Reopening/retrying those answers does not generate again. A fourth response
  requested a read-only server tool; the next dispatch was correctly blocked by
  the four-call QA ceiling, producing a retryable error with no successful quota
  charge. This is NOT a passed real tool-continuation test.
- Additional two-call/$0.01 QA authorization and one final staging worker
  publication have been requested. The prepared worker has not been deployed or
  invoked. Production migration, merge and deployment remain blocked until this
  final real tool-continuation check passes.
- A read-only production snapshot covers 78 unchanged existing relations and
  39 unchanged functions, financial row hashes and the original $100 baseline.
  The two narrowly modified Luna tables are listed separately. No production
  DDL, data write, merge or deployment was performed by this checkpoint.

### Commercial and sharing limitations for the non-financial release

New prices, quotas, rewards, referrals and checkout remain OFF. Catalog, allowance
reservations/finality, annual monthly allocations, payment reconciliation and
referral evidence are prepared and isolated-tested; this is not activation
approval or proof of real Stars purchases. The proposed 3/2/1 daily reward adapter
and new reading-price activation still require a separately reviewed activation
configuration. Existing reward/pricing behavior is retained. Share cards currently
cover app/Tarot/garden/achievement; specialized natal and compatibility highlights
are not implemented. Export is not represented as proof of posting externally.

## Resolved final gate — 17 October 2026

The owner separately authorized two additional provider calls up to $0.01 and
one staging publication. Deploy `6ad2d681129ce740af5b4c3c` is Ready. The first
preflight stopped without a provider call because the earlier test boundary had
left a conservative $0.010007 hold. Source blob
`d998f90e75f01ac87a1c74774a1a1ba9a32a7b84` proves that exact fifth dispatch was
blocked before the underlying fetch. Only that specific staging QA attempt was
audited/reconciled to zero; its failed audit record was retained under a distinct
name. The same publication was reused, with no second deployment.

The final tool run passed 19 checks: `check_ai_quota` returned actual allowance,
the second provider turn produced a complete dream reflection with detached old
astrology, the answer persisted and reopening/retry generated zero new requests.
Additional actual usage cost: $0.0009719. Combined: six calls, $0.0060318, no
unknown spend. Staging generation/beta were restored OFF; money/rights unchanged.

Fresh tests: frontend 204 PASS; backend 397 PASS/one optional skip; isolated
PostgreSQL 43 PASS; mobile 8+24 cases PASS. Both type checks/lint pass.

Four immutable reviewed migrations were applied in production under the master
release authorization, versions 20261017020536 / 20261017020541 / 20261017020547 /
20261017020552. All 78 prior unaffected relations and 39 prior functions retain
their exact schema/ACL hashes. Existing user rows, paid rights, gardens, ledger,
payment records and the original $100 baseline are unchanged. All seven new
tables force RLS, all new functions are invoker-only/service-only, actual
anon/authenticated calls are denied and service-role reads succeed. New money
gates remain OFF. Existing 3.3 backend remains healthy before code rollout.

The source-bound predeployment PASS is `qa/luna34-release-review.json`.
Publication is not yet complete: build the gated artifact, merge the reviewed PR,
verify Railway, enable only non-financial verified progress, publish frontend once
and verify the public app. Do not describe predeployment PASS as live proof.
