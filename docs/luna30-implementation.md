# Luna 3.0 — integration and release gates

Baseline verified 2026-10-16: `c04f78c59f8a5bd5aaf394bb73d44e43d2808020`.
Development branch: `feature/luna-3-0-integration`.

## Reuse and current production audit

- React/Vite, shared EN/RU and theme tokens; three primary tabs, Telegram BackButton and measured bottom-nav/safe-area layout.
- Express backend verifies Telegram initData and exclusively owns service-role Supabase access. No frontend database credentials or OpenAI secrets.
- Existing personal-memory consent, relevant confirmed retrieval, private Tarot history, atomic reading reservation/cache and usage records remain authoritative.
- Existing playback proofs, rewards, garden purchases, original artwork and permanent Journey ranks are not replaced.
- Production model remains `gpt-5-mini`; Responses and strict structured output are supported. No paid model tests or model changes authorized for this increment.
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
- New progression/achievement projection is prepared and unit-tested, not yet connected to the production UI/state. No rank or earned achievement has been rewritten.
- Astronomy Engine calculations and synastry are implemented and unit-tested, but location verification, full UI/report integration and independent ephemeris validation are still pending. No fabricated charts are exposed.
- Proposed commercial catalog and quota/referral storage are disabled. New Premium/Stars/refund integration, seed-package checkout, admin economics, referral dashboard UI and complete progression rollout remain pending.
- Guided breathwork needs licensed/original EN/RU voice clips. It stays explicitly unavailable. No TTS API or paid generation was used.
- OpenAI requests: 0. Actual AI cost: $0.

Do not merge/publish this development checkpoint as a complete Luna 3.0 release.
