# Luna 4.2 — implementation and release gates

## Verified starting point

Read all nine supplied 4.2 documents (Parts 1–5, 2/3 continuations, 6A/6B). Source: `luna-meditation/luna-telegram-mvp`; GitHub main `083bd167e32b4850ffb99dcc745371a3705e3b28`, tree `c36a0f655debad76840229249cd343541b07d91e`, matches the local 4.1 candidate. New development branch: `feature/luna-4-2-intelligence`.

Netlify production is still Ready at `6ad373435d6bc8e8f553d926`. Existing staging database `funvzpmpbgazsisehiru` is ACTIVE_HEALTHY (PostgreSQL 17); reuse it. No new projects. Earlier execution reports are historical evidence, not current end-to-end proof. Prior 4.0/4.1 full specifications have not been re-reviewed in this 4.2 audit yet.

## Dependency-aware sequence

1. P0/action and context audit: existing typed tools, owner authorization, selection/retry state, language and player acknowledgements.
2. Compatibility: versioned deterministic component scores; persisted evidence snapshot; concise chat result; same-conversation continuation; full technical details optional.
3. Meet Luna/My Cosmos: one canonical memory/profile model; optional deterministic questions, autosave/resume, domain suggestions, explicit consent; existing data never replaced by empty defaults.
4. Voice: bounded private transcription, idempotent server budget accounting, recording/review/cancel/error UX, same typed conversation pipeline. Optional spoken replies remain disabled.
5. Tarot/audio/commerce/Admin: verify real flows and complete missing adapters rather than cosmetic switches; keep new commercial activation disabled.
6. Fixed 100-case RU/EN functional suite, 40 compatibility cases, model comparison with separate subjective rubric, native database tests, mobile interaction tests; one integrated staging publication after local checks.
7. Only after complete gates: fresh encrypted backup plus isolated restore, exact commit, backward-compatible migrations, backend/frontend/bot release, post-release verification. No release while P0, required voice, persistence or human-quality gates are unresolved.

## Initial requirement matrix

| ID | Feature | Existing frontend/backend/database | Current status | Next evidence |
| --- | --- | --- | --- | --- |
| C1 | Compatibility index and concise chat | ChatAstrology / luna40-compatibility / ai_messages metadata + chart cache | Partially implemented | Components, deterministic evidence, persisted snapshot, 40 functional cases |
| C2 | Same-chat report continuation | LunaChat / luna33-workflows / owner-scoped ai_messages | Partially implemented | Activate saved attachment without extra Discuss action; no duplicate generation |
| P1 | Meet Luna | CosmosOnboarding / personal-memory + cosmos state | Partially implemented | Conversational choices, seven short intro steps, autosave/resume, explicit consent |
| P2 | My Cosmos | MyUniverseOverview / confirmed memories + canonical birth profiles | Partially implemented | Compact domains, real data, domain-specific questions and manual edit |
| A1 | Action reliability | Existing tool registry, navigation acknowledgements and tool ledger | Implemented but untested for 4.2 | Real multi-turn tools, topic switching, failures and confirmation binding |
| V1 | Voice message input | No working capture/upload pipeline | Not implemented | Private metered transcription and mobile recording lifecycle |
| T1 | Interactive Tarot | Existing 78-card deck and 1/3/5 chat/history | Implemented but untested for 4.2 | Reopen, orientation, no regeneration/charge, actual interpretation review |
| W1 | Meditation/audio | Existing published catalog/player/breathwork timeline | Partially implemented | Playback/focus/interruption; guided cue audition distinct from muted automation |
| M1 | Commerce | Existing catalogs, entitlement/payment/wallet RPCs | Partially implemented | Staging integrity/refund/referral tests; no new live activation |
| D1 | Admin | Existing nine-section RBAC workspace and editorial drafts | Partially implemented | CMS publication adapters, owner mutations, metrics, scroll gestures |
| R1 | Release | Existing Netlify/Railway/Supabase | Blocked by validation | Source-matched complete gates, recovery proof and human acceptance |

