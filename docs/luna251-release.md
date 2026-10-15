# Luna 2.5.1 — release review

This is a code-only refinement from production main `56199e8849e342921dbf15f387d6838156eeabe8`; production backend was `ebd196ae09e11ebe43de35aa47cefd8e0a7bc28c`.

## Scope

Compact chat controls; optional Tarot tools; one main conversation scroller; explicit card inspection; saved reveal/completed state; collapsible detailed interpretations; contextual continuation in the same conversation. Standalone readings attach their existing saved assistant response without a provider request, synthetic user turn, quota reservation or wallet mutation. Retries use stable attachment IDs. Removed duplicate legacy details from standalone spreads.

AI keeps the existing model, authorization, quotas, consent-based memory and version-2 JSON schema. The prompt targets 100–160 visible primary words for multi-card readings and bounded optional detail. Three/five-card token ceilings decrease to 2200/3000. Central-chat replies use the selected language unless the user explicitly requests another language. Historical content is never rewritten. Tarot results are not offered as factual personal memory.

Home preserves the artwork, three tabs and four illustrated categories. Copy distinguishes a personal question from the one-saved-card daily ritual. No prices, payments, subscription rights, balances, garden assets, practice algorithms, feature entitlements or secrets change.

## Local evidence

Node.js 22.23.3: 157 frontend tests; 218 backend tests pass, one external-PostgreSQL opt-in test skipped. Both TypeScript and lint checks pass. Backend compilation and frontend bundling pass. Seventeen isolated PostgreSQL/RLS/auth/idempotency tests use synthetic identities and a mocked provider, not production data. Forty-eight mobile cases cover 360/375/390/393 px, both languages/themes and all spread sizes; eight additional standalone attachment cases pass.

Same 390×844 fixture: header 113→61 px; primary interpretation 1724→577 px EN, 1796→656 px RU, with full details still available. Total loaded JS in this local fixture 652802→654398 bytes (+0.24%); DOM nodes 217→210. These are controlled UI measurements, not physical-device or network-speed claims. Cards use existing responsive assets, not 78 eager downloads. No real AI requests: $0.

Local preview: `http://127.0.0.1:56052/` (explicit synthetic UI fixtures). Start with Node 22: `PHASE2_PREVIEW_PORT=56052 node scripts/phase2-preview.mjs --luna24`. It is not a Telegram production or staging backend. Database evidence is separate from the preview.

## Checkpoint and rollout

Netlify Ready checkpoint `6ad0f0427d944f91e89ce3a8`; Railway SUCCESS `cf7c4ca9-11b3-40e5-8daf-33e6daa3c06c`. Existing encrypted 35-table backup from 2026-10-15 11:46 UTC has intact checksum and two independent restore passes. It predates QA-budget-only tables and is not claimed as a fresh full backup. No migration is required and no production data restore is part of code recovery.

Merge through a PR with `[skip netlify]`, verify Railway backend-first deployment, build exact merged SHA locally with `luna251` profile, then upload once to the existing linked production site. No staging, branch deployment or cloud Netlify build. Production Git CD remains configured; a later unskipped main push can replace a manual artifact. Final publication must match merged main.

On failure before publication, stop and keep current frontend. If a published regression occurs, stop further rollout, preserve data, and fix forward with a narrowly reviewed revert/correction. Never restore old database data for this code-only release. Netlify skill prohibits restoring an older deploy directly. At preflight 20.9 credits remained; owner explicitly approved a single 15-credit release with approximately 5.9 remaining and accepted insufficient reserve for another publication. No top-up/plan change is authorized.

## Physical iPhone checklist

In the normal Luna bot, close the old Mini App and reopen it. Luna AI → More → New Tarot reading → intention → 1/3/5 cards → optional question. Tap cards once; check reversed labels and View larger; close with Telegram Back. Read takeaway, expand details, use a contextual follow-up, then fully close/reopen and restore the conversation via History. Repeat RU/EN and Light/Dark. Check keyboard/input and edge gestures. From standalone saved Tarot use Discuss with Luna: the saved reading should appear immediately without an extra user message. Do not make real purchases for this check.
