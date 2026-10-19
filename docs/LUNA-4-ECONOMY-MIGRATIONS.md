# Luna 4.0 completion — additive database review

`20261019082034_luna4_deep_delivery_contract_fence.sql` — staging only,
SHA-256 `07c91ba5489d54eaef89cf1ed0e1433913fcff076210eb11515a8d1ab8753a3c`.
Native chain: 140 passed. New purchases are tagged without any backfill. New
positive-Seed deep reports require the same completed global operation as
included/portrait products; the legacy RPC delegates for these tagged orders.
Historical positive purchases keep their original delivery rules. Rollback
pauses new sales, retains immutable tags and exact owned recovery. Never weaken
the finality fence for an already confirmed new-contract purchase. Post-stage
checks: zero historical tags, unchanged wallet/ledger hashes and permissions,
catalog 4.3 and normal generation off.

Additional staging-only migrations:

| File | SHA-256 | Verification |
| --- | --- | --- |
| `20261019075214_luna4_paid_compatibility_delivery.sql` | `ea85a3610b2617a99db73162b63b95abb78f140cb0bba6b773e92d9193844624` | Native report/lease/refund/ownership races; no new staging purchase |
| `20261019075640_luna4_active_catalog_admin.sql` | `f226f7932e33730c2943e747805ac0fcbcde7c5a83fcba57146570d3af67d6ed` | Native audited CAS/idempotency, no activation; zero staging edits |

Full current chain: 135 native checks passed. Compatibility reuses existing
wallet, journal, owner-bound report jobs/cache and global AI cost guard. It
does not reserve an extra ordinary-answer quota. Ready saved scope returns
before a debit; failed processing restores its exact original Seed provenance
once. Replay and public RPC/RLS denial are tested. Rollback closes only NEW
sales/paid-compatibility gate while preserving already purchased delivery,
recovery and saved reports. Active Admin edits require an already verified
cutover; disabling that endpoint cannot delete/alter original paid terms.

Latest additive referral migration: `20261019074337_luna4_qualified_referral_contracts.sql`,
SHA-256 `6a2c05d5916737dfeb89c66765e82ecd445c3f8909dfbb57e255f5c4c3fb9bd8`.
Applied staging only after 125 native checks; replay and rollback are tested.
Existing wallet/ledger/referral digests and all active flags are unchanged.
New contracts/opaque claims have forced RLS and service-only access; no
historical payment timestamps are backfilled. Rollback disables new referrals
and rewards, retaining original invitation contracts, actual earned ledger,
and anti-replay tombstones. Refunded referral-purchase bonuses are flagged
for review, never silently debited from purchased/historical balances.

These are reviewed foundation migrations, not activation of the new economy.
Production `vkcdtasbdoeilgfucoax` has not been changed by this program.
Only existing staging `funvzpmpbgazsisehiru` was changed.

| File | SHA-256 | Applied |
| --- | --- | --- |
| `20261019031355_luna4_private_portrait_snapshots.sql` | `1e407767ab242bcb9be545692eb6e5d2c099aee113bf45cd6b5f1a8ccd6548e3` | staging |
| `20261019042844_luna4_seed_provenance_and_order_terms.sql` | `eb2e2f68f202b2e17e4e43731945415adf9309743cb44ad550fd162b74ce9c15` | staging |
| `20261019042913_luna4_reviewed_economy_draft.sql` | `b90897e343b70e7818be531fcdd88dbe0e7298815189a267c9b0008d81a65a09` | staging |
| `20261019044116_luna4_portrait_retry_privacy.sql` | `689fb28402918af1730997775f8c5e5e29995c5ecbfa6bb427a09d067cfaaa3e` | staging |
| `20261019050015_luna4_new_order_contracts.sql` | `1102592c957032832b783fcb5b14ceba0f1654b9a7ed58218ccd6dbc088e9918` | staging |
| `20261019051606_luna4_contract_allowances.sql` | `d19f606eec16d4501b962e97f5d57a54aab46f29e0233717e0d2bf17e40fbf16` | staging |
| `20261019053329_luna4_personal_product_delivery.sql` | `f9094cd49845f3e94d1dae88c97dd99745c74e6b1d147514954a1753b4229053` | staging |
| `20261019055639_luna4_verified_daily_rewards.sql` | `fb68723f999bccd736662c8d5e0442116613c1eb7302ce660a98b45555ac59c3` | staging |
| `20261019060130_luna4_introductory_message_scope.sql` | `cf9125da5114ca21d7f9f488b67056e9a3c8b57a28b461e81ffce568c3f81ea4` | staging |
| `20261019061314_luna4_included_tarot_access.sql` | `6ed3d65e64bb6a881b11072afc0863e2282983ab53fde34c333abc8c5e0d2a94` | staging |
| `20261019064156_luna4_daily_and_reading_orders.sql` | `3fc6787b0213b5327243069a0cff3acfe6e231de456f841896435a6549ffd393` | staging |
| `20261019065455_luna4_checkin_utc_evidence.sql` | `e863725a90a0b5f9710764ed09a60ce6632292804512cf0084740ccbc7940076` | staging |

