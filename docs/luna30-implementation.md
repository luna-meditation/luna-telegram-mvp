# Luna 3.0 — integration and release gates

Baseline verified 2026-10-16: `c04f78c59f8a5bd5aaf394bb73d44e43d2808020`.
Development branch: `feature/luna-3-0-integration`.

## Reuse and current production audit

- React/Vite, shared EN/RU and theme tokens; three primary tabs, Telegram BackButton and measured bottom-nav/safe-area layout.
- Express backend verifies Telegram initData and exclusively owns service-role Supabase access. No frontend database credentials or OpenAI secrets.
- Existing personal-memory consent, relevant confirmed retrieval, private Tarot history, atomic reading reservation/cache and usage records remain authoritative.
- Existing playback proofs, rewards, garden purchases, original artwork and permanent Journey ranks are not replaced.
- Production model remains `gpt-5-mini`; Responses and strict structured output are supported. Owner approved at most two new neutral astronomy-related requests, total <=$0.02, using synthetic data only. None has been sent; the AI portrait path is not yet connected.
- All 8 meditations are published. Current free entries are Deep Sleep and Morning Clarity; adding a third free entry needs an explicit catalog change, not an accidental client-side entitlement bypass.
- Production schema includes the previously blocked security migration (applied 2026-10-14). Never reapply it as a new migration.
- Netlify checked 2026-10-16: 5.5 credits remain; 29 publications consumed 435 credits. A new 15-credit publication cannot proceed within the current balance. No build/deploy, plan change or top-up was initiated.
- Owner subsequently paid for Netlify. Rechecked: Personal plan, 1000 new credits through 2026-11-16 plus 5.5 prior credits; auto recharge disabled. Hosting credit blocker is resolved. Still no cloud publication has been initiated.

## Ordered implementation

1. Compact Home; conversational Tarot setup; breathing-circle controls, without payment/reward changes.
2. Deterministic private-by-default share-card renderer, preview/export and meaningful entry points.
3. Server-side commercial catalog/version policy and fail-closed rollout gates; preserve all legacy prices/entitlements.
4. Referral attribution/security and additive isolated migration; no live rewards until verified ledger activation.
5. Diverse progression and achievement consolidation with grandfathered ranks/unlocks; migrate only after preservation tests.
6. Deterministic astrology provider, timezone/location validation, calculation/report cache, compatibility. No invented charts or AI-derived coordinates.
7. Production readiness checks, fresh encrypted backup and restore proof for any migration, then one eligible consolidated release. Hosting credits must first permit publication.

## Non-negotiable gates

New Premium 500/30 days, optional annual 3500, seed packages, paid compatibility, Support Luna and referral rewards are proposals, not live offers. Current annual 750 and Lifetime 2499 remain unchanged. No real test purchases or silent quota/price reductions.

Swiss Ephemeris requires AGPL compatibility or a commercial license. Astronomy Engine offers an MIT-licensed deterministic alternative; accuracy, historical timezone resolution and independent fixtures still require validation before chart activation. A calculation engine alone does not validate a user-supplied city/timezone.

Birth data, third-person profiles, private questions and AI interpretations must never be auto-published. Sharing receives only explicit public fields, not entire database objects. No per-export image generation/API cost.

Any new database objects must be Luna-prefixed, RLS enabled/forced, service-role-only (matching Telegram server authentication), explicit invoker RPCs, empty search_path and narrowly scoped grants. Production data/other-app objects are outside development operations.

## Sources

- https://developers.openai.com/api/docs/models/gpt-5-mini
- https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
- https://github.com/cosinekitty/astronomy/blob/master/LICENSE
- https://www.astro.com/swisseph/swephinfo_e.htm

This is an execution log and release gate checklist, not a claim that all of Luna 3.0 is implemented.

## Verified development checkpoint

