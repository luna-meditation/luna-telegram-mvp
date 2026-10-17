# Luna 4.0 / Admin 4.0 — execution record

## Scope and release boundary

Owner follow-up on 2026-10-17 now explicitly authorizes production publication
after the release gates. This is not permission to bypass failed checks, spend
outside the fresh 4-provider-call / USD0.03 staging allowance, activate new sales,
change prices, or modify existing balances/paid rights. New paid services are not
introduced. Financial Admin mutation activation remains OFF for this release.

Sources: owner attachments `f1133b9b…` (all four Admin parts, 2,748 lines) and
`4122a84b…` (Companion parts 2–4, 1,421 lines), read completely on 2026-10-17.
Companion Part 1 was supplied in the owner's follow-up and read in full; the complete
eight-part program is now available. Routine development and existing staging are authorized. Production
release is conditional on **all** security, data, P0 and end-to-end release gates.
No new financial activation, pricing/quota change, live purchase/refund or paid
AI/ElevenLabs generation is authorized by this specification.

## Verified baseline

- Repository: `luna-meditation/luna-telegram-mvp`, GitHub main
  `13939525e72557378e18268602a709c895bbebd3`.
- Active checkout `/private/tmp/luna22-production.rDLVPb`, source-equivalent local
  HEAD `9f7ac44d331586856dce12b961a7511b61917ea3`; local history is preserved.
- Development branch: `feature/luna-4-0-intelligent-admin`.
- Production Netlify `55baedc0-02e4-45ad-a0d5-0bd76ef4ce97`, deploy
  `6ad2f4ea29b5bc7983e3958e` Ready.
- Railway backend `c7a1c804-16f4-4e0c-a5c8-88794eaecac9`, deploy
  `8bf07b55-6ed2-471e-abd2-1b048be8da48` Online, no pending work or issues.
- Production Supabase `vkcdtasbdoeilgfucoax` (shared, PG17.6); staging
  `funvzpmpbgazsisehiru` (PG17.11). Read-only schema checks performed, no row
  contents downloaded. Existing security migration is applied, not blocked.
- Existing staging site `luna-staging-itfl`, QA bot
  `@luna_staging_qa_eger_bot`; data access requires signed Telegram and QA allowlist.
- Existing unrelated dirty QA files/old preview folders preserved and excluded.

## Architecture audit

React18/Vite6 frontend; incremental navigation in App.tsx with Telegram BackButton,
safe-area and player state. Express backend on Node22/Railway; service-role Supabase
client behind Telegram HMAC authentication. Deterministic astronomy-engine2.1.19
calculations, private persisted Tarot/astrology/chat artifacts, per-owner memory,
and bounded OpenAI Responses tool loop already exist. Reuse these systems.

Admin currently lives inside App.tsx, eight horizontal tabs, mostly English-only,
three duplicate Back to Luna controls and all-user browser analytics. Admin identity
is verified server-side against configured owner ID; legacy grant endpoint directly
edits user access, with no separate grant/audit history. Staging deliberately blocks
all `/api/admin`; selectively enabling the new owner-authorized staging admin must
not expose old mutation endpoints or connect staging to production.

Dashboard sources already include users/history/payments/check-ins; Luna32 provider
attempts record tokens/cost reservations and settlements; Luna35 funnel records
minimal idempotent events. Historical missing events must remain unavailable, not
zero or reconstructed guesses. Moon Seeds source is authoritative ledger plus
garden balance; commercial gates are OFF. New admin mutations require independent
grants, transaction-safe RPCs, audit and server RBAC before UI activation.

### Confirmed P0 findings

1. `refreshAccount` overwrites manual locale with asynchronous `users.language_code`.
2. Telegram `upsertUser` writes Telegram language into the same legacy column.
3. Tool execution returns inconsistent result shapes; no durable UI acknowledgment.
4. Existing admin UI duplicates exit navigation and loads full directory for stats.

## Dependency-aware implementation

1. P0: account-scoped Auto/RU/EN preference with revision-aware synchronization;
   typed tool execution outcomes and owner-bound UI acknowledgment; regression tests.
