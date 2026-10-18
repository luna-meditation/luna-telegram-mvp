# Luna 4.3 — execution ledger

Statuses: TODO, IN PROGRESS, VERIFIED, BLOCKED. A code change or invoice is not end-to-end evidence. Production remains 4.2 until the release gate is verified.

| ID | Priority | Task | Depends on | Status | Evidence / deployment |
| --- | --- | --- | --- | --- | --- |
| A1 | P0 | Audit actual source, live configuration, schema and costs | — | VERIFIED | `LUNA-4.3-AUDIT.md`; read-only baseline |
| V1 | P0 | Remove biased STT prompt; validate speech quality before provider | A1 | IN PROGRESS | Not deployed |
| V2 | P0 | Reliable browser PCM capture, cleanup, editable transcript | V1 | TODO | Real recorded fixtures + browser lifecycle tests required |
| C1 | P0 | Separate active topic, old attachments and authorized memory | A1 | TODO | Multi-turn RU/EN regressions required |
| C2 | P0 | Short initial Tarot/astrology answers; exact contextual navigation | C1 | TODO | No fabricated tools or calculations |
| C3 | P1 | Unified relevant personalization and layered bounded context | C1 | TODO | Reuse consent, memory and chart adapters |
| O1 | P1 | Optional deterministic Meet Luna inside actual chat | C1 | TODO | Reuse existing atomic seven-step backend |
| O2 | P1 | Domain exploration in chat; birth reuse; settings memory controls | O1 | TODO | No duplicate personal storage |
| U1 | P1 | Home mood labels, Profile/Journey/library/breathing refinement | A1 | TODO | Mobile widths 360/375/390/393, RU/EN |
| F1 | P0 | Apply explicitly approved new prices, preserve historical subscriptions/receipts | A1 | IN PROGRESS | New 500/week, 1000/month, 5000/year, 10000/Lifetime Stars; native tests PASS |
| F2 | P0 | Invoice/order/webhook/receipt/ledger/retry acceptance | F1 | TODO | No real charge without payer confirmation |
| F3 | P1 | Activate approved storefront, atomic spending, referrals/Admin | F2 | TODO | Unpriced items individually unavailable; no invented prices |
| Q1 | P0 | Node 22 checks, backend/frontend tests, mobile browser flows | V2,C2,O2,U1,F2 | TODO | No cloud builds for intermediate cosmetic checks |
| Q2 | P0 | Real staging model/tool/voice tests within approved new budget | Q1 | IN PROGRESS | Approved 40 provider calls + 8 synthetic STT, combined maximum $0.50; none spent yet |
| R1 | P0 | Fresh encrypted backup and two isolated restore checks | Q1 | TODO | Luna-only, includes relevant Storage |
| R2 | P0 | Staging financial/RLS checks and production schema preflight | F3,R1 | TODO | No unrelated app objects changed |
| R3 | P0 | Coordinated GitHub PR, Railway and Netlify production release | Q1,Q2,R2 | TODO | Only after critical gates pass |
| R4 | P0 | Live health/assets/features/version checks and final report | R3 | TODO | Distinguish deployed/enabled/verified payment |

Financial rule: activation is explicitly authorized by Part 6 and subsequent owner price decisions. New Premium: 500 Stars/7 days, 1000/30 days, 5000/365 days, 10000/Lifetime, prepaid without auto-renewal. Historical receipts/invoices keep their original prices and terms, existing rights/balances remain unchanged. Additional standard replies: 20 for 50 Moon Seeds; grounded personal analysis: 100 Moon Seeds, configurable in existing Admin/catalog. Provider test ceilings are separate from the production $100 monthly safety cap.
