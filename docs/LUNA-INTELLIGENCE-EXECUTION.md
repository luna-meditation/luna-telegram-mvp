# Luna Intelligence 1.0 — execution ledger

## Boundaries and verified baseline

All four owner specifications received on 2026-10-18. Scope: actual chat actions, typed context/attachments, relevant authorized personal retrieval, conversational quality and embedded experiences; no unrelated UI redesign or changes to financial terms.

Authoritative repository: `luna-meditation/luna-telegram-mvp`. Remote main verified at `4774edf550ab81d10bc54682883cefad6b527859`, tree `4c37117965ef9f31729ab18ae49441573f15531e`; the local starting tree is identical. Work branch: `feature/luna-intelligence-1-0`. Existing unrelated local changes are preserved.

Production remains the released Luna 4.3 while development proceeds. Premium prices 500/week, 1000/month, 5000/year, 10000/Lifetime Stars; existing Seeds prices/ledger/entitlements, monthly $100 cap and user data are not changed. No real Stars charge or destructive production test is authorized.

## Verification checkpoint — 2026-10-18

- Implemented shared owner-bound action preparation, strict seven-type attachment renderer, embedded Tarot and the single canonical breathing session component. New flow and prompt remain opt-in by default. No database migrations.
- Node 22: frontend 256 PASS; backend 657 PASS / 1 optional SKIP; TypeScript and lint PASS. Native PostgreSQL: 17 legacy + 39 current financial/RLS/concurrency tests PASS, synthetic local data only.
- Fresh encrypted Luna-only snapshot at 08:06:15 UTC: 80 tables / 2272 rows, 84 functions, 1 view; two socket-only PostgreSQL restores verified exact rows, constraints, policies and grants. Restored plaintext databases removed after verification. All 28 avatars/meditations archives (239528218 bytes) decrypted and hash-checked; current Storage versions match. Other application's data excluded.
- Live read-only preflight at 08:03 UTC: all 108 shared public table/view definitions, 86 function definitions and financial fingerprints match the released 4.3 baseline. Railway still SUCCESS at 05089b08-3507-43de-bad3-88f35c41da26; main still 4774edf550ab81d10bc54682883cefad6b527859. Production writes: 0.
- Paired benchmark: all 150 decisions completed, identical per-case input hashes, 50 cases / 3 available models. Cost $0.1021413. Raw first-call tool matches: GPT-5-mini 37/50, GPT-4.1-mini 29/50, GPT-4o-mini 44/50; these are NOT end-to-end success or conversational-quality percentages. Every model has action/grounding failures. Keep GPT-5-mini; do not deploy a model switch based on tool-match alone.
- Real staging at 6ad47b7c5d4d688ffdb4b127: 1/3/5 cards selected, revealed, AI-interpreted, saved and reopened without provider calls; actual compatible reports/natal chart, confirmed memory filtering, signed QA Telegram auth, owner isolation, one elapsed breathing proof/reward, QA financial state all checked. Initial total 157 provider calls / $0.11363775, no unknown spend or held cost; normal staging generation restored OFF.
- Manual review caught a critical semantic regression missed by the initial smoke assertion: ordinary "help me choose a prototype step" was overwritten by legacy generic meditation routing. Fixed by scoping legacy heuristics, requiring relevant real action evidence and clearing explicit topic switches. False action acknowledgements now fail closed; explicit supported destinations and common meditation typos execute deterministically. Full tests repeated. A single necessary corrective staging publication will verify this fix, not rerun the 150-call benchmark.
- Local mobile: 16 measured EN/RU Tarot/breathing cases at 360/375/390/393 px PASS, plus reveal/zoom/reversed state and actual player opening. Fixture-backed browser QA is distinct from real staging storage tests. Current Dark-only production theme policy preserved. Physical iPhone/real microphone check remains manual.

Release remains blocked until the real corrected-topic smoke, final production build and PR checks pass. Never mark a feature verified solely from model text or a unit test.

## Coordinated work

