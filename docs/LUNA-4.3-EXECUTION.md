# Luna 4.3 — execution ledger

Statuses: TODO, IN PROGRESS, VERIFIED, BLOCKED. A code change or invoice is not end-to-end evidence. Production remains 4.2 until the release gate is verified.

| ID | Priority | Task | Depends on | Status | Evidence / deployment |
| --- | --- | --- | --- | --- | --- |
| A1 | P0 | Audit actual source, live configuration, schema and costs | — | VERIFIED | `LUNA-4.3-AUDIT.md`; read-only baseline |
| V1 | P0 | Remove biased STT prompt; validate speech quality before provider | A1 | VERIFIED | Actual expected RU/EN words pass; generic verbatim cue, no product vocabulary |
| V2 | P0 | Reliable browser PCM capture, cleanup, editable transcript | V1 | VERIFIED desktop; device audition separate | Actual synthetic PCM bytes, no upload on cancel/permission race |
| C1 | P0 | Separate active topic, old attachments and authorized memory | A1 | VERIFIED | Real saved 1/3/5 readings, topic switch and selected calculated chart |
| C2 | P0 | Short initial Tarot/astrology answers; exact contextual navigation | C1 | VERIFIED | Real topic-switch intent is general_chat; chart shortcut is birth_profile, not old Tarot |
| C3 | P1 | Unified relevant personalization and layered bounded context | C1 | VERIFIED | Only confirmed relevant goal retrieved; pending city excluded |
| O1 | P1 | Optional deterministic Meet Luna inside actual chat | C1 | VERIFIED desktop | Existing seven-step atomic backend and real composer |
| O2 | P1 | Domain exploration in chat; birth reuse; settings memory controls | O1 | VERIFIED desktop | No duplicate personal storage |
| U1 | P1 | Home mood labels, Profile/Journey/library/breathing refinement | A1 | VERIFIED desktop | 16 combinations × two flows = 32 runs / 176 screen captures; 360/375/390/393, RU/EN; actual Dark |
| F1 | P0 | Apply explicitly approved new prices, preserve historical subscriptions/receipts | A1 | VERIFIED staging/native | 500/week, 1000/month, 5000/year, 10000/Lifetime Stars; no recurring new plan |
| F2 | P0 | Invoice/order/webhook/receipt/ledger/retry acceptance | F1 | VERIFIED native + staging invoices | New real Telegram invoices, no charge; receipt/refund races use isolated fixtures |
| F3 | P1 | Activate approved storefront, atomic spending, referrals/Admin | F2 | PREPARED | Package/deep actual stage debit/cache PASS; per-report paid compatibility remains unavailable |
| Q1 | P0 | Node 22 checks, backend/frontend tests, mobile browser flows | V2,C2,O2,U1,F2 | VERIFIED | Frontend 249; backend 604 (603 PASS, 1 optional SKIP); native 56; lint/types/build PASS |
| Q2 | P0 | Real staging model/tool/voice tests within approved new budget | Q1 | VERIFIED | 39 final checks; 21 Responses + 4 STT total, $0.045214, no unknown spend; earlier failed-quality calls included |
| R1 | P0 | Fresh encrypted backup and two isolated restore checks | Q1 | VERIFIED | Captured 2026-10-18 03:40:59 UTC; 79 tables/79 functions, 28 media objects |
| R2 | P0 | Staging financial/RLS checks and production schema preflight | F3,R1 | VERIFIED in production | Exactly two migrations applied; 107 existing public objects retain boundaries, 72 other function definitions unchanged; financial hashes exact; direct anon/auth RPC denied |
| R3 | P0 | Coordinated GitHub PR, Railway and Netlify production release | Q1,Q2,R2 | IN PROGRESS | Source-bound gate PASS; checkout stays closed until new backend and frontend are Ready |
| R4 | P0 | Live health/assets/features/version checks and final report | R3 | TODO | Distinguish deployed/enabled/verified payment |

