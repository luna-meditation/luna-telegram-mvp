# Meet Luna 4.0 — implementation and release ledger

All eight owner specifications were read on 2026-10-19. Development branch: `feature/meet-luna-4-personal-intelligence`. Baseline production: main `b0406e22c11e712155e8e62dd68d86ea713656bb`, Netlify `6ad4df068ea7bcde797e9ad9`, Railway `41eee2ff-3bd4-443f-8fb9-083e695549a5`. No routine staging deployments. Existing unrelated worktree changes are excluded.

## Audit: source of truth and observed failures

- React/Vite frontend, Express/Node 22 backend, Telegram HMAC authentication; owner-scoped Supabase queries with service-only RPCs. Existing typed attachments, bounded tool continuation, player and elapsed-time breathing engine are reused.
- Canonical birth profiles and chart cache are separate from the earlier optional `luna_personal_profiles.birth_date` projection. Numerology currently reads only the former; this can ignore a legitimately saved date-only profile. Personal context omits raw birth data intentionally, but provides no availability/provenance contract to prevent redundant questions.
- My Cosmos is still dominated by eight life-area cards. Confirmed memories, reflections, calculated sources and timestamps exist but are not assembled into a readable portrait.
- Chat's zero-cost starter remains a hero rather than a message. The plus sheet sends Journal/Cosmos/Meditation to standalone screens despite working inline engines. Numerology is absent from that menu.
- Confirmed owner purchase `7bfede9e-5b8d-4c2a-80a8-f6e95a01b73f`: exactly one -100 ledger debit; state `ready`; four saved report sections, Russian, two confirmed sources plus calculated natal source; generation finished 2026-10-18 15:18:26 UTC. No historical refund is justified by an absent generation. UI nests ready reports behind TWO closed details and reports success without opening the deliverable. Historical financial records remain untouched.
- Voice has an actual UTC daily limit of 5 reservation attempts, independent of chat allowance, enforced by `luna42_reserve_voice`; five successful owner transcriptions explain current exhaustion. The UI does not disclose the remaining allowance/reset. No silent quota increase is authorized.
- A process crash after a deep-analysis lease is claimed can leave a processing operation indefinitely. Recovery must reconcile durable state under a lock, never rerun or refund an active request blindly.
- Astrology: Astronomy Engine 2.1.19 (MIT), apparent geocentric ecliptic positions, IANA/Temporal timezone validation, whole-sign houses, ascendant excluded for unknown time/polar limitations. No validated Midheaven calculation exists. Swiss Ephemeris would add licensing/deployment work; not substituted without evidence. Unknown inputs remain unknown.

## Requirement matrix

