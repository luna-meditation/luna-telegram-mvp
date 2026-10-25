# Core v1 / immersive My Cosmos release acceptance — 25 October 2026

This review continues the verified `7c8bdca` UX and `d689688` security candidate.
The owner's later production authorization supersedes the historical local-only
scope in earlier audit reports. Publication remains conditional on current gates.

| Capability | Current evidence |
| --- | --- |
| Compact Cosmos, progressive navigation, renewed typography | Chromium and WebKit, 360/375/390/393 px, EN/RU: 704 checks, 52 local screenshots |
| Animated atmosphere | Single persistent SVG starfield; reduced motion, lower-power mode, navigation, contrast and diagnostic light fallback checked in both engines |
| Interactive natal wheel | Existing Astronomy Engine calculations, ten planets, actual aspects, twelve sectors, touch selections and details; unknown time has no invented angles/aspects |
| Memory and portrait | Actual candidate HTTP → Supabase SDK → isolated hosted DB; pending/confirmed distinction, correction, stale revision rejection, relevant retrieval, deletion and consent revocation verified |
| Discoveries and Luna navigation | Actual save/list/rename/source-open/delete, replay protection, context persistence, RU opening and two-owner isolation verified |
| AI language/personality/interpretation | Historical 80-attempt exploratory comparison only; no new provider generation or blinded quality acceptance |
| Finance and existing content | All 687 protected hashes, including 33 backend financial modules, match the pre-Core baseline; existing synthetic payment callback/concurrency and entitlement checks retained |
| Production user data | No synthetic release fixtures or test financial operations created in production |

Security dependencies were patched narrowly: body-parser 1.20.9 and Zod 4.6.7.
Two explicit Zod record key schemas preserve prior behavior. Parser crash and
oversized-array validation regressions have dedicated tests. The full dependency
audit reports zero advisories. Railway's source-controlled start command now sets
`NODE_ENV=production`; model, quotas, wallet rules and financial flags are unchanged.

The already-applied sixteen-table least-privilege migration was rechecked rather
than replayed. All sixteen tables retain RLS and required server CRUD; excess
browser/column privileges are absent. Owner credential rotations and read-only
deployed API/SDK checks are recorded separately. The current encrypted recovery
copy covers 91 tables, 127 functions, 3,126 rows and 28 media objects. Two independent
restores compared data, ACLs, functions and RLS. No archive, key or customer row is
included in release reports.

## Known limits

- Automatic discoveries and broad cross-domain psychological synthesis are not
  accepted quality claims. Users explicitly confirm saved observations.
- Russian prose, unsupported inference and symbolic certainty still need human
  review. Old response samples do not prove final-source production quality.
- Full chat finalization still spans existing writes; no speculative transactional
  schema was added. Tested immutable retries and idempotent openings remain.
- Direct administrative deletion of a parent user with personal source rows can
  fail the pre-existing portrait-state FK trigger. No user-facing full-account
  deletion route exists. Supported memory/profile deletion passed; maintenance
  cleanup must remove owned source records first. A schema change is deferred for
  a separately reviewed migration. Staging test fixtures were fully removed.
- Shared-project default privileges for future objects and disabled Supabase
  leaked-password protection need a scoped follow-up. Current Luna access passed.
- Dark theme is the actual product mode. The light fallback is diagnostic.
- Physical iPhone/Telegram acceptance, power/thermal behavior and subjective live
  AI quality remain owner checks; desktop browser emulation is separate evidence.

## Controlled publication and rollback

1. Pass the new source-bound Core gate using fresh execution and recovery records.
   Historical Luna 5 receipts cannot approve this tree.
2. Publish the identical reviewed Git tree on a release branch, review its diff,
   and merge against the unchanged production head. Skip automatic Netlify builds.
3. Let the existing Railway backend configuration build that exact source once.
   Verify commit, startup, Telegram routing, signed auth, server-only DB access,
   model metadata and error logs before frontend promotion.
4. Upload the prebuilt production frontend to the existing Netlify site, verify
   its immutable URL/assets, then publish it once after backend acceptance.
5. Verify public URLs, assets, unauthorized API boundaries and the renamed bot's
   existing menu/webhook. Do not inject an offline Telegram bridge or QA fixture.

Railway rollback target: deployment `f3013f7b-2674-4443-820a-685ed1fba2df`, source
`e62b53ebf45a12bf15c81824058665b5de68bb24`. Netlify rollback target:
`6ad668c137e7e5aa2c7c5339`. Runtime code rollback does not require reversing the
compatible sixteen-table privilege correction or resetting user data.

This document records pre-publication acceptance. Deployment IDs, the exact live
commit and real production smoke results belong in the separate postflight report.