Financial rule: activation is explicitly authorized by Part 6 and subsequent owner price decisions. New Premium: 500 Stars/7 days, 1000/30 days, 5000/365 days, 10000/Lifetime, prepaid without auto-renewal. Historical receipts/invoices keep their original prices and terms, existing rights/balances remain unchanged. Additional standard replies: 20 for 50 Moon Seeds; grounded personal analysis: 100 Moon Seeds, configurable in existing Admin/catalog. Provider test ceilings are separate from the production $100 monthly safety cap.

## Release and rollback sequence

1. Require the final stricter RU/EN real dictation and conversation checks. Do not publish after the first merely nonempty transcript test.
2. Recheck exact production project/main/schema against the saved snapshot and reviewed migration hashes. Keep unrelated application objects unchanged.
3. Apply only the two reviewed 4.3 migrations. Compare financial hashes, ACL/RLS, unchanged function definitions and unrelated objects immediately, while the old production code/catalog remains compatible.
4. Publish through the development branch and a PR (`[skip netlify]`); monitor the existing Railway service to Ready at the merged SHA. Automatic migrations remain disabled.
5. Enable the approved 4.3 catalog, four prepaid Premium products, existing Seeds packages, additional replies, grounded analyses and evidenced referrals. Preserve current earning rules/daily quotas, beta expiry and the $100 verified baseline. Do not enable the unwired paid-compatibility flag.
6. Build locally with the current source-bound evidence, then one prebuilt Netlify production publication. Verify public versions, routes, assets, auth rejection and health. The payer performs any actual Stars charge.
7. Fix-forward rollback closes new checkout/product/referral gates; retains accepted receipts, entitlement reader, purchased grants, balances and saved results. Do not restore stale balances, drop data or publish old code over new paid records.

Production migration hashes: `d088de24cd9b50b2022c8022c0ae202031a61a3a354df726238b8cac1dbbd6d3` and `1df08a51d66da29a278a5bae98b35a818b8067702b4182698447862222634b5a`. The production backend still ran 4.2 during the immediate permission/read smoke: playback/AI reads and closed purchase RPC passed under service_role; anon/authenticated direct reads and purchases failed despite forged claims. No QA production record, balance debit or provider request was created.

## Measured economics, not payout assumptions

The full 4.3 test envelope consumed $0.045214 by actual token usage rounded conservatively to microdollars: 21 Responses requests and 4 transcriptions, including the early inadequate Russian result. The final grounded analysis cost $0.001683. Final short synthetic dictation: English $0.000122, Russian $0.000149. Reopening saved readings, analyses and transcripts caused zero provider requests.

At the audited production chat mean ($0.001123/request before this release), 8 daily replies every day is about $0.27/month in provider cost; 40 daily replies is about $1.35/month. These are arithmetic scenarios, not demand forecasts; tool continuations and output length vary. A 20-reply package is approximately $0.0225 at that mean, excluding voice/other operations. The shared $100/month guard remains authoritative and unchanged. Actual Telegram settlement, taxes and net USD per Star are unavailable: contribution margin cannot honestly be stated as cash revenue. New quotas or cash conversions were not invented.

Four existing-site QA publications were needed for the source candidate, shared-quota fix, removal of an old two-reading QA safety cap and final voice/context correction. All builds ran locally. The last CSS readability fix was verified locally and does not trigger another staging publication. Provider budgets were never reset. No new project, paid plan or top-up setting was created.

Final iPhone checklist after publication: close/reopen normal Luna; verify RU persistence and My Cosmos; record a short clear RU/EN phrase and edit before Send; cancel a recording; open saved 1/3/5 readings without new generation; inspect Membership prices; open a Stars invoice and cancel unless intentionally paying. The payer, not automation, approves any actual charge.

## Scope limitations to retain in the final report

- A separate 100-Seed compatibility report checkout is not functional yet; existing calculated/entitled compatibility is preserved. Its unused flag must remain OFF.
- Individual meditation sales have no approved catalog item; Premium library access remains the supported route.
- Voice means editable dictation, not persisted audio messages or a real-time call. iPhone microphone/permission/route changes still need a device audition.
- Current Luna remains Dark-only under both system preferences. The desktop matrix is not a physical-device claim.
- Netlify builds are local; publication credits still apply. No new project, tariff or top-up configuration is created.
