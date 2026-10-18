# Luna 4.3 — verified baseline and audit

Audit started 2026-10-18. Application source: `luna-meditation/luna-telegram-mvp`, development branch `feature/luna-4-3-unified-experience`. No 4.3 production changes have been made at this checkpoint.

## Authoritative baseline

- GitHub main: `2ab6cc0b651b06a85e41b811f6da003425135732`, tree `2b1a9984eab451d042788cfb874928c3f5d5b8f8` (identical to the local development starting tree).
- Production Netlify site: `55baedc0-02e4-45ad-a0d5-0bd76ef4ce97`, Ready deploy `6ad4205622c9dd209e613f79`.
- Railway production backend: deployment `dd43f07e-3b8f-4918-8ef6-705f783431a3`, Node 22.14, `gpt-5-mini`, startup migrations disabled.
- Supabase production: `vkcdtasbdoeilgfucoax` (shared project); existing staging: `funvzpmpbgazsisehiru`. Never copy unrelated application objects.
- Existing QA site: `luna-staging-itfl`; bot: `@luna_staging_qa_eger_bot`; QA owner: `158467796`.

## Architecture and reusable systems

React/Vite application with an incremental navigation registry around the existing App, Telegram HMAC authentication on Express/Telegraf, server-only Supabase service credentials, durable chat/tool operations and AI expense reservations. PostgreSQL is authoritative for balances, payment receipts, entitlement periods, onboarding revisions, confirmed memory and saved readings. Existing astronomy-engine calculations, Temporal timezone resolution, card registry (78 cards), audio player/focus manager, nine breathing practices, CMS publication versions and Admin audit trail must be reused.

## Feature assessment (before 4.3 fixes)

| Area | Status | Evidence / gap |
| --- | --- | --- |
| Telegram authentication / user isolation | WORKING | Server HMAC and owner-filtered services; regression tests still required for new endpoints. |
| Meditation, Tarot 1/3/5, calculated astrology | WORKING, quality PARTIAL | Existing actual tools/assets/history. This does not prove every conversational journey. |
| AI topic handling | BROKEN in some transitions | `luna-ai.ts` recovers the last attachment for otherwise unrelated turns; only selected practice/reflection patterns detach it. |
| AI response length | PARTIAL | An artifact automatically opts into long-form review and rendering, even without a depth request. |
| Voice input | PARTIAL / P0 | Browser MediaRecorder → decode/resample → WAV; feature names are forced in the transcription prompt; peak-only silence check. Real production attempts averaged only 540 ms. Physical iPhone failure is not disproved by previous synthetic tests. |
| Meet Luna | PARTIAL | Seven-step durable state exists, but renders as a separate questionnaire rather than the actual chat. |
| My Cosmos / memory | PARTIAL | Confirmed owner-scoped facts and consent exist; domain entry favors manual forms; memory controls still live inside Cosmos. |
| Stars | WORKING legacy path; new storefront DISABLED | Historical successful 499 Stars payment exists. Invoice creation is not proof of another successful payment. |
| Moon Seeds commercial ledger | IMPLEMENTED, DISABLED | Atomic services and receipts exist; production commercial orders and seed ledger are empty. Must test activation before declaring working. |
| Premium modern catalog | DISABLED / PRICE CONFLICT | Prepared 500/3500 catalog conflicts with actual 499 monthly / 750 annual / 2499 Lifetime legacy price source. Preserve actual production prices and existing terms; no implicit recurring subscription. |
| Referrals / new quota products | DISABLED | Reuse existing services; new unpriced products cannot be fabricated. |
| Admin / CMS | PARTIAL | Typed publication/audit consumers exist; actual mutation paths require acceptance checks. |
| Home / library / breathwork | PARTIAL | Preserve artwork/layout; verify clipped labels, localization, overflow, safe areas and audio controls independently. |

## Security finding correction

Fresh production migration inventory shows `20261014124825 luna_security_boundary_hardening` already applied. Earlier reports calling it blocked are stale. All public regular tables currently have RLS enabled; `increment_meditation_play_count` and `reserve_luna_chat_request` are SECURITY DEFINER but anon/authenticated cannot execute them. Do not rerun the old migration by filename. Compare current objects and ownership/grants instead. Other applications in this shared database are explicitly out of scope.

## Actual AI usage and model routing

Read-only production aggregates at audit time: 76 `gpt-5-mini` attempts, known cost $0.089259, no outstanding reservation. Chat: 60 attempts / $0.067405 (mean $0.001123); Tarot: 12 / $0.015393 (mean $0.001283); astrology report family: 4 / $0.006461 (mean $0.001615). Portrait versus compatibility is not separable from that operation prefix, so no invented per-kind figure is reported. Two STT attempts: $0.000170 total; too short to be representative. These are application-recorded provider-token estimates, not the OpenAI invoice or account balance.