2. Grounded source references, compatibility modes/versioned symbolic scoring,
   specific follow-ups and readable reports using existing saved contexts.
3. Single-timeline breathing audio, honest missing-voice catalog, garden previews,
   mobile dialogs and performance (no paid assets without permission).
4. Admin shell + read-only aggregated metrics/paginated directory first; RBAC/audit;
   separate entitlement grants and atomic ledger/quota tools; CMS/support/settings.
5. Full Node22 tests, native PG17 integration, existing staging end-to-end checks;
   current encrypted backup + isolated restoration before any production migration.
   Production unchanged until all gates pass; incomplete work is not a release.

## Operational implementation checkpoint (2026-10-17)

- Added an owner-bound, idempotent SQL operation/audit boundary; atomic wallet
  adjustments share the existing wallet lock and preserve earned totals. Every
  operation requires reviewed input, reason, confirmation and a stable request ID.
- Separate expiring/Lifetime gifts, revocation, eligible restoration and optimistic
  extension; existing paid rows are never overwritten. All entitlement readers
  remain unchanged while the new mutation switch is OFF.
- Additional AI answers use expiring grants and per-operation holds. Two provider
  calls hold one grant; failure releases only that hold, success consumes one;
  revocation affects only unused allowance. The original global cost reservation
  is wrapped, not replaced. Commercial allowances are not reset or changed.
- Explicit role assignment/revocation is implemented behind the same closed
  mutation gate. No roles are seeded and the configured owner is immutable.
- User workspace has operational activity, paid sources, independent gifts,
  wallet adjustments, AI operations, payment records and audit tabs. It does not
  load private chat content, journals, personal memory or birth data.
- Meditation CMS reads the real catalog; creates/duplicates drafts; validates
  metadata and permitted media; previews files; publishes/archives into the same
  meditation table; preserves immutable versions; restores metadata as a new
  reviewed version. Upload paths are unique and never overwrite original assets.
- Seven other content collections support editorial drafts only. Their runtime
  adapters are not verified, so publication is deliberately rejected, not faked.
- Support uses existing tickets plus an additive workflow/priority/notes overlay;
  closed maps to legacy resolved without widening legacy constraints. Notes are
  internal and never sent to users. Refunds/broadcasts are unavailable.
- Operational analytics expose server aggregates for tools, UI observations,
  provider costs, authoritative wallet events and referral states. Unknown data
  is unavailable rather than zero; client playback observations never grant rewards.
- Settings shows current safe flags/model and an actual database probe; provider
  connectivity is not inferred from key presence. All secret values stay server-side.
- Old Admin writes and the old garden developer balance/reset endpoint are
  blocked when Admin4 is enabled, avoiding bypass of the new audit boundary.
- Structured chart tools prepare the actual chart card/selector. One unambiguous
  self profile uses the existing deterministic cache. Birth details/positions are
  not included in this new tool output; AI interpretation still requires consent.
  A new astrology action clears stale meditation card metadata.
- Compatibility now has explicit romantic/business/friendship/family context,
  persisted in chat attachment/workflow state and isolated report cache keys.
  Server-only versioned symbolic index uses calculated aspects and transparent
  weights; unknown birth time or insufficient evidence yields no numeric index.
  Compatibility reports exclude unrelated personal goals/preferences by default.
- Future garden season concepts reuse clearly labeled existing Luna art, remain
  Coming soon and never reset progress or enable purchases. Verified RU/EN voice
  clips are missing; Guided stays unavailable. A cue contract shares all nine
  existing elapsed-time phase definitions; no second timer or generated audio.

### Verification / not a completion claim

- Node22 backend: 479 passed, 1 optional skip in the latest complete run;
  frontend: 226 passed before adding the new release-gate test.
- Native PostgreSQL: 29 passed, including reapply, RLS/grants, forged claims,
  rollback gate, concurrency/idempotency, wallet, gifts, quota, roles and CMS/support.
- Mobile browser: 131 checks at 360/375/390/393/1440 in RU/EN, with synthetic
  API fixtures. This is not new physical-iPhone or real-provider evidence.