The connector assigned application-time versions to the later migrations.
Uncommitted local filenames were aligned to those exact versions; SQL bytes and
hashes were unchanged. Do not reapply under the earlier local creation timestamps.
The first migration's explicit staging history repair is documented separately
in `LUNA-4-PORTRAIT-MIGRATION.md`.

## Scope and legitimate callers

- Portrait: existing Telegram-authorized universe routes, real confirmed sources,
  deterministic calculations, no wallet or provider call at Explore opening.
- Seed provenance: existing `luna_seed_ledger` journal writers. Every audited
  existing writer locks its wallet row before inserting; the Admin-adjustment
  trigger runs after its parent wallet mutation. The new journal follows that
  row-before-projection order, not an extra inconsistent advisory lock.
- Legacy Garden writes have no unified ledger entry. A deferred trigger observes
  the final wallet total and records exactly one forward adjustment only if no
  existing journal explains it. It does not rewrite balance, earned total, owned
  elements, old transactions or payment records. Unknown sources stay unclassified.
- Immutable order terms are additive sidecar records of an owned pending order.
  No historic invoice is given fabricated terms. Repeat identity returns the same
  snapshot; changed identity/amount/owner is rejected.
- NEXT catalog uses new columns in `luna34_commercial_settings`, not a second
  wallet/catalog authority. `luna4_update_next_catalog` writes only the next draft
  plus existing `luna40_admin_audit`. The authenticated Admin API additionally
  requires financial-write permission and enabled financial mutations. No draft
  endpoint accepts an activation flag. Fixed Premium prices cannot be edited.

New orders atomically snapshot their prepaid amount, quantity and finite
Premium benefits. The existing receipt engine still fulfills already accepted
historical invoices at their original amounts after sales pause. No recurring
terms are inferred for an unknown/new catalog. New Lifetime is a finite monthly
benefit contract, not automatically a historical unlimited entitlement.

The contract quota adapter reuses `luna30_usage_reservations` and
`luna40_quota_grants/uses`. It requires the actual global operation lease before
holding a benefit, and verified output from that same lease before consuming it.
Extra standard messages are owner-bound chat overflow, not Tarot/report credit.
Weekly and 30-day terms have one whole-term allocation; annual and new Lifetime
reset on UTC monthly anniversaries. Current Public Beta and historical paid
promises take precedence. These routines do not enable the new catalog.

Personal products reuse `luna43_seed_purchases`. New `funding` metadata and a
reference to the existing benefit reservation distinguish an included deep
analysis from a Seed purchase; they do not create a second wallet. The last
included benefit is held atomically and never silently falls back to a charge.
The comprehensive portrait is a distinct 200-Seed candidate product, using
at least two permitted source areas and five substantive connected chapters.
Delivery saves source/input/interpretation versions and a reference to the
actual calculated source. Reopening is read-only. Failed delivery restores
the original Seed split or included benefit exactly once.

The two historical deep-analysis entrypoints keep their positive-Seed branch.
Zero-Seed included records delegate to the new verified finality path so an
older caller cannot bypass the benefit journal. Preflight SHA-256 of the old
claim and finish definitions matched schema metadata in staging:
`53fc1f393acc02c0f9a0617d479aabbce5f16052fad0cad06ffd79b10c49b45b`
and `a7fff945d90a2d2db60111029b460d42865e23d0762784918213fb07d6d19ffb`.

