# Luna 2.5 release

Based on production main acac0ffc4680ea40092c6c77ffa2fd7723cef7f4.

Scope: three primary tabs (Home, Luna AI, Profile), four illustrated Home directions, supplied Moon Lake hero, compact daily card, native in-chat Tarot compositions (one, three, three plus two), queued first tap during image decoding, contextual accessible image zoom, explicit/neutral Russian grammatical address.

No database migrations, billing changes, balance changes, new models, new AI entitlements or paid reading activation. Existing disabled feature defaults remain disabled. Production 3/5-card AI remains owner-QA-only under the existing finite grant.

## Verification

Node.js 22: 153 frontend tests, 216 backend tests pass; one optional external PostgreSQL integration test is skipped. TypeScript, lint and both builds pass. The isolated database harness passes 15 checks including RLS/ownership, single generation, cached history, quota and wallet preservation.

48 local mobile UI scenarios cover 320/375/390/430 pixels, RU/EN, Dark/Light, one/three/five cards, native Back, keyboard-sized viewport, image loading latency, details and persistent reopening. These are fixture-based browser checks, not physical Telegram evidence or a new paid AI run. AI cost in this release: $0.

Run the existing offline preview with Node 22 and scripts/phase2-preview.mjs --luna24. Its historical flag name now previews current source. Run scripts/luna25-mobile-qa.mjs with PHASE2_PLAYWRIGHT_MODULE and PHASE2_CHROME_BIN configured. Only localhost is accepted.

## Production preflight and rollback

Target Supabase vkcdtasbdoeilgfucoax is read-only in this release. Existing encrypted backup captured 2026-10-15 11:46 UTC: archive checksum reverified; two independent PostgreSQL 17 restores previously passed. The backup predates the later QA-budget-only migration; that migration is not changed or rolled back here.

Record fresh schema/policy/function and protected-table fingerprints before/after release. Current migration remains 20261015121433. Never restore older user data for a code-only regression.

Rollback frontend to Netlify deploy 6ad0c5f209cda963175df6bb and backend to Railway deployment 1c2e8e2e-5ea5-413b-842f-ed9062d2de11 if a critical release regression occurs. Retain database data and payment configuration. Revert source via a reviewed PR before subsequent Git-driven deployments.

Merge through a feature PR using [skip netlify] to avoid a duplicate cloud build. Build exact merged main locally; upload once to site 55baedc0-02e4-45ad-a0d5-0bd76ef4ce97 with no functions. Railway updates only because server prompt/response handling changed. Verify Ready/SUCCESS, matching commit, static assets and unauthorized API rejection.

Before release: Netlify 66.3 credits, main-only branch builds, Deploy Previews disabled. One publish is expected to use 15 credits plus traffic. No staging release.

## Post-publication correction

The initial deploy 6ad0ec1a87c0da0af1551fbe reached Ready, but final screenshot review found the old Light-landscape CSS overriding the new hero heading/greeting foreground. The frontend was restored to the existing Luna 2.4 deploy 6ad0c5f209cda963175df6bb without a new build. The compatible server-only Russian address correction remains healthy at ebd196ae09e11ebe43de35aa47cefd8e0a7bc28c. Production data and permissions were verified unchanged.

The correction adds explicit Light-theme foreground selectors and a real computed-color assertion in all mobile cases. A further frontend publication requires separate owner approval; do not represent this release as complete while the old frontend remains active. One deployment consumed 15 credits; observed remaining balance is 51.3.

## Physical iPhone checklist

Fully close and reopen the production bot Mini App. Check Home, saved mood, all four directions, one free daily card reopening unchanged, RU/EN and both themes. In Luna AI select Tarot, intention and 1/3/5 cards; tap each sequentially once, inspect enlarged details, close using Telegram Back, discuss, switch tabs and reopen history. Check keyboard, safe areas, audio playback and subscription status without making a payment. Physical iPhone/WebView behavior must be confirmed by the owner.