- `20261017070223_luna40_admin_operations.sql` applied ONLY to existing staging
  after dependency checks. User/garden/payment/runtime hashes were identical.
- Fresh production backup: 63 tables / 1,876 exact rows / 60 functions, encrypted
  before transfer and restored twice with full rows, constraints, ACLs, RLS,
  indexes and triggers verified. Temporary plaintext PostgreSQL removed afterward.
  Storage verification and real staging AI smoke still pending at this checkpoint.
- Four fresh staging provider calls / USD0.03 authorized; none spent yet.
- Production source, schema, configuration and deployments still unchanged.
- Remaining release gates: fresh media integrity, full final source tests/builds,
  consolidated staging runtime/persistence/provider check, final mobile review,
  reviewed production migration postflight, and source-matched release evidence.

## Evidence status

### Final release validation in progress (2026-10-17)

- Fresh encrypted recovery proof is complete: 63 Luna tables, 1,876 rows,
  60 functions and 28 media files (239,528,218 bytes), two isolated restores.
- First live staging smoke passed 22 technical checks with two real provider
  calls costing USD0.00253325. Replays/history made no additional provider calls;
  balance, paid rights and garden fingerprints stayed exact. Generation was
  closed again in the finally block.
- Independent response review found stale breathing metadata after a successful
  chart tool. This is a release blocker despite the original smoke's PASS. The
  executed astrology action now authoritatively resets the active topic, pending
  practice state and unrelated model actions. Four regression tests were added.
- Follow-up uses only the remaining two calls of the original four-call/USD0.03
  approval, in the same existing staging conversation; no new budget is inferred.
- Latest backend suite: 483 passed, one optional skip. Production remains
  unchanged until the follow-up and final evidence gates pass.

### Independent quality gate after the follow-up

- Four authorized provider calls are now used. Actual aggregate cost is
  USD0.00340510; unknown spend is zero. Saved-result retries/reopening used zero
  additional calls. Staging generation was restored to closed afterward.
- The second run passed the technical state/persistence checks but independent
  review rejected its visible answer: the old generic card guard mistook an
  actual astrology card for a nonexistent meditation card and replaced the text.
- Corrected the guard to accept an artifact scope only from the authorized,
  executed astrology tool. Unrelated meditation/player claims are still rejected.
  Added RU/EN regression tests; latest backend is 487 passed / one optional skip.
- Frontend 227 passed; both lint/type checks and optimized builds passed. Current
  mobile checks: 131 Admin cases, 120 existing-commerce/astrology cases, and
  24 general mobile scenarios covering 192 screen states. Theme preferences
  correctly resolve to the current deliberately dark Luna presentation.
- Real staging SQL: all 12 new tables have FORCE RLS, no anon/authenticated
  table/RPC privileges; four actual denied calls including forged service claims,
  service-role reads and aggregate reports passed inside a rollback transaction.
- Production preflight at 07:57 UTC: all 60 old function definitions/ACLs match
  the fresh backup; 63 baseline Luna tables present, zero Luna40 tables. A hash
  snapshot of 162 unrelated public relations plus their policies/constraints/
  triggers/functions was saved for the eventual postflight. The existing USD100
  runtime budget and its baseline are unchanged.
- **Release remains blocked** until the final text guard is checked against the
  real staging provider. Requested two more calls within the SAME USD0.03 total,
  not an additional monetary budget. No further provider calls are authorized
  until the owner answers. Production migration, configuration, main, Railway
  and Netlify production have not been changed.

### First implementation checkpoint (not the complete release)

- Auto/RU/EN: owner-scoped cache, optional safe legacy-cache adoption, shared
  external React state, serial CAS writes with stable request IDs, bounded conflict
  retry and offline pending selection. Profile refresh never changes locale.
- Tool envelopes distinguish completed reads, selection requirements, requested
  navigation and failures. Operation IDs bind owner + turn + arguments. Private
  telemetry excludes result data, prompts, questions and birth information.