| ID | Task | Status | Required evidence |
| --- | --- | --- | --- |
| A1 | Trace exact request, attachment, tool and UI lifecycle | IN PROGRESS | Code pointers and fixed failure scenarios |
| A2 | Central verified action registry and discriminated context/attachment contract | TODO | Owner-bound handlers, valid destinations, execution/ack/error tests |
| A3 | Unambiguous command routing plus structured tools for ambiguity | TODO | At least 40 realistic multi-turn regression cases; actual actions asserted |
| C1 | Unified consented relevant context from existing sources | TODO | Natal/compatibility/Tarot IDs, journal/history authorization, corrections/deletions, bounded source/freshness data |
| U1 | Embedded Tarot reusing current draw/reveal/history engines | TODO | 1/3/5, selection, reveal, zoom, persistence, interpretation/follow-up |
| U2 | Embedded breathing reusing current timeline/accounting | TODO | Start/pause/resume/stop/complete inside chat, no second timer engine |
| U3 | Existing real meditation playback and contextual commerce continuation | TODO | Language/access/player acknowledgment, explicit spending, resume once |
| P1 | Versioned personality, useful deterministic starters and title policy | TODO | RU/EN style/consent/cooldown tests; no render-triggered provider calls |
| Q1 | Fixed >=50-case identical-input model benchmark and real conversations | APPROVED / NOT RUN | 180 provider calls, combined $1, synthetic existing staging only; initial model preserved |
| Q2 | Node 22 tests/types/lint/build, mobile/keyboard/safe-area flows | TODO | Separate mocked/local and real server/provider evidence |
| R1 | Current backup/recovery, data/financial/RLS migration preflight | TODO | Freshness, isolated restore and non-destructive rollback checks |
| R2 | One coordinated production release after gates | NOT STARTED | PR, backend-first, one prebuilt frontend publication, exact live SHA and smoke |

## Initial verified root causes

- `ChatBreathing.tsx` currently renders a selector and dispatches navigation; it contains no working circle inside the chat.
- Existing `ChatTarotReading.tsx` can reveal saved cards, so it must be reused, not replaced by another draw engine. Creation/selection routing still needs a complete lifecycle review.
- Existing tools, navigation registry, typed outcome/idempotency and owner-scoped storage already exist; extend these rather than creating a competing action framework.
- The historical 4.3 symbolic context boundary only distinguishes `tarot` versus generic `astrology`; exact compatibility/natal discriminants must survive every hop.

## External documentation checked

Official OpenAI Structured Outputs and GPT-5-mini model documentation fetched; keep the current model as baseline. Supabase changelog reviewed: upcoming TLS cipher deprecation does not require changing Node 22/modern iPhone clients; no unrelated project upgrades. Server authorization/owner filters remain mandatory even with service-role credentials.

## Evidence and completion policy

Development checkpoint: Node 22 frontend 256/256 PASS; backend 653 PASS / 1 optional SKIP. Forty deterministic multi-turn action scenarios plus authorization/idempotency/typed-context tests pass. Sixteen browser UI cases (360/375/390/393 widths, EN/RU, Tarot/breathing) pass using isolated local fixtures, NOT real database proof. Screenshots and measured geometry: `/tmp/luna-intelligence-mobile/`. Corrected inherited six-column card positioning and full-page breathing styles; circle center error under 0.01 px and Stop remains above the composer. Five-card selection/reveal, reversed detail view, tab-return breathing pause/resume and real existing meditation-player opening exercised locally. Current production Dark-only policy is preserved, not relabeled as new Light support. Provider calls on this program so far: 0. Production unchanged.

No new SQL migrations are planned. New origin/action metadata is outside the existing strict Tarot-state object, preserving its old parser shape. New entry points/prompt are disabled by default behind frontend/backend `luna_intelligence` flags; prepared action history still uses the shared renderer. Existing prices, ledger and all accounting services remain authoritative. A finite private staging worker stores one durable 180-call/$1 budget and blocks ordinary QA API generations while temporarily testing real synthetic data; restoration is fail-closed. New secrets are not exported or added to client variables.

No feature is marked complete because a UI card or plausible answer exists. Distinguish implemented, locally tested, real provider/server verified, deployed and production end-to-end verified. Record failed gates and fixes; no repeated staging publication to test cosmetic work. Paid benchmark authorization is requested once separately; local work continues without waiting.
