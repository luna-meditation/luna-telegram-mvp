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

Corrected-topic smoke PASS on staging 6ad481099906610d12d9be22, runtime source 508a9bbbc4768cd0241cadefe58be205bbbc71eb. The ordinary response now addresses the prototype rather than a meditation menu; typo recommendation, support navigation and honest unsupported-file response reuse saved results with zero provider calls. Finite worker closed; 43 real checks PASS, 158 provider calls total, $0.1144434 actual usage cost, held/unknown cost 0. Normal staging generation restored OFF. The 150-case decision set was not rerun or relabeled as 150 end-to-end conversations.

Final Node 22 checkpoint: frontend 256 PASS; backend 657 PASS / 1 optional SKIP, zero failures; lint/type checks/backend build PASS. Source-bound release evidence is generated locally at `qa/luna-intelligence-release-review.json` (Git-ignored), requiring exact project IDs, current backup, all real staging results, unchanged money/data and no migrations. Production Netlify profile explicitly selects Intelligence; CLI publishes a prebuilt verified artifact, not a synthetic preview. Auto development builds are restricted to main and PR previews are disabled; release commit also skips automatic Netlify builds.

## Coordinated work

| ID | Task | Status | Required evidence |
| --- | --- | --- | --- |
| A1 | Trace exact request, attachment, tool and UI lifecycle | VERIFIED | Generic wellness keyword override and stale context fixed; actual operation IDs/statuses retained |
| A2 | Central verified action registry and discriminated context/attachment contract | IMPLEMENTED / TESTED | Owner-bound handlers, seven discriminants, destinations, failure checks |
| A3 | Unambiguous commands plus structured tools for ambiguity | IMPLEMENTED / TESTED | 40 multi-turn deterministic fixtures plus real typo/navigation/topic regression |
| C1 | Consented relevant context from existing sources | IMPLEMENTED / TESTED | Exact report IDs/pair/kind; confirmed memory only, bounded owner retrieval and privacy boundary |
| U1 | Embedded Tarot using existing engines | VERIFIED STAGING + LOCAL UI | Actual 1/3/5 persisted/reopened/generated; browser selection/reveal/zoom |
| U2 | One canonical breathing timeline/accounting | VERIFIED STAGING + LOCAL UI | Start/pause/resume/stop; real elapsed proof completes and rewards once |
| U3 | Real meditation + existing commerce | VERIFIED WITH LIMITS | Actual catalog card and local player opening; isolated financial concurrency tests, no real Stars charge |
| P1 | Modular personality, starters and title policy | IMPLEMENTED / MEASURED | RU/EN, consent/cooldown tests; possible verbosity remains documented |
| Q1 | 50-case paired model benchmark and actual dialogues | COMPLETE / REVIEWED | 150 benchmark + 8 smoke calls, $0.1144434, no model switch |
| Q2 | Node 22 and responsive checks | PASS | 256 frontend / 657 backend, 1 optional SKIP, 16 measured browser cases; physical phone remains manual |
| R1 | Backup/recovery, data/financial/RLS preflight | PASS | Fresh 80-table encrypted backup, 2 exact restores + 28 media, no migrations |
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

## Safe release / rollback

1. Check unchanged remote main, production site/backend IDs, schema/grants and current $100 cap. Preserve all secret values and financial flags. Merge reviewed development PR only after final build passes.
2. Set only `FEATURE_LUNA_INTELLIGENCE=true` and `AI_PROMPT_VERSION=intelligence-v1` on the existing Railway service, without a separate redeploy; the merged main build supplies code. Startup migrations remain disabled.
3. Wait for Railway SUCCESS, exact merged commit, health and real authentication guards. Build the frontend locally on Node 22 against that verified API; publish once to the existing production Netlify site. No provider/QA worker is bundled in the production frontend.
4. Verify Ready, source SHA, assets, public UI/mobile, auth failures and unchanged financial/schema fingerprints. Real device/microphone and an authorized real payment remain separate manual evidence, not implied by public health checks.
5. On a critical regression stop rollout. Restore Netlify deployment 6ad450bed9bfe88a4f7e9b85 and Railway deployment 05089b08-3507-43de-bad3-88f35c41da26; set the new flags off/legacy prompt. No SQL down-migration or user-data restore is required, and no balances/history are deleted. The verified encrypted backup is disaster recovery only, never an automatic overwrite of live users.