- Meditation UI reports card rendering, player opening and the actual HTML audio
  `playing` event separately. Acknowledgments require the owner-bound saved message
  and correct meditation reference; they grant no quota, rewards or entitlements.
- One unambiguous `self` birth profile opens without a redundant confirmation.
- Lazy Admin4 shell: exactly nine localized sections, desktop sidebar, mobile
  keyboard-accessible drawer and one exit. Real read-only server aggregates, UTC
  range filters, bounded directory search/sort/pagination and access overview.
  Other modules are explicitly incomplete, not simulated.
- RBAC foundation: configured owner plus explicitly assigned roles; no automatic
  assignment. Analysts cannot access identities/settings; financial operations are
  unavailable. The unsafe legacy access overwrite route is blocked when Admin4 is on.
- Admin4 is OFF by default. Staging-only enablement does not unblock legacy admin
  mutations, payments, uploads or webhooks.

### Database changes

Three reviewed additive migrations prepared and applied **only** to staging:

1. `20261017051755_luna40_language_preferences.sql`
2. `20261017052134_luna40_action_observability.sql`
3. `20261017052535_luna40_admin_read_foundation.sql`

Four new FORCE-RLS tables; four service-only SECURITY INVOKER functions. No existing
objects are changed. Native13-check PG17 review covers reapply, CAS races, owner
isolation, forged JWT claims, direct client RPC denial, metric semantics and safe
rollback. Actual staging tests verified service-role aggregate execution, CAS and
client denials; test preference writes were rolled back. Existing user/payment/
garden hashes and old function/security hashes match before and after.

### Executed verification so far

- Node22.23.3: frontend224 PASS; backend420 PASS + one existing optional SKIP.
- Both TypeScript checks and frontend lint passed.
- Backend build and optimized real-staging frontend build passed. Admin workspace
  is split into a lazy chunk (~18.8KB / 7KB gzip), not loaded for ordinary users.
- Native PostgreSQL17:13 PASS. Actual staging database verification PASS.
- Browser UI:111 PASS, RU/EN, widths360/375/390/393/1440; actual React late-profile
  race and reopening check included. Synthetic browser data is explicitly separate
  from real staging DB evidence. Physical foundation-checkpoint iPhone review was
  subsequently confirmed by the owner (see the publication record below).
- No paid AI/ElevenLabs calls, no cloud build, no production mutation/deployment.
- Pre-deployment artifact inspection caught the generic frontend `_redirects`
  taking precedence over staging TOML. The staging-only packager now writes
  explicit QA API rewrites before the SPA fallback; no production proxy is used.