Current provider documentation (2026-10-18): gpt-5-mini standard $0.25 / $0.025 cached / $2 output per million; gpt-6-luna $0.10 / $0.01 / $0.50; gpt-6.1-sol $2 / $0.10 / $10 (context below 272k). Mini transcription audio input $1.25 / output $5 per million. Candidate routing is cheap ordinary conversation plus stronger complex symbolic analysis, but no production model change is justified before a real tool/context benchmark. Preserve the existing $100 application budget and current quotas.

## Release blockers and financial boundaries

1. Reliable voice bytes and unbiased transcription; real RU/EN fixtures and physical-device caveat.
2. Topic/context isolation and truthful exact tool actions, concise initial answers.
3. Actual chat-based optional onboarding and privacy controls, no second memory system.
4. Resolve prepared versus current commercial catalogs without altering existing prices, rights or recurring terms. Part 6 authorizes activation, not invented products.
5. Staging RLS/financial idempotency and full automated/mobile regressions; fresh encrypted Luna-only backup with two verified isolated restores before production DDL/activation.
6. Final mobile acceptance and one coordinated release. No legacy deploy restoration; fix forward.

## Owner decisions after the baseline audit

New sales are explicitly approved at 500 Stars / 7 days, 1000 / 30 days, 5000 / 365 days and 10000 / Lifetime. They are prepaid, without automatic renewal. The old 499/750/2499 receipt-validation definitions stay unchanged. An active old Lifetime must never be replaced or sold again.

The owner approved 20 additional successful standard AI replies for 50 Seeds and one grounded personal analysis for 100 Seeds. Both use the existing wallet/ledger and audited Admin catalog revision. The monthly 300-reply model and new ordinary earning rules remain OFF: current daily quotas and rewards are preserved.

New staging QA is bounded by one durable envelope: at most 40 Responses calls and 8 synthetic transcriptions, combined $0.50. Already saved results and the same budget are reused after corrections, not reset. No real Stars payment is approved or performed by automation.

## Implemented and independently checked

- PCM16 mono 16 kHz AudioWorklet capture, permission/cancellation/background cleanup, bounded recording, inline review and explicit text sending. No audio-message storage or voice call is advertised.
- Pre-provider silence/DC/click/clipping checks and no app-vocabulary transcription bias. Manual inspection caught a poor Russian synthetic transcript that the first weak assertion missed; the final run must verify actual expected RU/EN words, not merely nonempty text.
- Selected artifact versus historical attachment separation, complete expandable prose, bounded contextual memory, current real tools and persisted conversation results. Ordinary day planning is not a subscription intent; chart follow-ups cannot offer old Tarot context.
- Optional Meet Luna in the actual composer, canonical confirmed-field reuse, conversational domains, optional birth-data editing and Settings memory controls. No inferred Telegram name is silently stored as a confirmed personal fact.
- Profile/Journey hierarchy, two library tabs, collapsed filters, readable mood labels and breathing guidance without changes to phase/reward algorithms. The current approved product is Dark-only; system Light preference is tested but is not called a separate Light theme.
- New Premium rights use the existing entitlement periods; a new Lifetime period is infinite without rewriting `users.lifetime_access`. Verified receipt/refund/idempotency tests preserve historical rights.
- Two narrowly scoped 4.3 migrations reviewed on a fresh restored production schema: only nine existing Luna functions change; all original ACLs, other function bodies and original-column row checksums remain exact. Five new functions are invoker-only/private. Another application's objects are excluded from writes.
- Fresh encrypted backup: 79 tables, 79 functions, one security-invoker editorial view, two isolated complete restores and 28 verified encrypted media objects. Managed paid backup/PITR resources were not provisioned.

## Explicit remaining product boundaries

The existing calculated compatibility and entitled/Public Beta AI scenarios remain available. A separate paid compatibility report continuation is not yet wired: the old server deliberately returns `direct_purchase_unavailable` before a debit. It must not be advertised or activated as a functioning paid product. There is no approved individual meditation-unlock product; existing Premium library access is preserved. These individual gaps must not be disguised by enabling unused flags or blocking the otherwise verified store.

A real iPhone microphone/permission/keyboard audition is separate from desktop PCM capture and real synthetic provider tests. Additional live Stars purchase/refund approval belongs to the payer. Final readiness depends on the source-bound release evidence, not this historical audit alone.