## Safety / approved test allowance

- Preserve current production paid/Lifetime rights, prices, quotas, balances, ledger, memories and history. No production writes during implementation.
- Latest commercial precedence: verified paid rights → approved current configuration → production → nonconflicting 4.2 → older proposals. Do not silently activate catalog changes.
- Owner approved a new maximum 300 provider calls / USD2 for 100 synthetic RU/EN model scenarios, plus USD0.03 transcription. Independent limits; stop at either bound. No production data or wallet writes. This is not permission to raise production AI costs or quotas.
- Production deployment is conditionally authorized by 6B only after all release gates pass. New payments, destructive operations and material operating-cost changes still require separate approval.
- Physical iPhone behavior, browser fixtures, database persistence and real provider quality are separate evidence. Do not call one proof of the others.

Status: implementation in progress; production unchanged.

## First implementation checkpoint

- Reused `luna33-workflows`, owner-scoped chart caches and `ai_messages` for a stable compatibility snapshot (algorithm v2, five components, fixed weights, completeness/uncertainty, profile IDs and calculation timestamp). AI cannot set scores. Reopening uses the persisted snapshot; follow-up context verifies its owner and chart references.
- Added a concise inline compatibility summary and relevant follow-ups. Technical basis and the existing generated report are optional, not the default stack of accordions. Structured report generation now ranks five closest links and requests concise, nonrepetitive everyday interpretations. Actual provider quality is not yet verified.
- Added seven optional Meet Luna steps with structured choices, auto-save, resume, back/skip, explicit consent version/date and canonical memory/profile writes. Existing goals, birth details and identity are not overwritten by unrelated steps. Bot/Home/My Cosmos/deep-link entry points reuse the navigation registry.
- Replaced the primary Cosmos stack with a compact eight-domain dashboard. Legacy information remains accessible through memory management and canonical birth-profile links. Full multi-field/conversational domain editing, discovery bookmarks and aggregate onboarding analytics are still incomplete.
- Added private voice capture/review/cancel, local PCM16 normalization, authoritative server duration validation (45s), a separate idempotent transcription lifecycle, five-attempt daily bound and the existing global spend guard. Raw audio is never stored. Voice remains disabled by default; only staging enables its UI. Actual transcription and iPhone microphone acceptance are pending.
- Node 22: frontend 235 PASS before two added encoder/UI tests; backend 564 PASS and one optional SKIP. TypeScript and lint PASS. Native PostgreSQL: 16 checks PASS, including both migration reapplications, atomic failure, owner/client denials, consent withdrawal, duplicate suppression, voice holds/settlement and safe quarantine rollback.
- Applied `20261017140319_luna42_meet_luna_atomic_progress.sql` and `20261017141409_luna42_private_voice_budget.sql` only to `funvzpmpbgazsisehiru`. Existing public-function hash stayed `99db827add618d38d3fa5ffba438d602`; relation RLS/ACL hash stayed `df3a2dba3010d57a938c489a0d1391bd` (excluding new 4.2 objects). Separate staging requests verified actual name/goal persistence and replay; synthetic owner 420042001 was cleaned afterward. No production data was read into fixtures.
- Current production model was refreshed through `/health`: `gpt-5-mini`, main `083bd167e32b4850ffb99dcc745371a3705e3b28`. No model or production setting changed. Current production is intentionally Dark-only; mobile tests distinguish actual Dark rendering from device Light/Dark preference.
- Mobile fixture matrix: 16 width/language/system-preference combinations PASS. It is not physical-device, database or provider proof. Screenshots/results: `/tmp/luna42-mobile/`.

Release remains blocked by incomplete required work and remaining provider/device/operational gates. No full-spec completion or production readiness claim.

## Second checkpoint — real staging and bounded provider evidence