- Home, conversational Tarot, direct Home-to-chat entry, ring Start/Pause/Resume, optional ambient audio with device preferences and silent fallback, deterministic share preview/export for Tarot and garden implemented.
- 48 responsive Tarot cases and 16 Home/breathwork cases pass in both themes/languages at 360/375/390/393px. Audio playback is mocked; physical-device audio remains unverified.
- 161 frontend tests and 233 backend tests pass; one external RPC integration test remains opt-in. TypeScript/lint pass. Existing 17 isolated chat/database cases pass.
- Three migrations apply/reapply and pass 11 targeted cases on PGlite AND native local PostgreSQL with up to 20 concurrent connections. No production/staging migrations executed.
- New progression/achievement projection is connected to server profile and UI behind `LUNA30_PROGRESSION_ENABLED=false`. Rank writes retain the existing monotonic guard; no production rank or earned achievement has been rewritten. The 28 featured achievements use five families and keep earlier entries in an accessible archive. Large histories are paginated using timestamps only; bounded day samples decide rank thresholds, not lifetime activity statistics. Incomplete or extreme abusive histories fail closed to the legacy view.
- Astronomy Engine calculations, private chart cache, saved self/other profiles, mobile interactive wheel and deterministic synastry are connected in development behind existing disabled astrology gates. A licensed local snapshot resolves 34,165 cities, English/Russian aliases and historical IANA time zones without external birth-data queries. Nine Sun/Moon/Mars positions pass independent NASA/JPL DE441 comparisons within one arcminute. AI portrait/compatibility narratives and the Luna AI astrology adapter remain unavailable, not simulated.
- Proposed commercial catalog and quota/referral storage are disabled. New Premium/Stars/refund integration, seed-package checkout, admin economics, referral dashboard UI and complete progression rollout remain pending.
- Guided breathwork needs licensed/original EN/RU voice clips. It stays explicitly unavailable. No TTS API or paid generation was used.
- OpenAI requests: 0. Actual AI cost: $0.

Do not merge/publish this development checkpoint as a complete Luna 3.0 release.

## Second local verification checkpoint

- Optional birth data require explicit consent; the server accepts a city id, never client coordinates or timezone overrides. Unknown times produce no ascendant/houses/exact aspects; sign-boundary uncertainty is shown. Local times in DST gaps/overlaps are rejected instead of guessed.
- Verified self birth data project into the existing My Universe profile. Editing its free-text birth fields invalidates the verified self chart. Explicit privacy erase removes all owned birth profiles/derived caches even after astrology is switched off. An absent-RPC fallback is allowed only when the optional birth table is also absent; stale schema caches and permission/transport errors fail closed.
- Local database review now passes 14 cases on both PGlite and disposable native PostgreSQL, including concurrency, application isolation, old balances/Lifetime, privacy erasure and stale calculation revision rejection. The native fixture uses a DST-observing database timezone; referral monthly boundaries are explicitly UTC.
- Node 22: 163 frontend tests pass; 245 backend tests pass and one external RPC integration test is opt-in. Both TypeScript checks and lint pass. Existing 17 chat/database regression cases pass.
- Astrology UI: 16 mobile combinations pass at 360/375/390/393px in RU/EN and Dark/Light, including save/reopen/edit/invalidate/delete. These UI cases use the real compiled calculation engine with an explicitly local in-process data fixture, NOT Supabase persistence or a physical Telegram session. Database persistence/privacy have separate isolated PostgreSQL evidence.
- Preview: `http://127.0.0.1:56061/`; `frontend/scripts/phase2-preview.mjs --luna30`, after building backend. It is not a public iPhone/Telegram preview and never uses production Telegram initData.
- No production/staging migration, merge or deployment. No new cloud project, paid service, real purchase, payment-price change or balance mutation. OpenAI test cost so far: $0; the newly approved $0.02 allowance is unspent.
- Production release is still gated by completion of AI portraits, commercial/refund/admin integration, final progression preservation checks, fresh complete encrypted backup/restore evidence, final consolidated builds and device checks. Netlify credit shortage is no longer a blocker. Railway and Netlify connectors confirm OpenAI is configured but withhold its secret value; it has not been exported or copied to local code. A real test must use an appropriately protected server-side QA execution path after that path is implemented.