Staging migration history versions: `20261017053823`, `20261017053827`,
`20261017053831`. Supabase security advisors report only INFO-level no-policy
notices on the four new tables: intentional deny-all for Data API client roles;
only the authorized server service role uses these objects. Adding permissive
client policies to silence [this notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
would weaken the boundary. Direct denial tests passed.

### Remaining release blockers

The complete program is **not release-ready**. Required next work includes the full
intent/action pipeline and UI acknowledgments beyond meditation, grounded report
references and40-scenario evaluation, compatibility modes/scoring, synchronized
breath cues and garden season previews, independent entitlement/ledger/quota
administration, CMS publication/versioning/uploads, support, complete analytics and
settings. Real AI evaluation needs a new owner-approved finite test budget.
Production needs a fresh encrypted backup including current Luna35 objects and
verified restore before any migration. Do not publish this partial checkpoint to main.

### Follow-up: Netlify authorization and tool replay safety

- The owner renewed Netlify CLI authorization. CLI status confirms the existing
  `luna-staging-itfl` link and authenticated Luna team access.
- New Functions-only variables were rejected by the Netlify API with HTTP403:
  `Upgrade your Netlify account to set specific scopes`. The owner explicitly
  approved All scopes for only `FEATURE_ADMIN_V4`, `ADMIN_TELEGRAM_ID`, `COMMIT_SHA`.
  These were saved and read back only on `luna-staging-itfl`; no tariff or secret
  changes were made.
- Provider duplicate tool requests now share one in-flight read and one outcome
  within a turn. Stable operation IDs canonicalize JSON whitespace/key order;
  array order and values remain significant. A new turn does not reuse old data.
- Three additional replay regression tests and backend TypeScript passed. The full
  backend run reports 423 passed (including one existing optional skipped test),
  zero failures. Two localhost-listener tests initially hit sandbox EPERM and passed
  when the local-only suite was rerun with localhost permission.
  No paid AI calls or production changes were made.

### Existing staging publication — verified foundation checkpoint

Exactly one prebuilt publication, without a cloud build, completed successfully:
`6ad313000cdd5505ad63f75a`, Ready, published `2026-10-17T06:17:49.769Z` at
<https://luna-staging-itfl.netlify.app/>. The runtime health and exact served frontend
asset hash confirm source `92060b6b00a3dc5239c80ebb27e543b7f7acf98c`. This is the
previously prepared foundation artifact; the follow-up replay-safety change above
is still local, verified, and not included in this publication.

18 live external smoke checks passed: health, static build identity, real Telegram
SDK, unsigned/forged Telegram401 denials, legacy-admin/payment/webhook403 denials,
and no public QA/provider reports. The published shell was opened in the real
browser at360/375/390/393px: no horizontal overflow or broken loaded images.
EN switching and persistence after reload passed; RU restored afterwards. Screenshots
are `/tmp/luna40-staging-home-390-full.jpg` and `/tmp/luna40-staging-home-393-en.jpg`.
The owner subsequently confirmed on a physical iPhone through
`@luna_staging_qa_eger_bot`: Russian survives closing/reopening the app,
Admin Dashboard and Users open, and bottom controls are not obscured. This validates
the published foundation checkpoint only; no synthetic successful login was used.

Read-only staging SQL confirms `generation_enabled=false`, `public_beta=false`,
`cost_baseline_verified=false`; existing environment switches and old QA budget
rows were not changed. No provider request was made. Main production remains Ready
on the unchanged deploy `6ad2f4ea29b5bc7983e3958e`. The full4.0 program remains
incomplete and must not be represented as production-release ready.

### Local AI action-reliability follow-up (not deployed)

- Added a strict `recommend_meditation` tool that can select only a real validated
  published catalog entry. The model now receives actual catalog IDs alongside
  titles, precise durations and audio language; no audio/storage URLs are sent.
  The schema follows the fetched [official OpenAI strict-mode contract](https://developers.openai.com/api/docs/guides/function-calling#strict-mode):
  every input is required and extra arguments, including a forged owner, are denied.
- A successful server selection binds the existing message/card metadata even if
  the final model prose omits or contradicts its legacy `meditationAction` field.
  An earlier ambiguous rank with no selected ID cannot override the tool's exact
  verified selection; this priority is covered by the integration contract test.
  One turn cannot choose conflicting tracks; duplicates share the same operation.
  Unknown/unpublished/malformed items cannot become UI actions. Existing effective
  Premium, paid and Lifetime access is reused, not recalculated or changed.
- Selection produces a typed meditation reference and honest access state, never
  claims playback. Common false claims that the audio/player already started are
  replaced with an accurate user-action instruction; locked cards do not promise
  free playback. Deterministic recommendations are also included in private tool
  outcome telemetry. Device acknowledgments remain the separate existing pipeline.
- Node22 final follow-up: backend437 executed PASS + one existing optional SKIP
  (the compact reporter reports438 including the skip), frontend224 PASS,
  both TypeScript checks and frontend lint PASS, backend and optimized real-staging
  frontend builds PASS. Fifteen new selection/claim tests plus three earlier replay
  tests cover the added behavior. No new dependency or migration is required.
- RU/EN misspelling cases use explicitly scripted tool responses. They verify
  execution/metadata, not live LLM intent accuracy. A finite authorized real-AI
  evaluation remains necessary. Existing artifact-topic detach logic is preserved;
  broader semantic topic switching and the rest of the full4.0 program remain open.
- No additional cloud publication, paid API request, data migration, financial
  mutation or production change was performed in this follow-up. The iPhone-tested
  staging stays on `6ad313000cdd5505ad63f75a` / source92060b6.