| ID | Expected journey | Source / planned change | Verification and current status |
| --- | --- | --- | --- |
| P0-1 | Existing birth date reused without another questionnaire | shared canonical/legacy birth resolver | IMPLEMENTED; local tests and actual staging date save/reopen passed |
| P0-2 | Tarot 1/3/5, exact IDs/orientations retained | existing typed attachments, draw/history APIs | actual staging choose/reveal/AI/save/free reopen passed for all three kinds |
| P0-3 | Natal and compatibility remain distinct, exact selected reports | exact owner-scoped context and explicit calculation boundary | IMPLEMENTED; critical real compatibility quality gate FAILED; latest fix only locally verified |
| P0-4 | Numerology deterministic and visible inside chat | existing date engine + shared birth resolver + inline result | IMPLEMENTED/local PASS; corrected complete AI dialogue still pending |
| P0-5 | Paid report delivered, reopened free, no duplicate debit | explicit report view, exact saved context | IMPLEMENTED; four local browser cases PASS; current-source new provider generation/discussion pending |
| P0-6 | Crashed paid operation recoverable | existing purchase/lease/ledger, narrow recovery policy | IMPLEMENTED; native PG concurrency/lease/refund tests PASS; production records untouched |
| P0-7 | Fair chat and voice quotas, clear reset | existing quota/accounting + voice availability endpoint | IMPLEMENTED/local PASS; real current-source STT and physical microphone pending |
| P0-8 | Telegram owner isolation, secrets server-only | existing auth/RLS and per-owner services | unit/native PG PASS; remaining complete current-source staging owner-denial flow pending |
| P1-1 | One relevant personal-context layer | consented profile/memory + calculated-source references | IMPLEMENTED; staging confirmed goal used, pending/deleted markers excluded |
| P1-2 | Traceable, evolving personal portrait, not eight-card dashboard | sourced narrative projection and compact empty state | IMPLEMENTED; local mobile checks and actual staging portrait read PASS |
| P1-3 | Progressive birth discovery with immediate calculated value | date-only Sun interval/numerology preview + explicit revision-safe confirmation | IMPLEMENTED/local and staging save/reopen PASS; no invented time/ascendant |
| P1-4 | Journal create/read inside chat, explicit persistence confirmation | existing private note API/editor | IMPLEMENTED/local browser PASS; actual current-source staging CRUD pending |
| P1-5 | Genuine zero-cost greeting, controlled contextual follow-ups | existing messages, owner-bound lifecycle | IMPLEMENTED; staging persist/reopen/dismiss PASS without provider calls |
| P1-6 | Natural concise replies, no fabricated facts or actions | modular instructions and fixed real evaluation | PARTIAL; benchmark and exact runtime defects documented; release remains blocked |
| P1-7 | Symbolic interpretation separated from facts and hypotheses | source/version references, existing calculations | IMPLEMENTED/local PASS; no scientific or predictive claims added |
| P2-1 | Compact action menu, in-chat experiences and return paths | existing action sheet, journal/Cosmos/numerology and practice engines | IMPLEMENTED; 160 local mobile checks; real catalog meditation/breathing attachments passed |
| P2-2 | Profile/achievements/referrals preserve working design | existing UI and server progression | local regression PASS; no financial/progression migration |
| R-1 | Existing financial terms and $100/month cap retained | current catalog, atomic wallet and payments | production read-only recheck PASS; no prices, allowances, balances or entitlement changes |
| R-2 | Fresh encrypted backup, two isolated restores | approved Luna-only export/storage workflow | PASS: 80 tables, 2512 rows, 84 functions, 28 Storage objects, two restores |
| R-3 | Exact source/build/deploy identity, one coordinated release | development source + fail-closed release ledger | BLOCKED: Netlify deployment credits exhausted and final real AI quality proof incomplete |

No new cloud project, paid service, model switch, price change or production mutation has occurred. The old bot username remains authoritative until confirmed same-bot renaming; support request is not confirmation. Physical iPhone microphone/keyboard and a payer-confirmed real Stars transaction are not replaceable by browser fixtures.

## Development progress, 2026-10-19

Implemented (not yet deployed): shared canonical/legacy birth resolver; owner-bound date preview/explicit revision-safe confirmation; sourced narrative portrait with actual chart placements and deterministic numerology; compact nine-action chat menu; inline journal, Cosmos and numerology; durable zero-provider greeting/follow-up lifecycle with consent/dismissal/cooldowns; saved paid-report delivery/history/discussion; expired purchase recovery using the existing atomic lease/refund RPC; independent voice allowance disclosure; explicit sourced interpretation/practice feedback; private factual seven-day activity reflection. No schema migration is required.

Verified locally: Node 22 frontend/backend type checks, frontend preview and backend builds, lint; latest full backend **707 PASS / 1 optional SKIP** and frontend **275 PASS**, including the checked-in BLOCKED-ledger guard test. Isolated native PostgreSQL 17 restored **schema only** (80 tables/84 functions, zero copied user rows): nine checks passed, including 12-way duplicate purchase, lease concurrency, fulfillment/refund race, saved-result preservation, RLS/forged claims, owner wallet/Lifetime and unrelated sentinel preservation. Evidence: `backend/test/meet-luna4-database.mjs`, local `/tmp/meet-luna4-native-db.json`.

Full initial regressions: frontend 264/264 passed; backend 697 passed, one optional integration skipped, one outdated tool-count assertion corrected for the added read-only portrait capability. New regression additions and final full rerun pending. Later source-string quota tests were updated to retain the paid-answer guard while allowing zero-provider personal editing; no financial/quota rule was changed.