- First isolated staging publication Ready: `6ad389d4c1bf4e5d7b18719a`, source `3ed2bae887fcbd53d2926c5d02867f61929efb5d`. No cloud build. Existing site/project only. Netlify showed 450 available credits before this publication; estimated publication cost 15 credits plus runtime/traffic.
- Owner reported that Meet Luna resumes on the physical iPhone, saved choices survive reopening and lower controls remain reachable. This is owner-reported evidence, not an independently observed physical-device recording.
- The real staging foundation service passed 15 checks: ownership, relevant confirmed memory, updates/deletion/consent, canonical birth-profile preservation, idempotent navigation acknowledgements, Telegram signature/QA allowlist and cleanup. Existing QA paid rights, wallet and garden fingerprints stayed identical. All synthetic foundation owners were removed.
- Actual provider inventory confirms `gpt-5-mini`, `gpt-4o-mini`, `gpt-6.1-sol`. Completed 300/300 approved first-decision requests: 100 paired-language scenarios/model. Known usage estimate USD0.285421, no unsettled holds. All observed tool arguments match their strict schema. Selection matches 75/100, 74/100, 83/100 respectively are NOT full-flow success rates or human quality scores. No production model change; cache warming materially affects cost comparison. Detailed evidence: `LUNA-4.2-MODEL-BENCHMARK.json`.
- Actual transcription service recognized fixed EN/RU/mixed synthetic speech in three calls. Usage-derived estimate USD0.000402, no holds; reopening reused each saved transcript without an extra provider call. These checks used an isolated durable synthetic-budget adapter, not a temporary opening of the global app budget. Actual application-budget SQL is covered by native PostgreSQL tests; real Telegram microphone → API → conversation still needs its separate gate. Details: `LUNA-4.2-TRANSCRIPTION-QA.json`.
- Public staging `/api/universe` rejects an unsigned request (401); private QA status endpoints reject missing bearer authorization (403). Staging generation remains disabled globally; no budget/financial settings were widened. Both new staging objects deny direct anon/authenticated access.
- Further local changes: life areas now have status/priority/details/optional goal in ONE existing canonical memory, real edit/delete, one-tap suggested priorities and explicit draft-only chat continuation. Older plain-text entries are preserved, not truncated. Saved fields are converted to relevant bounded prose only after normal privacy filtering. Added a five-field truthful introduction summary, interest-relevant priority ordering and a Meet Luna chat entry. No duplicate profile database.
- Fixed microphone cancellation/restart races using a per-recording generation token; stale permission/decoder callbacks cannot capture a new recording or stop its stream. Local Chrome covered actual MediaRecorder/PCM normalization with a synthetic device, a fixture upload, permission denial and cancellation races. It is not a physical microphone or actual provider end-to-end claim.
- New provider-generated astrology reports now enforce concise server-side limits separately from the historical schema. Existing saved reports and cache keys remain valid and do not regenerate.
- Latest local counts: frontend 239 PASS; backend 569 PASS, one optional SKIP; Node 22 TypeScript/lint/build PASS. Native database checks remain 16 PASS with unchanged migration files. Mobile matrix 16 PASS, actual Dark rendering under both system preferences. Last small navigation-consumption adjustment is being rechecked before the next artifact.
- Owner subsequently approved up to four additional real-tool provider calls and one final staging publication, while keeping the OVERALL AI allowance at USD2.03. The new worker must require the completed model/transcription ledgers and account for their spend/holds before reserving its independent USD0.02 maximum. No additional calls have been dispatched at this checkpoint.

Still NOT complete: conversational Cosmos edit/delete proposals, discovery bookmark management/search, privacy-conscious onboarding analytics, seven non-meditation CMS publish adapters, full mobile voice-to-conversation acceptance, guided/ambient audio audition and full multi-turn human-quality evaluation. Fresh release backup/restore has not started because the complete release candidate does not yet pass its gates. Production remains 4.1; no merge or production migration/deployment.
