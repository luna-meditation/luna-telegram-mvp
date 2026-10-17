# Luna 3.5 — execution and release evidence

## Verified starting point (17 October 2026)

- Repository: `luna-meditation/luna-telegram-mvp`; production main `57f615338d2bd1b45bb724e4174d8943cfde2cef`, tree `e3b0e7456985b2b8537acd781a07829ea36901ba`.
- Development: `feature/luna-3-5-conversational-commerce`, same starting source tree. Pre-existing unrelated QA edits/preview directories are preserved.
- Netlify production `6ad2d9e681b8d64834ccac83` Ready; Railway `57d5dce2-0db1-4ad7-844a-5171e39390f2` SUCCESS, main source, no staged settings.
- Supabase production `vkcdtasbdoeilgfucoax`, existing staging `funvzpmpbgazsisehiru`. Latest production migration `20261017020552`; old security remediation is applied, no longer blocked.
- All Luna 3.4 financial settings OFF; zero new orders/receipts, one historical payment. Existing paid/Lifetime rights unchanged.
- Public Beta expires 2026-10-31T16:00:00Z. Preserve the $100 prospective accounting baseline 2026-10-16T14:47:46.492834Z. No automatic financial transition.

## Reuse / gap analysis

| Area | Existing state | Work for 3.5 |
| --- | --- | --- |
| Stars | Server orders, precheckout, receipt fulfillment, refunds, cancellation, annual allocation; disabled and no real transaction verification | Reuse, harden recovery and expose honest per-product availability |
| Wallet | Existing garden balance + append-only ledger + atomic mutations | Reuse; show real earning rules rather than proposed rewards |
| Quotas | Shared successful-generation counter, receipt-based allowance reservations, retry/cache protection | Deterministic quota/commerce UX without extra provider call |
| Commercial catalog | 3.4 target catalog, all approval/checkout gates OFF | One backend source, no changed live prices |
| Referrals | Opaque codes, verified new-user/activity/onboarding qualification; disabled | Preserve gates, Profile entry, destination-aware invitations |
| AI | Authenticated tools, bounded context, max two provider calls | Read-only commerce tools and native cards; no model-executed charge |
| Pending purchase action | Missing durable commerce continuation | Owner-scoped persisted identity/parameters, expiry and replay protection |
| Bot | Working @lunameditation_bot; outdated meditation-only copy/menu | Approved existing artwork, localized welcome and supported deep links |
| Sharing | App/Tarot/garden/achievement export | Add opt-in natal/compatibility privacy-safe cards |
| Notifications | Consent, local time, claim-once delivery exist | Neutral product-wide wording; no unsolicited test sends |

## Execution order and gates

1. Backend orchestration and narrowly scoped persistence; synthetic database/concurrency/security tests.
2. Inline chat commerce, exact quota information, pending-action continuation.
3. Central deep-link routing, premium bot onboarding, referrals and privacy-safe sharing.
4. Membership/mobile/RU/EN regression checks on Node 22.
5. One consolidated staging publication; verify real persistence and signed Telegram access. New paid AI tests require a fresh finite budget (previous budgets exhausted).
6. Fresh encrypted Luna-only backup and isolated restore before any production migration; source-bound release evidence and PR workflow before safe code publication.

## Financial activation boundary

Deployment is not activation. Do not enable Stars sales, change prices, change paid entitlements, change balances, or activate new quotas/reward rules. No real Stars transaction is authorized by this specification. Real payment, renewal, refund, and fulfillment must remain explicitly unverified until owner-authorized tests pass. Target 5/day and 300/billing-month are not the current live quotas while their gates are OFF.

Status: safe non-financial release verified; code publication pending. NOT READY FOR COMMERCIAL ACTIVATION.

## Mid-implementation verification

- Both additive migrations are installed ONLY in staging. Commerce migration live staging version `20261017032221`. The pre/post fingerprints of all old public functions, relation RLS/ACLs, paid rights and wallets matched exactly. Production unchanged.
- Native PostgreSQL: 43 existing economic/payment/referral/security checks plus 13 new commerce/funnel checks pass. New tables force RLS; all new functions are invoker-only and service-role-only.
- Owner granted at most **3 provider calls and $0.02**, staging only, neutral QA context. Actual usage: **2 calls, $0.00142435** from real token usage; unknown spend zero. Model `gpt-5-mini-2025-08-07` invoked `get_earning_opportunities`; completed response, duplicate and history were verified. Initial deterministic-only run cost $0. No additional paid tests were run.
- Supabase staging advisor: no WARNING/ERROR; INFO for intentionally private server-only RLS tables with no client policies. Do not add broad client policies to silence this.
- Existing Public Beta schedule is preserved. Before its 1 November Bali-time endpoint, the owner must separately approve a transparent extension or transition; this code does not silently switch new prices/5-day/300-month rules on.
- Analytics are new-release-only, private events with hashed deduplication keys. Direct Telegram link clicks and actual welcome reading are not observable, so neither is fabricated. No chat text, names or birth details enter the funnel.

