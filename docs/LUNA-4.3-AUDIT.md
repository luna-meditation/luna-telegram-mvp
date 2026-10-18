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

No 4.3 paid AI calls have run. New staging test budget requested separately; prior 4.2 allowances are exhausted. No real Stars purchase will be initiated without payer confirmation. The app cannot prove a real iPhone microphone flow from desktop screenshots.
