# Luna 4.0 / Admin 4.0 — execution record

## Scope and release boundary

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

## Evidence status

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
  from real staging DB evidence. No physical4.0 iPhone confirmation yet.
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
