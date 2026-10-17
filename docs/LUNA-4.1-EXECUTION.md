# Luna 4.1 — execution and evidence

## Baseline (17 October 2026)

Authoritative repository: `luna-meditation/luna-telegram-mvp`.
Development branch: `feature/luna-4-1-product-upgrade`.
Published main: `fbd6a2393e13f1c0bb6351c259d9d93d178e7817`.
Local starting commit: `c0e9f60dad42e36726bcc44fb00d14fe1ae4ab50`;
both have tree `50bece171ca5ba616065e4e61f55d9b4268c833a`.
Production Railway deployment `57d87741-7177-4ca6-8843-b61229a7c7ea` is SUCCESS.
All thirteen supplied specification files were read. Their requirements are cumulative.

## Dependency order and release gates

| Workstream | Reuse and dependencies | Required evidence |
| --- | --- | --- |
| A. P0 mobile and language | Existing app-shell scroll owner, Telegram viewport, owner-scoped locale CAS | Real scroll gestures to final content in all nine admin sections, drawer recovery, keyboard/viewport changes, delayed hydration and reopening |
| B. AI routing and actions | Existing Responses tool loop, action IDs, attachment/state boundaries | RU/EN topic switching, real catalog/player acknowledgement, chart selection, no mode-based action prohibition, bounded retry/idempotency |
| C. My Cosmos | Existing personal memories, consent boundary, astrology profiles | Resumable optional questions, confirmed persistence, edit/delete isolation, one birth-profile source, contextual retrieval |
| D. Reports and content UX | Existing 78-card registry, deterministic astrology and scoring, player/breathwork timeline | Reveal/history without regeneration, exact chart/profile ownership, synchronized audio, accurate achievement counts |
| E. Commerce and Admin | Existing catalog, atomic payment/wallet RPCs, owner RBAC and audit | Consistent prices, lifetime preservation, verified fulfillment, staged mutations only, no live activation |
| F. Model/voice evaluation | Existing server key and cost ledger | At least 100 RU/EN cases; provider availability and measured results; separately approved paid allowance; voice remains disabled until actual assets/cost checks |
| G. Release | Completed workstreams, isolated staging, fresh encrypted recovery proof | Source-matched tests, staging integration, independent review, safe additive migration sequence, no unresolved P0 |

## Safety boundaries

- Do not modify current production during implementation.
- New purchases, quotas, referrals, admin financial mutations, voice billing and model changes remain disabled until their specific gates and approvals pass.
- Existing USD100 budget, prices, balances and paid/Lifetime rights remain unchanged.
- No paid AI test allowance carries over from 4.0: all six previously approved calls were used. The owner separately approved at most 400 synthetic staging provider calls and USD2 total for the 4.1 comparison; stop at whichever limit is reached first.
- Preserve unrelated local QA edits and old preview directories.
- A browser fixture is not evidence of Supabase persistence, Telegram payment, microphone behavior or physical iPhone scrolling.
- Any production database release needs a current encrypted backup including the twelve new 4.0 tables and a verified isolated restore. The earlier 63-table backup alone is not a complete 4.1 baseline.

## Initial findings

The admin is a flex child of the bounded application scroll surface. Its default flex shrink combined with `overflow: clip` can constrain the entire grid to one viewport and clip the remaining content. Existing 4.0 browser checks asserted width and rendering, not gesture-driven vertical reachability. This gap must be covered by behavioral regression tests.

The chat still exposes a manual mode selector. Artifact modes also suppress meditation tools on the backend. These restrictions must be removed without removing ownership checks or consent for calculated chart data.

My Cosmos contains stale “chart not connected” text and a separate birth-details editor despite the working Astrology profile service. It must link to the existing source rather than introduce another profile store.

## Current status

Implementation in progress. No production mutation, model switch or full-release readiness claim is made.

### Implemented foundation

- Fixed the actual Admin flex/scroll clipping cause, with touch-driven reachability tests for nine sections at five mobile widths and desktop, RU/EN.
- Added one validated shared navigation registry and real chat Open actions; unknown URLs and privileged destinations are rejected. Profile, reading history and birth-profile entry points reuse their existing screens.
- Removed the visible manual AI mode selector and mode-based tool prohibition. The current task may use real meditation/navigation tools even with a historical Tarot attachment. Unconsented old charts are withheld rather than blocking an unrelated command; ownership and separate processing permission remain mandatory for chart facts.
- Restored shared personality/safety instructions with attachment-specific grounding, corrected stale Support/Settings capabilities and clarified tool UUID versus final catalog-key contracts.
- Added optional, resumable eight-area My Cosmos setup using existing confirmed memories and canonical personalization. Only skip/revision metadata is new; birth profiles are not duplicated. Privacy-delete copy now names the derived astrology data that is actually removed.
- Fixed check-in state at its origin: pending saves no longer manufacture a persisted daily check-in. Failure keeps controls visible; confirmed success contracts the hero. Simplified achievement filters and uses the actual catalog total.

### Migrations: staging only

`20261017103831_luna41_cosmos_onboarding_state.sql` adds a service-only FORCE-RLS table. `20261017104405_luna41_preserve_chart_history_on_edit.sql` increments the existing profile revision without deleting historical chart/report rows. Both were exercised in native PostgreSQL 17, including reapplication, grants, forged-client/RPC denials and safe rollback/fix-forward boundaries (8 checks passed).

Both were applied only to `funvzpmpbgazsisehiru`. Pre/post hashes excluding the two intended objects were unchanged: functions/ACL `8e78774ed2c74019d3d7610c3504f1eb`; relations/RLS/ACL `11475928efd8b8163dc7ea7f45dd89c2`. Production `vkcdtasbdoeilgfucoax` was not migrated.