Welcome rewards use an opaque HMAC identity tombstone, not a second identity or
wallet. A new account after a verified cutover may receive 80 promotional Seeds
and ten standard replies once; deleting and recreating its profile cannot repeat
the grant. The private random HMAC key is neither exposed to clients nor logged.
Daily rewards require a real owned check-in created on the server's current UTC
date. The seventh consecutive actual check-in day grants one ten-Seed bonus per
seven-day period. Client dates, duplicate requests and other owners cannot mint
rewards. New-policy playback/breathing still records progress but does not mint
the retired unbounded legacy free rewards. No historical reward is reclaimed.

The introductory-message scope fence also covers the pre-existing Beta overflow
allocator: these replies can fund standard chat only, not Tarot/astrology/deep
reports. Old unspecified Admin gifts keep their historical broader scope. A held
grant is rechecked against its real owner and operation type. This fence changes
no global monthly cap, generation flag or existing grant amount.

All new private tables have forced RLS, no public/anon/authenticated access and
only narrowly granted service-role rights. New routines are SECURITY INVOKER;
public/anon/authenticated execution is revoked. The original service-role server
boundary and Telegram identity are reused. No other application's objects change.

## Evidence

Native PostgreSQL loaded schema-only production metadata, not user rows. 31 checks
cover apply/reapply, owner isolation, forged-role claims, concurrent cache saves,
old-source retries, immutable terms, ledger-before/after-wallet order, multi-row
rewards, old Garden actions, mixed concurrency, exact-origin refund and rollback.
Old accepted invoices still fulfill at the original stored price/quantity, once.

The expanded native run `/tmp/luna4-allowance-native-db2.json` has **57 passing
checks**, including all four new invoice terms, twelve duplicate receipt
callbacks, month-end/leap-year windows, immutable benefits after catalog edits,
last-benefit races, operation finality, standard-message overflow and exact
failure release. Provider receipts in this isolated test are explicitly
synthetic finality fixtures, not real provider execution proof. Staging retains
catalog `luna-4.3`, `luna4_activation_verified=false`, no cutover and normal
generation disabled. Public grants/new SECURITY DEFINER count are both zero.

Expanded personal delivery evidence: `/tmp/luna4-products-native-db2.json`,
**68 passed**. It adds duplicate purchase/claim callbacks, exact charged-price
refund, included benefit recovery, saved delivery and old-entrypoint bypass
denial. Its migration creation filename was aligned to connector version
`20261019053329` after application; SQL hash is unchanged. Actual staging
postcheck found zero new portrait/included purchases and no public grants or
new SECURITY DEFINER routines. Real provider delivery is still a separate gate.

Expanded rewards/scope evidence: `/tmp/luna4-rewards-native-db4.json`, **87
passed**, including duplicate welcome races, account deletion/recreation, actual
server UTC check-ins, weekly reward bounds, retained progress with retired free
rewards, standard-message scope and real global-cost reservation with explicitly
synthetic provider receipts. No external AI/payment calls were made by this test.
Both migrations were then applied only to staging. Read-back confirms catalog
`luna-4.3`, new activation false, cutover null, normal generation false and no
anon/authenticated access to the scoped allocator. No welcome reward was issued.

The included Tarot access adapter reuses the original drawing/reservation engine.
It reads new finite three-card benefits but holds them only after a real global
cost lease, before provider dispatch. Paid selections stay attached to their
original order; the pre-provider status is correctly `entitled`, not `consumed`.
Only result settlement consumes the order. The chat reveal state now retains
the actual paid order ID instead of dropping it before the last card reveal.
Old paid terms and the existing Beta are preserved. Native expanded evidence is
`/tmp/luna4-tarot-native-db.json`: **96 checks passed**. It includes the genuine
SQL paid-status lifecycle, last-three-card benefit races and saved read-only
reopening. These synthetic provider receipts are not real AI quality proof.
Staging read-back confirms the added RPC is INVOKER, service-role only; catalog
and activation/generation settings are unchanged and disabled for the new policy.

### Daily delivery and discovered staging dependency gap

Daily access now uses an explicit price quote and the existing owned reading
order/wallet/ledger. Opening a card does not debit; generating at a positive
price requires separate consent and exact expected price. One daily order per
server UTC date prevents duplicate spending. New 1/3/5 Seed prices come from
the active catalog, while accepted old orders keep their original amounts.
Successful daily consumption requires the saved result and actual settled global
provider operation. Failure or deletion before delivery restores the original
promotional/purchased/unknown split once and fences late output. Reopening never
draws or generates again. Current Beta/legacy/pre-cutover daily rights are free.