Finite provider authorization: <=90 Responses calls + <=6 synthetic transcriptions, <=$0.75 combined. Immutable run `meet-luna4-20261019-v1`, synthetic owner `510054001`; old budgets remain closed. Private QA worker was published with the existing staging frontend preserved byte-for-byte. Subsequent technical corrections addressed a QA-only 2400-token ceiling below the existing five-card 3000-token request and actual AI quality failures. No new project or user-facing staging preview was created. Publication count/cost and every provider attempt remain part of the final ledger, not hidden as one deploy.

Mobile: **160 PASS** across Chromium/WebKit, RU/EN, widths 360/375/390/393; 40 Retina screenshots. Saved paid-report open/discuss **4 PASS**; real Chromium synthetic PCM capture/cancel/same-ID network retry/permission denial **4 PASS**, with a mocked provider response and separately required real STT proof. Current Dark-only product policy is preserved; no new Light implementation is claimed.

Fresh Luna-only production export: **80 tables / 2512 rows / 84 functions / 1 view**, two complete isolated restore passes, exact row/security hashes. Fresh Storage metadata matches **28 encrypted object archives / 239,528,218 original bytes**; every archive decrypted and hashed. Location: `/Users/evgeniy_eger/Documents/LUNA/release-backups/luna-connector-rwA9c2/pre-meet-luna4-20261019.Y4f2kJ`. Keys remain protected separately, no plaintext user data in Git or test fixtures. No migration is required.

Initial fixed benchmark: 60 GPT-5-mini cases, six paired comparison decisions (three cases each for GPT-4.1-mini and GPT-4o-mini), four prior-policy decisions. Exact first expected-tool matches: 45/60, 3/3, 3/3; these are not end-to-end success percentages. All outputs were complete, no forbidden private marker or false charge claim. Cost: $0.0341397 from actual usage at published rates. The small comparison sample does not justify a production model switch. Final targeted fixes are evaluated through complete server journeys, not claimed as a second full benchmark.

Real QA exposed the important runtime defect: `meet-luna4` was registered but excluded from the actual chat entry point's old Intelligence-version list. Direct benchmark requests selected the new policy while real chat silently used legacy instructions. `usesIntelligencePrompt` now binds both paths; a regression checks the real caller. The current authenticated request is always the final history turn even without a memory boundary. A separate substantive-chart guard rejects empty confirmation loops before persistence/answer-quota consumption; observable grounding guards remain intact. Numerology instructions no longer demand an unsolicited master-number explanation that the conservative guard correctly rejects. Failed outputs and their provider costs are retained. No automatic paid retries.

The QA-only rejected five-card request never reached OpenAI. Its single staging hold was reconciled to zero using the immutable private meter and exact synthetic attempt ID; only that non-dispatched synthetic fixture was reset. Existing successful readings and provider-call counters were not reset. Production accounting, balances and subscriptions were untouched.

Release remains gated on real provider quality/persistence tests, mobile browser checks, fresh encrypted backup with two restoration checks, source-bound build and current production preflight. The present production remains unchanged.

## Итог текущего прогона: релиз НЕ опубликован