Public-data attribution: [GeoNames CC BY 4.0](https://www.geonames.org/export/), [NASA/JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html). City snapshot source hashes and column provenance are in `backend/data/geonames-attribution.json`; independent ephemeris reference URLs/hashes are in `backend/test/fixtures/jpl-horizons-reference.json`.

## Release preparation — 2026-10-16

- Five additive Luna-only migrations now cover referrals, private astrology, usage reservations, cached AI reports and the gated Stars lifecycle. All five apply/reapply against the exact restored production schema; transaction rollback and preservation of all 37 original tables, legacy RPCs/RLS/ACLs pass. Production migrations have NOT been applied.
- Fresh encrypted backup: 37 tables / 1,397 rows and 16 RPCs. Two isolated restores matched all data/security checksums. Separately encrypted media backup: 28 files, 239,528,218 bytes, all restored and hashed. Read-only preflight at 06:26 UTC found no data or schema drift.
- AI report service: seven portrait/five compatibility sections, explicit consent, owner-scoped cache, durable exactly-once claim, shared existing allowance, two reports/day and global cap, no automatic paid retries, consent recheck before save, no Moon Seeds charge. The existing AI chat can receive an owned calculated chart without an automatic send.
- Commercial server contour: versioned quotes, exact-once precheckout/receipts/Seeds, recurring monthly and prepaid annual periods, conditional entitlement reader, cancellation/refund review and admin actual usage metrics. ALL new sales, entitlement reading, quotas, referral rewards and Support remain OFF. Existing 750-Star annual and 2,499-Star Lifetime paths are unchanged.
- Activation limitations: new purchase storefront, included-reading/monthly-quota product wiring and referral dashboard still need a separate activation phase. No real Telegram purchase/refund/renewal was executed. Guided audio still requires licensed/original recordings. This release must not be presented as approval to enable new monetization.
- First real staging AI run: two successful responses, persisted/cached in EN/RU; cost from actual tokens $0.00320475. Human quality review found a wrong Moon sign in generated prose and a generic follow-up question. This run is NOT release approval. Fix: named calculated signs, v2 cache keys, exact facts retained in the deterministic chart, rejected technical restatements and generic invitations in generated report prose. Owner approved two additional neutral calls up to $0.01; corrected real QA remains pending.
- Mobile report layout adds 16 local fixture cases to the existing 80 responsive checks. These are browser/layout checks, not physical Telegram device proof. No production merge, deployment, payment change or balance mutation has occurred during this preparation.

### Production application / recovery plan

1. Require green Node 22 tests/types/lint/builds, corrected real AI quality/cache proof, current encrypted-backup checksums and two restore passes. Re-run read-only production inventory and migration dependencies immediately before DDL.
2. Record non-Luna table/function/RLS/ACL fingerprints. Apply only the five reviewed migrations, with all new monetization flags OFF. Recheck original rows, legacy entitlement/payment fields and unrelated schema fingerprints; verify service-only RLS/grants.
3. Enable only reviewed non-commercial runtime gates. Keep new Premium/annual/packages/paid compatibility/Support/quotas/referral rewards/entitlement-reader OFF. Merge via development PR, deploy backend first, verify exact source commit and auth failures, then one consolidated static production frontend artifact.
4. Recovery is feature-off first, not destructive down-migrations: disable new astrology/AI/progression/audio gates, retain private audit/ledger/history and existing rights. Stop on any data drift. The encrypted SQL archive is for restoration into an EMPTY isolated database and verified recovery of specifically reviewed Luna objects, never wholesale replacement of the shared production schema. No automated drop/reset of live tables, rollback to an unsafe Netlify deploy or deletion of charged audit records.