Preflight found staging lacked eight historical Luna 2.1 routines plus
`luna_daily_cards` and `luna_payment_fulfillments`; production already has them.
The full old migrations were NOT blindly reapplied because they would change
existing staging table ACLs. A narrow schema-metadata-only repair is saved at
`backend/test/sql/luna4-staging-dependencies.sql` (not in production migrations).
It recreates only the missing objects, checks existing definition hashes before
reapplication and grants new objects service-role access only. Applied in staging
as `20261019064126_luna4_staging_restore_verified_luna21_dependencies`.

Native PostgreSQL `/tmp/luna4-daily-native-db6.json`: **108 passed**. It reproduces
the actual gap, applies repair twice, preserves pre-existing restricted ACLs and
all old rows/settings, then checks confirmed daily delivery/refund/cancellation.
Receipt tests now use `luna34_fulfill_order`, the actual normal backend entrypoint,
not only its inner engine. No synthetic proof is called a real payment/provider.

Staging repair + daily migration were followed by exact comparisons: existing
table ACLs/RLS and settings unchanged; wallet, ledger, order and payment digests
unchanged. New order terms count zero, all new entrypoints service-only/INVOKER.
The new catalog remains inactive and normal staging generation remains false.
Rollback keeps immutable order terms, refund source links, daily tombstones and
accepted invoice rights; close only new checkout/callers, never restore stale
wallets. Do not apply the staging repair to production or replay old migration
files there simply because their application timestamps differ across projects.

UTC boundary review additionally found a legitimate local-day row edit could
lose today's server-day reward. A private server INSERT/UPDATE event now records
only owner, UTC day and source ID, never mood text or client dates. It does not
backfill historical rewards. Actual server days support the seven-day evidence;
changing the phone date cannot manufacture them. Native evidence is
`/tmp/luna4-calendar-native-db2.json`: **113 passed**. Stage preflight matched the
old reward definition hash `328eb4f48bbf7ab5156d791a9e5da17c1c123cdc8523045902f2707a10f54486`.
One connector request expired before execution; read-back confirmed absence,
then one retry succeeded. Staging postcheck: zero calendar events, catalog 4.3,
new activation false, normal generation false, no public read/execute. No ledger
or balance adjustment occurred. Retain evidence/ledger on rollback; pause rewards.

Staging independent SQL checks confirm forced RLS and no SECURITY DEFINER; one
old synthetic portrait operation returns `source_changed` after source deletion.
Staging synthetic finance command also verifies promotional-first debit, exact
refund, old Garden spending, immutable owner-bound terms and one audited draft
revision. It creates no real invoice/payment and invokes no AI. Two clearly named
synthetic finance QA accounts are retained for inspection; no real account changes.

## Rollback plan (non-destructive)

1. Keep checkout/new-economy activation closed. Do not reset existing flags/Beta.
2. Roll back the new UI/server adapter as needed; keep source privacy invalidation
   and the retry privacy fence. Old history remains readable.
3. If provenance causes a verified regression, remove ONLY
   `luna4_seed_source_journal` on `luna_seed_ledger` and
   `luna4_wallet_journal_reconciliation` on `moon_gardens` in a reviewed transaction.
   Retain all balances, projection/evidence tables and rows. Reconcile subsequent
   untracked movement explicitly before re-enabling; never label it purchased.
4. Disable/revoke only the new NEXT-catalog mutation endpoint if needed. Retain
   its immutable audit/draft. Never copy it over the active catalog as a rollback.
5. Never drop financial tables, restore stale balances, delete legitimate receipts
   or rewrite current entitlements. Verified receipts must still settle once.
6. For rewards, disable only the new reward feature/configuration before reverting
   callers. Retain opaque welcome tombstones, source ledger and grant scope fence;
   never replay welcome gifts or turn introductory replies into paid-report credit.

Before production application: refresh exact schema/dependency/ACL preflight,
verify a current encrypted backup and isolated restore, complete all remaining
runtime delivery/grandfathering tests and prepare the exact old/new object diff.
These foundation tests alone do not authorize declaring the new economy complete.