- Политика `meet-luna4` ещё не включена в production. Действующий backend отвечает `ok=true`, commit `b0406e22c11e712155e8e62dd68d86ea713656bb`, Node 22.14.0, модель `gpt-5-mini`; запуск миграций отключён. Оплаченные подписки, баланс и платежные настройки не изменялись.
- Последний реальный ответ по двум рассчитанным натальным картам ошибочно предложил назвать выпавшие карты Таро. Защитный фильтр отклонил его; ответ не объявлен успешным. Исправление `17475a4` передаёт `THIS_TURN_ACTIVE_SYSTEM` и точный `SELECTED_CALCULATED_EVIDENCE` отдельной явной секцией. Четыре новых теста проверяют настоящий построенный Responses-запрос в RU/EN, оба профиля, отношение `business`, аспекты, отсутствие старых персональных полей и независимость от необязательного флага отображаемого режима. Это локальная проверка контракта, НЕ доказательство качества нового живого ответа.
- Проверочный журнал Supabase staging: `paused / CHECK_FAILED`, **83 из 90** Responses-вызовов, **0 из 6** STT, **$0.0556034 из $0.75**, неопределённых расходов/удержаний нет. Обычная генерация staging снова выключена. Сохранённые успешные расклады не регенерируются ради повторного открытия.
- Выполнено **пять** успешных технических публикаций worker в существующий `luna-staging-itfl`; шестая отклонена HTTP 403. Во всех пяти frontend staging сохранён без изменений. Последняя публикация `6ad5590c931c5f442a548530` соответствует `aca251c`, а НЕ новому исправлению. Это не новый пользовательский preview; прежнюю QA-страницу нельзя считать проверкой нового интерфейса.
- Netlify подтвердил в аккаунте Luna: все доступные для публикаций кредиты израсходованы, production deploys приостановлены; оставшиеся operational credits поддерживают действующие сайты, но не оплачивают публикации. Дата сброса: **16 ноября 2026**. Точная величина operational balance и фактическая стоимость пяти публикаций не получены. Тариф, автопополнение, сайты и кредиты не изменялись. Защита интерфейса остановила переход в покупку кредитов; обходов и альтернативных публикаций не было.
- `qa/meet-luna4-release-review.json` намеренно имеет **BLOCKED**, а не PASS. Production build должен отклонять этот файл. PR/main и production deployment не выполняются при незавершённой проверке.

### Стоимость реальных синтетических проверок

Все суммы ниже — расчёт по фактическому provider usage и опубликованным тарифам, а не отдельный счёт OpenAI. Неудачные попытки тоже включены в общую сумму.

| Сценарий | Вызовы | Input / cached / output tokens | USD |
| --- | ---: | --- | ---: |
| Фиксированное сравнение/прежняя политика | 70 | 305149 / 255232 / 7536 | 0.0341397 |
| Интерпретация 1 карты | 1 | 1300 / 0 / 286 | 0.000897 |
| Интерпретация 3 карт | 1 | 1486 / 0 / 505 | 0.0013815 |
| Интерпретация 5 карт | 1 | 1588 / 0 / 664 | 0.001725 |
| Продолжение разговора о Таро | 1 | 8878 / 0 / 478 | 0.0031755 |
| Сохранённый натальный follow-up, ранний source | 1 | 8393 / 0 / 294 | 0.00268625 |
| Все остальные попытки, включая отклонённые совместимость/нумерологию | 8 | журнал сохранён | 0.01159845 |
| Всего | 83 | известный usage всех вызовов | 0.0556034 |

Новую стоимость глубокого разбора, успешной текущей совместимости и STT ещё нельзя заявлять: эти сценарии не прошли текущий полный прогон. Production-модель и месячный потолок $100 не менялись. Исходные ограничения 90/6/$0.75 не сбрасывались.

### Безопасное продолжение

1. Восстановить возможность публикации в существующей команде Netlify: дождаться сброса либо согласовать конкретную разовую сумму кредита. Не переключать тариф/автопополнение и не обходить лимит через другой сайт или тип deploy.
2. Один обновлённый приватный worker с актуальным source. Продолжить тот же журнал с его 83 вызовами; осталось 7 Responses-вызовов, до 6 STT и общий исходный бюджет. При достижении любого предела остановить provider-вызовы, не скрывать ошибки и не обнулять счётчики.
3. Завершить совместимость, новый корректный нумерологический follow-up, смену темы, реальный синтетический paid report/бесплатное повторное открытие/обсуждение, журнал, завершение дыхания, STT и owner-denial. Сопоставить все доказательства с финальным backend source.
4. Повторить актуальность backup и production read-only preflight; если копия старше 24 часов, обновить её и повторить два изолированных восстановления перед любыми production-изменениями.
5. Только после PASS заменить BLOCKED-ledger реальными доказательствами, создать проверенный development PR, сравнить source/tree, затем один согласованный backend/frontend release. Миграций в этом изменении нет. Никаких реальных тестовых Stars-списаний автоматически.

Ограничения: физический микрофон/клавиатура Telegram iPhone не проверены для этой версии; сохранённые записи портрета дают историю текущих обновлений, а не полный архив всех ревизий; отдельная after-meditation карточка обратной связи не добавлена в большой рабочий PlayerPage; username `@Meetluna_bot` не подтверждён, существующий bot ID/username сохраняется.
