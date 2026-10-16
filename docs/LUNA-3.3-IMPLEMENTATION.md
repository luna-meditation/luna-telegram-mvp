# Luna 3.3 execution notes

Base: production `c2dc4adbeab51fc34bafca7111aee711a7037b37`.
Development branch: `feature/luna-3-3-ux-intelligence`.

## Ordered gates

1. Diagnose current runtime failures using sanitized production diagnostics.
2. Repair provider-stream ownership, manual drafts and deterministic practice routing.
3. Reuse owner-scoped astrology caches and chat metadata for inline workflows.
4. Make recommendation metadata, actions and consent explicit and truthful.
5. Refine compatibility reading hierarchy and the existing Home glass CTA only.
6. Run Node 22 tests, types, lint, builds, mobile browser flows and isolated database checks.
7. Verify bounded real staging AI behavior and data persistence; no synthetic production authentication.
8. Fresh recovery/preflight, source-reviewed PR, backend-first release, one production frontend publication when every critical gate passes.

## Observed cause, not speculation

Production Railway deployment `c92c9468-14c1-4ef4-b40d-11ba1db24986`
reported `Body is unusable: Body has already been read` at
`callOpenAiResponses` on 2026-10-16 14:58:33 UTC. The cost transport had
already inspected provider usage. The fix gives this boundary sole ownership
of the provider stream and returns a fresh readable response to consumers.
The exact runtime reason the prior clone became disturbed has not been
independently reproduced; the observed exception and the repaired ownership
contract are covered separately. No automatic paid regeneration was added.

Other audited defects: chart-entry effects overwrote the user's composer;
compatibility actions navigated to a generic external screen; breathing
requests could be routed to an audio meditation; English "meditation for
sleep" did not match the immediate sleep goal. Real catalog audio language
was not shown on chat cards.

## Data and privacy boundaries

- No new database schema is needed: workflow state is in existing
  `ai_messages.metadata`, calculations in existing chart caches.
- Telegram authorization, owner filters and existing forced RLS stay intact.
- Workflow operations do not call AI, payment, wallet or reward services.
- A stored workflow cannot be silently retargeted after its calculation.
- AI chart consent is exact-chart scoped in owner-authenticated conversation
  metadata; a context reset revokes its reuse. Personal-memory permission
  remains separate. Unconfirmed/sensitive memory rules are unchanged.
- Standalone report permission is cached only for the current signed session
  and exact chart/language scope; saved reports always load before generation.
- Production prices, subscription rights, balances, quotas, beta end date and
  the approved prospective $100 monthly safeguard must remain unchanged.

## Verification evidence

Results are added only after executing checks. Local fixture browser tests
are not evidence of real Telegram auth, Supabase RLS or physical-device behavior.
Any live QA must use the existing staging project and a finite call/cost ceiling.

## Executed verification (2026-10-16 UTC)

- Node 22.23.3: frontend 199/199, backend 325 passing + one default opt-in
  skip; that legacy RPC test separately passed in isolated PostgreSQL 17.
- Isolated PostgreSQL: 17 foundation checks and 15 budget/RLS/concurrency/
  recovery checks passed. No production schema or data writes.
- 76 mobile flow variants passed at widths 360, 375, 390 and 393 (EN/RU),
  plus cached-chat failure/reopen checks. The current dark-only product
  behavior is retained for legacy Light/System preferences.
- Two real staging answers (RU/EN) used 3 provider calls including one
  read-only tool continuation: $0.00320285 actual usage; no further provider
  calls in the final 30-check verification. Exact calculated Mercury signs,
  persisted results, replay, explicit consent, context reset and 1/3/5-card
  history passed; staging configuration and financial state were restored.
- Staging exposed a Russian catalog bug: translated/blank titles erased
  canonical recommendation metadata. Canonical identity now remains in the
  deterministic ranker; visible titles fall back only to real catalog text.
  A test-only provider guard prevented the unintended call. Its conservative
  staging hold was reconciled to zero using the exact durable QA evidence;
  no production ledger or balance was changed.
- Fresh encrypted recovery: 53 tables, 1,570 rows, 37 functions, all RLS,
  constraints and ACLs; two isolated restores including portable encrypted SQL.
  28 Storage archives (239,528,218 bytes) decrypted and hash/version checked.
- Owner's three original MP3 files are copied without modification or
  re-encoding, loaded only on selection. Home order, compact CTA, hide/pause/
  stop controls and no player over chat passed actual browser playback tests.

See `qa/luna33-release-review.json` for machine-readable gates. No physical
iPhone test was performed for 3.3; background audio and Telegram keyboard
behavior still need an owner-device check after publication.

## Production recovery strategy

No schema rollback is necessary for these additive message metadata fields.
The prior frontend and backend versions ignore them. If a published frontend
has a critical regression, create a reviewed forward-fix/revert commit and
publish that artifact; a failed, unpublished deploy leaves the old site live.
Railway can return to the recorded backend deployment when necessary. Never delete customer
messages, reset balances, or remove purchased entitlements during rollback.