## Final release evidence — 17 October 2026

- Node 22.23.3: 210 frontend, 407 backend tests PASS; one existing optional external-fixture test skipped. Both TypeScript checks, frontend lint and local production-mode bundles pass.
- Native PostgreSQL: 56 economic/concurrency/security/rollback checks. Real staging: 29 checks including exact owner isolation, durable continuation, saved 1/3/5-card reopening and no repeated generation. Real service-role access and anon/authenticated denials repeated in read-only production transactions.
- Mobile: 120 local UI scenarios across 360/375/390/393 px and EN/RU, plus eight baseline UI cases PASS. Fixtures are explicitly synthetic, separate from real persistence. Owner confirmed actual Telegram iPhone balance/history/Membership readability without lower-control overlap.
- Fresh encrypted Luna-only backup: 60 tables, 1,788 rows, 55 functions, two independent isolated PG17 restores. Constraints, indexes, RLS, grants and data hashes match. All 28 media archives (239,528,218 original bytes) version matched, decrypted and hash checked; no production Storage upload/restore was attempted.
- Only two reviewed Luna 3.5 migrations applied to production: `20261017035746`, `20261017035753`. Installed hashes exactly match source and staging. Old public relations, RLS policies, functions/ACLs, paid rights, payments, wallets, runtime and financial settings all have identical pre/post fingerprints. New tables force RLS; new RPCs are invoker-only/service-only.
- Final staging: https://luna-staging-itfl.netlify.app/ — `6ad2f2d30e4eae4c2cf224a5`. Three necessary consolidated staging publications; builds local. Temporary AI worker removed from final publication.
- Actual provider testing exposed a frontend issue hiding model prose behind an account card. Fixed and tested with a real reload/mobile regression; model prose now accompanies live account data, without further paid tests.
- Public main-bot `?startapp=natal` page exposes Open App. Central destination/referral parsing has regression coverage. Broader native iPhone deep-link and sharing checks remain manual.

## Commercial limitations / required owner actions

Do not enable sales merely because code is deployed. Owner must separately authorize live Stars activation and real transactions. Verify a real receipt, duplicates, monthly renewal, cancellation, annual allocation and refund under an approved test plan first. Existing Lifetime/fixed-term rights are preserved. Direct paid compatibility continuation still fails closed without debiting; an authoritative purchase adapter and end-to-end verification remain. Extra optional notification categories are not activated. No unsolicited Telegram messages/reminders were sent.

Production retains the original $100 prospective baseline and 1 November Bali-time Beta endpoint, current quotas/prices and OFF financial gates. Before Beta expiry, separately approve its extension or transition; there is no silent financial activation. Private funnel statistics begin at this release; historical conversions, welcome reads and Stars-to-cash margins are not fabricated.

## Safe rollout and rollback

Use development PR workflow, then Railway backend first. Verify exact commit, Node22, Telegram readiness and OFF commercial gates before one prebuilt Netlify frontend upload. A later Git deploy replaces a manual artifact, so merged source/profile must match. Never restore old balances to roll back code. For a migration regression remove only new callers, revoke execution on the five Luna 3.5 RPCs and retain private records. Native rollback/reapply checks passed; older objects/data were not altered.

Detailed machine-readable evidence: `qa/luna35-release-review.json`, `qa/luna35-native-review.json`. Backup keys/private archives remain outside the release repository. Final deployment identifiers will be recorded after publication.

## Reference checks

- Telegram Mini Apps direct links: https://core.telegram.org/bots/webapps#direct-link-mini-apps
- Telegram Stars invoices/30-day subscriptions: https://core.telegram.org/bots/api#createinvoicelink
- OpenAI strict function calling: https://developers.openai.com/api/docs/guides/function-calling#strict-mode
- Supabase server-only RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