### Verified follow-up

- General preference saves no longer write hidden/stale birth fields while Astrology is active. The response comes from the actual canonical database projection. Native SQL verifies that the current birth time/revision and historical charts/reports survive a preference-only upsert.
- Navigation metadata now includes the exact stable operation ID. A separate owner-bound RPC accepts `screen_opened` only for that owned assistant message, selected destination and completed navigation operation. Browser observations wait for the committed route/profile subview, not the click; loading placeholders do not acknowledge opening. It is client-observed telemetry, never an authorization or reward proof.
- `20261017114215_luna41_navigation_observation.sql` was applied only to staging after native tests. Service execution PASS; anon/authenticated execution denied; SECURITY INVOKER; unrelated function definitions/ACL hash unchanged (`7cb2bed952c1a6c8d6ff605a30d48e0a`). All three migrations reapply in the local PostgreSQL 17 review, now 11 passing checks.
- Admin operational records use localized field/status labels, explicit unavailable values, correctly formatted micro-USD and expandable technical details. Real user avatars have a fallback.
- Redundant “would you like me to prepare” copy is removed only after an actual validated practice card exists. Navigation copy promises only the available Open action. Valid attached Tarot cards are not mistaken for missing meditation cards.
- Node 22: backend 510 PASS / 1 optional SKIP; frontend 230 PASS; both TypeScript and lint checks passed. Mobile product fixtures cover ten width/language combinations, including the actual rendered chat Open button and a single post-commit route observation.
- Actual staging foundation services passed 12 checks: create/confirm/edit/reopen/delete memory, consent withdrawal, relevant RU/EN context, cross-owner denial, Cosmos CAS/replay, signed-QA Telegram authorization and unchanged financial fingerprint. Both temporary synthetic users were removed. This is database proof on the foundation commit, not a physical Telegram login certification or proof of later undeployed source.
- The owner reported current staging Admin scroll/drawer recovery on iPhone (reply “ла”, interpreted as “да”); this is owner-reported evidence for the deployed foundation only.

### Paid QA boundaries

The separate voice allowance is at most USD0.05 for fixed synthetic cue generation and transcription. The private expiring worker has a durable claim, per-request reservation and no retry after unknown outcomes. It uses existing server secrets in Netlify memory; neither the key nor private recordings are exported. Its transcript fixtures are synthetic. Generated cues remain unavailable to app users until files, duration, RU/EN quality and phase synchronization have actually been checked. Voice input/output production activation is not approved by this test allowance.

The comparison encountered provider `cyber_policy` refusals on the synthetic cross-user-profile request in both languages. Those cases are terminal; they are not retried, rephrased or treated as completed interpretations. Their full cost ceilings remain reserved because no usage was returned. Continuing other distinct approved cases does not bypass that refusal. The report separates known usage estimates from unsettled holds and does not fabricate subjective scores.

Completed comparison: 400 attempts, 100 paired-language cases per model, 398 responses and two provider policy declines. Known usage estimate USD1.097254, unsettled conservative holds USD0.180376, together below the approved USD2. The machine-readable metrics are in `LUNA-4.1-MODEL-BENCHMARK.json`. All observed tool arguments matched the strict schema. Selection-match percentages are not end-to-end success rates: the catalog fixture and absence of tool continuations are material confounders. Cached prefixes differ between models, so the cost ranking is not an uncached production forecast.

Representative answer review found: all models selected the real Cosmos navigation ID; the cheaper candidate added a redundant invitation after recommending a practice; one English current-model identity answer was in Russian; stronger candidates gave more specific attached-card discussion in the reviewed examples. No numeric subjective ratings or automatic model recommendation is made. The runtime already rejected wholly wrong-language prose; the follow-up now rejects a dominant wrong language even with a Latin brand name, preserves explicit quotations, and puts the server language into both final instructions and the structured message/quick-reply contract. Production remains on gpt-5-mini.

The owner separately approved at most four additional action/language provider calls and USD0.02 total. This is not a renewal of the comparison allowance. The private worker has its own smaller reservation limit and uses only a disposable synthetic staging owner and the actual published meditation catalog. It must stop on a failed or unknown outcome, without quota/Seeds charges or claiming playback.

### QA scope and remaining gates

The 100-case paired RU/EN dataset compares current, cheaper, stronger and high-quality candidates. Inventory is checked at the provider. An expiring staging-only worker reads the existing key in server memory, durably claims batches, reserves a conservative cost ceiling before every call and never retries an unknown outcome. It does not change production model settings, app quotas, wallet state or the USD100 production guard. Model-selection tests are not proof of tool execution or subjective conversational quality; those require separate review and end-to-end evidence.

Local product checks cover ten mobile width/language combinations: optional memory save/edit/reopen, durable skips, route dispatch, no horizontal overflow, delayed/failed/successful check-in. Their data is explicitly an in-process fixture, not Supabase proof. The separate staging foundation command exercises actual database persistence on two synthetic accounts and cleans only those accounts afterward. Its Telegram signatures are staging-signed QA fixtures, not a physical login certification.

Still release-blocking: completed model comparison and representative answer review; remaining Admin content adapters; voice capture/transcription with cost/format/privacy validation; staging verification of the latest action observations and stale-profile fix; current physical-device verification; a fresh complete encrypted backup and isolated restore before any production database change. Existing guided breath voice assets are unavailable and must not be advertised as working. No new commercial activation is approved.
