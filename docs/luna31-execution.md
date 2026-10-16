# Luna 3.1 execution and release gates

Base: production `232c6e08fdcbc8ec5cd550df88242a1728dc79ef`.
Development branch: `feature/luna-3-1-cohesive-experience`.

## Architecture and order

1. P0: reuse signed Telegram authentication, the existing chat request ledger,
   owner-scoped conversations, confirmed memory boundary, Tarot persistence and
   Astronomy Engine. Replace permissive visible-output handling; add a typed
   consultation/action contract; carry both charts and saved reports into chat.
2. P1: readable mobile answers, accessible breathing picker, non-overlapping ring
   readout, compact Home check-in, exact independent status requirements.
3. P2: differentiated achievements, explicit detail disclosure, historical earned
   records preserved, one-time opt-out/dismissible milestones; no new payouts.
4. Verification: Node 22 tests/lint/types/build, isolated PostgreSQL security and
   request replay checks, EN/RU × dark/light × 360/375/390/393 mobile review.
5. Only after local gates: one existing staging publication, no new project.
   Owner approved at most six synthetic AI requests, total $0.03. Record usage,
   language, exact context, cached reopening, and duplicate replay separately.
6. Before production: fresh encrypted Luna-only backup and isolated restore,
   compare shared-project objects, exact tested GitHub branch/PR, backend first,
   then one frontend publication and public read-only verification.

## Security and cost boundaries

- No new database migration is needed for the consultation state: existing
  `conversation_state` and owner-scoped message metadata are reused.
- The AI may suggest finite action IDs only. It cannot choose URLs, SQL,
  application record IDs, navigation parameters or payment operations.
- Every submitted or recovered reading/chart/report ID is revalidated by owner.
  Saved report IDs must match both attached chart IDs. Missing/deleted/foreign
  context fails closed before provider invocation.
- Memory deletion/consent change advances the existing privacy boundary. Old
  contextual history is excluded; an in-flight answer using an obsolete memory
  boundary is not saved. No new memory is saved automatically.
- Each turn makes at most one provider request. Hidden output retries and paid
  quality regeneration are removed. Explicit user retry preserves the request
  ID; completed requests reuse their stored response and charge no second quota.
  Incomplete output is not displayed. Failed attempts refund the app allowance;
  provider tokens already consumed are still logged when usage is available.
- Mode prompts are modular and bounded, not two duplicated copies of the legacy
  meditation prompt. Oversized chart context fails rather than silently vanishing.
- Existing prices, payments, subscriptions, Lifetime rights, Moon Seeds balances
  and reward calculations are unchanged. New commercial flags stay OFF.

## Critical acceptance matrix

Must be evidenced, not inferred from a successful build:

1. First launch has a clear Home / Luna AI / Profile hierarchy and four categories.
2. Tarot starts directly inside Luna AI, with 1/3/5-card selection.
3. Optional question and intention remain editable; free text remains available.
4. Reveal persists; orientation and card positions survive reopening.
5. Saved reading attachment does not generate a new interpretation.
6. Follow-up receives exact owned cards, question and saved interpretation.
7. Foreign/deleted reading is denied before a provider call.
8. Natal discussion carries the exact calculated chart and selected planet.
9. Compatibility discussion carries both distinct charts and saved report.
10. Unknown time never produces an ascendant, houses or precise lunar claims.
11. Chart-label collision avoidance never changes calculated longitudes.
12. RU/EN answers contain no raw JSON, literal escaped line breaks or stray Korean.
13. Markdown renders escaped text only; scripts/HTML/URLs cannot execute actions.
14. Every contextual action has an allowlisted real handler and accurate label.
15. One meaningful question at a time; no repeated answered clarification.
16. A published meditation recommendation renders the actual playable practice.
17. Error classes distinguish login, context, permission, timeout and quota.
18. Retry reuses the request ID; duplicate completion does not regenerate.
19. Remaining quota and reset time come from the server, not local estimates.
20. Consent revocation/removal excludes unconfirmed, deleted and foreign memories.
21. Sensitive information is not automatically saved as a fact.
22. Breathing start/pause/resume/restart uses the existing elapsed-time algorithm.
23. All nine techniques and four free durations remain available.
24. Ambient audio starts only on an explicit gesture; guided audio stays unavailable.
25. Ring readout and controls remain readable above mobile bottom navigation.
26. Home confirmation dismisses; secondary mood editing remains accessible.
27. Journey shows independent days/actions/directions criteria, no averaged 93%.
28. Earned/legacy achievements and timestamps remain; no invented Seeds rewards.
29. First observation/reopening does not replay historical milestone celebrations.
30. BackButton, keyboard, deep links, safe areas and scroll reset remain correct.
31. Payments, Lifetime, balances, garden purchases and playback regressions pass.
32. Crisis/medical/financial/legal/manipulative prompts preserve safety and agency.

## Evidence policy

Local fixture/mobile checks do not prove real Supabase persistence, a real
Telegram signature, physical iPhone keyboard behavior, provider answer quality,
or deployment. Each is reported separately. No production release if a critical
gate is missing or fails; no API keys, raw user data or encrypted backup keys in Git.
