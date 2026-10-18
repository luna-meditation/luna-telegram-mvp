# Luna Intelligence — execution ledger

## Intelligence 2.0 — active program, 2026-10-18

All eight specifications received and read. Part 8 authorizes their coordinated implementation. Branch `feature/luna-intelligence-2-0`, based on the verified production code at GitHub main `58ab85e4729e93197cefa534160cda4172be8e0c`. Existing unrelated edits are preserved. **DEPLOYED** via PR #30: production main `93c9b6a5819296ffb65052248f8b25522995cdad`, Railway SUCCESS, Netlify Ready at 11:37:42 UTC. The single reviewed migration was applied at 11:32 UTC. Final Russian report below distinguishes local/staging tests from public production proof. Historical 1.0 results do not constitute 2.0 acceptance.

| Requirement | Actual baseline / work | Evidence required | Status |
| --- | --- | --- | --- |
| Intent/action reliability | Shared topic rules, direct natal command and bounded lookup → action → answer | Real owned chart/card metadata and idempotent saved retry; 40 deterministic multi-turn cases | VERIFIED STAGING + LOCAL UI |
| Unified personal context | Existing confirmed memory/Cosmos/chart sources, timestamps and provenance; pending/deleted excluded | Actual staged deletion/consent boundary, model-input assertions and owner rejection | VERIFIED WITH LIMITS |
| Personality/proactivity | Concise response plan, exact-artifact evidence guard, zero-provider welcome | Real RU/EN review; ordinary goal no longer triggers stale meditation; wording still imperfect | IMPLEMENTED / REVIEWED |
| Native Tarot/breathing/meditation | Existing secure draw, timeline/proof, catalog/player reused | Real 1/3/5 persistence; real elapsed breathing reward once; local playable card | VERIFIED STAGING + LOCAL UI |
| Conversational discovery | Existing inline ChatMeetLuna; optional, saved, no forced questionnaire | Local reopen/skip/edit/consent plus real staged confirmed-memory CRUD | TESTED, PHYSICAL PHONE PENDING |
| Numerology/astrology | Versioned date-only calculation, timestamped actual transits and canonical chart subjects | Synthetic engine fixtures and real tool responses checked against exact numbers/aspects | VERIFIED STAGING |
| Mobile UX | Grouped history, compact context, Cosmos loading, seven-day rhythm and 1/3/5 full-frame sharing | 16 core + 16 extended local cases at 360/375/390/393, RU/EN; current Dark-only policy | LOCAL PASS |
| Commerce | Existing Stars/Seeds terms; six topic-specific 100-Seed reports, legacy hashes compatible | Native races/refunds/rights; one synthetic report charged once and cached; no real Stars transaction | VERIFIED WITH LIMITS |
| Referrals | Reuse modern server-gated 30/20 rewards and 5/month cap; legacy health flag is separate | Native duplicate/concurrent/self checks; approved modern flag applied on successful Railway release, no real referral fabricated | ENABLED / NATIVE TESTED |
| Release | Existing infrastructure, GPT-5-mini and $100 cap; one narrow additive migration | 80-table backup, two restores, 28 media; exact SHA, 40 public mobile cases, unchanged financial fingerprints | DEPLOYED / PUBLIC SMOKE PASS |

Verified root causes so far: direct natal routing misses “посмотри”; artifact retention is a separate phrase heuristic; one tool round cannot chain an optional profile lookup and actual retrieval; fallback consultation actions can add unrelated Tarot/meditation/breathing; the welcome's introduction link goes to My Cosmos despite the existing inline discovery component. The 1.0 benchmark primarily checked first-tool choice and local browser fixtures, so it did not prove the full physical-phone journey.

Order: P0 action/context/financial regressions → unified context/numerology → conversational and mobile refinement → actual staged/provider scenarios → recovery/preflight → one production release if critical gates pass. The owner approved a separate **60 provider calls / $0.50** maximum for synthetic existing staging. The old 1.0 run remains closed. No paid production tests, price changes, or new resources.

### 2.0 local implementation checkpoint

- Implemented shared active-topic retention, exact natal/compatibility context, two bounded tool rounds with an explicit final answer, and targeted rather than generic follow-up actions. Every third provider attempt is reserved under the existing accounting lease; non-chat features remain limited to two attempts.
- Consented confirmed memory carries provenance and timestamps. Pending/deleted facts are excluded; no second memory store. Date-only symbolic numerology and real timestamped natal transits use versioned deterministic calculations. Deep analysis uses one of six explicit topics and the existing atomic 100-Seed product; historical report hashes remain compatible.
- Chat now starts with a zero-provider conversational greeting, uses existing inline discovery, searchable grouped history, compact exact context and five-card full-frame share layouts. My Cosmos loading no longer flashes an incorrect empty state. The actual seven-day rhythm is reused in compact Journey. Existing Dark-only policy is preserved.
- Node 22.23.3: **257 frontend PASS; 666 backend PASS, 1 optional SKIP**. Lint and TypeScript PASS in both packages. Sixteen local RU/EN embedded Tarot/breathing/history/share cases at 360/375/390/393 PASS. These are fixture-backed browser results, not physical iPhone or provider proof.
- Isolated PostgreSQL: **59 checks PASS**, including additive migration, repeated apply, rollback/reapply, financial races and RLS. `20261018100000_luna_intelligence_bounded_tool_continuation.sql` applied only to existing staging. Production not migrated; exact hashes and rollback in `LUNA-INTELLIGENCE-2-MIGRATION.md`.
- New finite staging worker is capped at **60 calls / $0.50**, blocks public generation during its window and restores generation OFF. No 2.0 paid calls or cloud publication at this checkpoint. Model comparison and end-to-end quality are still pending; local green tests do not satisfy those gates.

### 2.0 real quality gate and correction (not yet released)

- One combined staging deployment `6ad49ed7a5e72573145abf2c`, source `707868c`. Thirty-six paired first-decision samples (12 identical scenarios, three actually available models), $0.0315018. Raw expected-tool matches: 8/12 GPT-5-mini, 9/12 GPT-4.1-mini, 11/12 GPT-4o-mini. This is not a conversational-quality score and does not justify a production model switch.
- The real smoke stopped at 44 total calls / $0.0440058, no unsettled provider cost. Basic persistence checks passed, but manual review caught a fabricated profile name in compatibility. A later direct natal command returned discussion instead of a UI card when a natal chart was already active. These are release blockers, not accepted results.
- Corrections: canonical owner-scoped birth-profile labels, source-fact/identity contradiction guard before persistence, old different-artifact assistant prose excluded from new artifact context, and direct Open/Look commands always prepare the actual saved chart. The evidence guard is conservative, not a proof that arbitrary generated prose is factual. No silent answer repair or extra automatic generation; failed responses do not count as successful-answer quota.
- The necessary corrected staging run reuses the same 60-call/$0.50 ledger, saved readings and benchmark. Prior failures remain recorded. Fresh request IDs only for the corrected conversations; no reset or hidden spend. Production remains unchanged until that gate passes.
- Fresh encrypted recovery snapshot: 80 Luna tables / 2313 rows, 84 functions, 1 view, captured 2026-10-18 10:27:14 UTC. Two exact isolated PostgreSQL restores PASS; 28 current Storage archives / 239528218 original bytes verified. Other application data excluded. Plaintext restored databases removed after verification.
- Corrected staging `6ad4a458bd2d74b43e6ed86c` verified canonical profile names, exact natal Mercury, Russian strengths and the active-chart command. The transit response was rejected by the evidence guard at 50 calls / $0.0517269. No successful quota or saved answer was granted. Its provider response was not retained (store=false); do not claim to know its exact rejected clause. Local tests additionally exposed the guard's overly broad cross-clause aspect matcher. Narrowed that matcher, added explicit bilingual engine-derived transit labels (no model conversion of zodiac indices), and retained synthetic-only provider output in the private finite QA ledger for further review. All original failure/spend records remain. Production still unchanged.

### 2.0 final review — 11:29 UTC, production still unchanged

- Final real validation source `d577a759f0df470bb1810f364bbbc401ae2d9842`, staging `6ad4abb0d85a7e66227e9bb7`: **58 checks PASS, 59 provider calls, $0.0603846**, no held/unknown usage. Worker closed; normal staging generation OFF. All prior failed attempts/costs retained. Five necessary correction publications were used in total, not cosmetic cloud builds.
- Canonical compatibility labels, natal Mercury, strengths, exact 2026-10-18 transit aspects and a corrected numeric overview were manually compared with calculation output. Initial fabricated name, missed natal action, overbroad aspect guard, fixture-induced expired consent and inaccurate/long numerology explanation are recorded above rather than hidden. The final numerology answer is concise, returns 4/1/3/4/4 for the synthetic profile/current date, and explicitly says symbolic, not scientific.
- A final UI-only follow-up boundary replaces model-suggested arbitrary-year calculation (not supported by the current tool) with two safe RU/EN discussion prompts. This change is deterministic and locally tested, not another paid provider run. The QA resume early-return is also fixed locally; the completed deployed worker was resumed using its preserved ledger, not a reset or another publication.
- Real turns needed at most two provider calls. The third lookup/action/answer continuation and one successful-answer allowance were tested in isolated PostgreSQL, not misrepresented as a live three-call turn. Native accounting and public staging records both settle actual provider usage; final saved reopens cost zero calls.
- Free 1/3/5-card and navigation checks preserve synthetic Seeds. The one explicitly authorized synthetic career report spent 100 Seeds once, used only confirmed prototype-goal context and reopened from cache. Real QA balance/subscription fingerprint unchanged. No real Stars charge or production paid generation.
- Local Node 22: frontend **257 PASS**, backend **670 PASS / 1 optional SKIP**; types/lint/backend build PASS after the final deterministic follow-up boundary. Native PostgreSQL **59 PASS**. Mobile core **16 PASS**, extended **16 PASS** plus RU/EN numeric/player cases. Browser voice uses synthetic PCM and mocked transcription, not a new real STT claim.
- Production preflight 11:28 UTC: all **108 relations / 86 functions** and protected user, garden, payment, ledger and settings fingerprints unchanged. Production GPT-5-mini, $100/month and no held cost; automatic migrations remain disabled. Only the reviewed bounded continuation migration is in the release. Existing encrypted snapshot remains fresh and verified.
- Remaining limits: raw model benchmark misses still exist; conservative prose guards cannot prove all free text and may reject ambiguous correct prose. Russian compatibility can retain English technical terms and be too detailed. Physical iPhone microphone/keyboard/actual authenticated playback and a new real Stars purchase remain manual checks. Current Dark-only policy is preserved.
- Migration verified at 11:32 UTC: exactly two metadata changes (Luna attempt-index constraint and reservation guard), unchanged RLS/grants/owners and all protected financial fingerprints. Anon/authenticated remain denied and service_role allowed. Other application objects unchanged. No data restore or financial rule change.
- Release order: source-bound production build → development PR into main → Railway exact merged SHA SUCCESS → one local prebuilt Netlify production publication → public mobile/API/asset smoke and financial/schema comparison. Git CD remains main-only; a future unskipped main push can supersede the manual artifact. No broad data restore or financial rule change.

## Итоговый отчёт Intelligence 2.0 — 2026-10-18, 11:41 UTC

### A. Архитектура и исправленные причины

Релиз реализован в существующем приложении, без новой системы чатов, кошельков, вычислений Таро или таймеров дыхания. Исправлены конкурирующие правила выбора темы, потеря точного natal/compatibility attachment, пропущенная команда «посмотри», перенос старого текста другого расклада в новый контекст и ограничение одного раунда инструментов. Теперь разрешена ограниченная цепочка lookup → action → answer: максимум три учитываемые provider-попытки для chat, одна успешная пользовательская квота; другие операции сохраняют максимум две попытки. Третий раунд проверен локально и в настоящей изолированной PostgreSQL, а реальные успешные staging-диалоги потребовали максимум два вызова.

Проверенные источники передаются с каноническими названиями профилей, точными ID, типами и расчётными фактами. Явные противоречия имени, положений, аспектов или чисел отклоняются до сохранения ответа. Защитный слой не доказывает истинность произвольного текста и не выполняет скрытую повторную генерацию. Ошибки не считаются успешным ответом, стоимость фактически сделанных попыток сохраняется.

### B. AI-качество и модель

Production: **gpt-5-mini**, без смены модели или денежного потолка. Лимит Luna — **$100/месяц**, настройки OpenAI-аккаунта не менялись. На 12 одинаковых синтетических сценариях × 3 модели получены 8/12, 9/12 и 11/12 совпадений первого ожидаемого инструмента для GPT-5-mini, GPT-4.1-mini и GPT-4o-mini. Это не проценты успешных пользовательских диалогов: все модели допускают ошибки, а первым действием может быть корректный поиск данных. Смена production-модели по этой метрике не выполнялась.

Независимо от метрики вручную прочитаны полные новые ответы и сверены вычисленные факты. Примеры:

- «Посмотри мою натальную карту»: раньше мог появиться только текст обсуждения; теперь открывается сохранённая натальная карта, без повторного вопроса и provider-вызова.
- Совместимость: найденное выдуманное имя устранено, используются принадлежащие пользователю названия двух профилей и выбранный деловой контекст.
- Таро → астрология → обычный вопрос: старый расклад не определяет новую тему; вопрос о прототипе обсуждается как вопрос о прототипе, не заменяется меню медитаций.
- Нумерология: длинный ответ с неточным объяснением мастер-чисел исправлен; итог использует реальные 4/1/3/4/4 и коротко обозначает символические ограничения. Неподдерживаемая подсказка расчёта другого года заменена двумя безопасными RU/EN вопросами для обсуждения.

Остаются стилистические ограничения: отдельные русские ответы используют английские термины аспектов или дают больше деталей, чем нужно. Не заявляется безошибочность AI или человеческое понимание.

### C. Персонализация и приватность

Переиспользованы существующие My Cosmos, подтверждённая память, дневник, реальные практики, карты рождения и история. Контекст ограничен по объёму и запрашивается по теме; полная история не отправляется целиком. У записей памяти сохранены источник, время и подтверждение. Неподтверждённые, удалённые и запрещённые сведения исключаются. Отзыв/удаление создаёт границу приватности: старое согласие на вложение нельзя молча переиспользовать. Именно это обнаружилось при возобновлении тестовой сессии и было исправлено в тесте явным повторным выбором карты, а не ослаблением защиты.

Знакомство с Луной запускается внутри чата через существующий компонент, необязательно и без покупки; редактирование в My Cosmos сохранено. Локально проверены ответы, пропуск, возврат, повторное открытие и согласия. Реальное сохранение/удаление/исключение памяти проверено в staging. Новый физический iPhone-прогон знакомства в этом релизе не выполнялся.

### D. Нативные действия

| Возможность | Реализовано и опубликовано | Фактическая проверка |
| --- | --- | --- |
| Таро 1/3/5 | Выбор/раскрытие внутри чата, прямое/перевёрнутое положение, увеличение, сохранённый контекст | Реальные staging-записи и AI-интерпретации, бесплатное повторное открытие; локальные мобильные жесты |
| Дыхание | Общий таймлайн, Start/Pause/Resume/Stop, полноэкранный вариант | Локальное управление/возврат вкладки; реальные 62 секунды доказательства и ровно одно награждение в staging |
| Медитация | Настоящий опубликованный каталог, права, язык, длительность и существующий плеер | Реальная серверная рекомендация; локально открыт правильный плеер, не выдано ложное сообщение об автозапуске |
| Астрология и совместимость | Точные типы и ID, оба выбранных профиля, контекст связи | Реальные расчёты и ответы staging; контекст не заменён Таро |
| Навигация | Разрешённые точные назначения, без обещаний неподдерживаемых файлов/действий | Детерминированные регрессии и реальные публичные переходы |
| Коммерция | Серверный каталог, явное согласие, один атомарный заказ, восстановление/кэш | Native concurrency/refund/entitlement тесты; один синтетический разбор куплен и открыт повторно без дубля |

Production-доступность страниц проверена без поддельного Telegram initData. Полный авторизованный путь на личном iPhone нельзя считать проверенным только по HTTP 200.

### E. Расчётные системы и глубокие разборы

Добавлен воспроизводимый версионированный модуль нумерологии по подтверждённой дате: жизненный путь, число дня рождения, личные год/месяц/день. Григорианские даты валидируются; исходная дата не включается в AI-контекст модуля. Интерпретация прямо помечается символической, не научным прогнозом. Расчёты по имени, произвольному году и неподключённым системам не обещаются.

Текущие транзиты рассчитываются существующим астрономическим движком к точной натальной карте; возвращаются время UTC и именованные аспекты. Неизвестное время рождения не превращается в выдуманную точность. Пять упомянутых в ответе аспектов независимо совпали с расчётом на 2026-10-18T11:10:00Z.

Deep Personal Analysis теперь имеет шесть явных тем и использует доступные подтверждённые источники/поддерживаемые расчёты. Сохранены старые хэши оплаченных результатов. Проверенный career-разбор сослался только на подтверждённую цель прототипа, предложил тест с двумя добровольцами и честно обозначил отсутствие других источников.

### F. UX/UI

Уплотнены контекст и история разговоров, добавлены поиск и группировка. Приветствие не расходует provider-вызов. My Cosmos не показывает ложное пустое состояние при загрузке. В Journey переиспользован фактический семидневный ритм. Поделиться 1/3/5 картами можно в трёх форматах с полной рамкой. Достижения, библиотека, Profile, дневник и существующие ассеты не переписаны в отдельную систему.

Проверены 360×800, 375×812, 390×844, 393×852, RU/EN. В текущей production-политике приложение Dark-only; проверки системного Light preference не означают добавления новой Light-темы. Публичные Home, Astrology, дыхание, AI и Profile — 40 проверок; ещё 4 проверки подтвердили доступность нижних CTA после прокрутки. Просмотрены актуальные production-скриншоты, критических перекрытий/горизонтального скролла/битых изображений не найдено.

### G. Монетизация

Каталог прочитан непосредственно из production после релиза; он не изменён:

- Premium: 500 Stars / 7 дней, 1000 / 30 дней, 5000 / 365 дней, Lifetime 10000. Эти текущие покупки предоплаченные, без автоматического продления. Ранее приобретённые права сохранены.
- 20 дополнительных стандартных AI-ответов — 50 Moon Seeds; глубокий персональный разбор — 100 Seeds. Оба продукта разрешены в действующем серверном каталоге.
- Пакеты: 100 Seeds / 100 Stars, 300 / 270, 700 / 590, 1500 / 1190. Существующие цены раскладов 15/40/70 Seeds и совместимости 100 Seeds не менялись.
- Современная реферальная цепочка включена на следующем успешном Railway deployment: `LUNA34_REFERRALS_ENABLED=true`; существующие DB-разрешения уже были включены. Награды 30 пригласившему / 20 новому, максимум 5 квалификаций в месяц. Положительный сценарий, self/duplicate/race защита проверены в изолированной PostgreSQL. Реального приглашённого пользователя не выдумывали.
- Новая месячная система commercial quotas остаётся выключенной согласно действующей конфигурации; прежние пользовательские квоты и права Lifetime не сужены. Legacy `luna30.referralRewards=false` в health относится к старому механизму, не новому `luna34`.
- Реальных Stars-транзакций в этом прогоне: **0**. Балансы, платежи и подписки production совпали с preflight; AI-проверки не использовали средства пользователей.

### H. Тесты, стоимость и границы доказательств

- Node.js 22.23.3 локально; Railway 22.14.0. Frontend **257 PASS**, backend **670 PASS**, **0 FAIL**, **1 необязательный SKIP**. TypeScript, ESLint и обе сборки PASS.
- Native PostgreSQL **59 PASS**: 42 текущих + 17 исторических тестов, включая RLS, grants, повторное применение, безопасный обратный guard, финансовые гонки, старые права и объекты другого приложения.
- Реальный конечный staging-прогон: **58 проверок**, **59 provider-вызовов**, **$0.0603846** по actual usage и стандартным тарифам; из разрешённых 60 / $0.50. Неизвестный/удержанный расход 0, тестовый worker закрыт, обычная staging-генерация OFF.
- Измеренная стоимость: обычный ответ $0.0009764; 1/3/5 карт $0.00083325 / $0.001371 / $0.00182275; исправленная совместимость $0.0020768; транзиты с инструментом $0.0020537; исправленная нумерология $0.0012929; career-разбор $0.000916. Повторное открытие — 0 provider-вызовов. Подробные токены/кэш/latency — в `LUNA-INTELLIGENCE-BENCHMARK.md`.
- Локально 16 основных + 16 расширенных mobile-сценариев, дополнительно RU/EN числовая панель и плеер. Голосовой browser-тест: синтетический PCM и подменённая транскрипция; реальный микрофон/STT заново не оплачивался.
- Production: 40 публичных mobile-проверок + 4 проверки прокрутки; 79 WebP колоды отвечают 200, хэши 5 стартовых assets совпадают с локальной сборкой, SHA найден в bundle. Приватные API возвращают 401 без авторизации; ошибок выполнения приложения не найдено. В браузерном прогоне записи блокировались, production AI-вызовов 0.
- Ранние ошибки AI не скрыты и включены в стоимость. Три локальных HTTP-теста сначала упёрлись в sandbox EPERM; повторены с разрешённым loopback и прошли. Некритичное предупреждение: основной chunk 623.72 kB / 181.49 kB gzip, дальнейшее разделение остаётся оптимизацией.

### I. Deployment и восстановление

Основное приложение: **https://luna-telegram-miniapp.netlify.app**.

- Development: `feature/luna-intelligence-2-0`; PR **https://github.com/luna-meditation/luna-telegram-mvp/pull/30**, merged, без конфликтов. Прямой push в main не выполнялся.
- Production branch: **main**. Commit: **93c9b6a5819296ffb65052248f8b25522995cdad**. Дерево `dd6d3dcdbc1a318f3927b4e9d00a70a2dda13338` совпадает с проверенной development-сборкой.
- Railway: **4d7c46ce-6587-46d4-889e-715023f7b6ae — SUCCESS**. Health сообщает точный SHA/project/model, Telegram webhook настроен, автоматические миграции отключены.
- Netlify: **6ad4af8048d9b50d40d9be07 — Ready**, published **2026-10-18 11:37:42 UTC**. Одна production-публикация; 13 новых файлов, никаких QA Functions. Git build пропущен меткой `[skip netlify]`, в опубликованной версии SHA дополнительно подтверждён хэшами/bundle.
- Миграция: только `20261018100000_luna_intelligence_bounded_tool_continuation.sql`. Post-hash `8836efeea0118ad26759621e58fa48a5`. RLS/FORCE, ACL и SECURITY INVOKER сохранены; anon/authenticated запрещены, service_role разрешён. Сравнение 108 relations / 86 functions показало ровно две согласованные metadata-разницы; другие приложения не затронуты.
- Backup 10:27:14 UTC: 80 таблиц / 2313 строк, 84 функции, 1 view; две точные изолированные проверки восстановления. Все 28 Storage-архивов / 239528218 исходных байтов проверены расшифровкой/хэшами. Копия зашифрована, ключ вне Git; временные открытые базы удалены.
- Путь восстановления: отключить новую функцию при критической регрессии, выполнить проверенный обратный guard без удаления третьих исторических попыток; исправление frontend — проверенный Git revert/fix-forward и новая сборка, не Netlify restoreSiteDeploy. Данные/историю не перезаписывать backup автоматически. Откат не потребовался.

### J. Что осталось проверить вручную

Не обнаружено открытых критических блокеров в проверенном объёме. **DEPLOYED** и **TESTED** не равны полной физической проверке личного аккаунта. На iPhone полностью закрыть старое окно обычной Luna (не QA), открыть заново и проверить:

1. Луна ИИ → «Познакомиться с Луной»: пропуск, сохранение и повторное открытие; RU остаётся выбранным.
2. Расклад на пять карт: выбрать/раскрыть, увеличить, открыть историю без повторной генерации; затем переключиться на натальную карту/совместимость.
3. Дыхание на минуту: Start/Pause/Resume/Stop, отсутствие перекрытия при клавиатуре.
4. Медитация: пользовательским нажатием Play запустить реальный звук, сверить нужную запись и завершение.
5. Голос: разрешение микрофона, запись/отмена/прослушивание, редактирование распознанного текста. Сам новый запрос может использовать обычную квоту.
6. Profile → кошелёк/подписка: убедиться в своём реальном балансе и правах; покупку подтверждать только намеренно, не ради формальной проверки.

Новые платные сервисы не подключены. Ни один ручной шаг не требует передавать секреты или initData. Полный авторизованный production E2E, физический микрофон и реальная новая Stars-покупка остаются явно непроверенными в этом прогоне.

## Intelligence 1.0 — historical release evidence

## Boundaries and verified baseline

All four owner specifications received on 2026-10-18. Scope: actual chat actions, typed context/attachments, relevant authorized personal retrieval, conversational quality and embedded experiences; no unrelated UI redesign or changes to financial terms.

Authoritative repository: `luna-meditation/luna-telegram-mvp`. Remote main verified at `4774edf550ab81d10bc54682883cefad6b527859`, tree `4c37117965ef9f31729ab18ae49441573f15531e`; the local starting tree is identical. Work branch: `feature/luna-intelligence-1-0`. Existing unrelated local changes are preserved.

Production remains the released Luna 4.3 while development proceeds. Premium prices 500/week, 1000/month, 5000/year, 10000/Lifetime Stars; existing Seeds prices/ledger/entitlements, monthly $100 cap and user data are not changed. No real Stars charge or destructive production test is authorized.

## Verification checkpoint — 2026-10-18

- Implemented shared owner-bound action preparation, strict seven-type attachment renderer, embedded Tarot and the single canonical breathing session component. New flow and prompt remain opt-in by default. No database migrations.
- Node 22: frontend 256 PASS; backend 657 PASS / 1 optional SKIP; TypeScript and lint PASS. Native PostgreSQL: 17 legacy + 39 current financial/RLS/concurrency tests PASS, synthetic local data only.
- Fresh encrypted Luna-only snapshot at 08:06:15 UTC: 80 tables / 2272 rows, 84 functions, 1 view; two socket-only PostgreSQL restores verified exact rows, constraints, policies and grants. Restored plaintext databases removed after verification. All 28 avatars/meditations archives (239528218 bytes) decrypted and hash-checked; current Storage versions match. Other application's data excluded.
- Live read-only preflight at 08:03 UTC: all 108 shared public table/view definitions, 86 function definitions and financial fingerprints match the released 4.3 baseline. Railway still SUCCESS at 05089b08-3507-43de-bad3-88f35c41da26; main still 4774edf550ab81d10bc54682883cefad6b527859. Production writes: 0.
- Paired benchmark: all 150 decisions completed, identical per-case input hashes, 50 cases / 3 available models. Cost $0.1021413. Raw first-call tool matches: GPT-5-mini 37/50, GPT-4.1-mini 29/50, GPT-4o-mini 44/50; these are NOT end-to-end success or conversational-quality percentages. Every model has action/grounding failures. Keep GPT-5-mini; do not deploy a model switch based on tool-match alone.
- Real staging at 6ad47b7c5d4d688ffdb4b127: 1/3/5 cards selected, revealed, AI-interpreted, saved and reopened without provider calls; actual compatible reports/natal chart, confirmed memory filtering, signed QA Telegram auth, owner isolation, one elapsed breathing proof/reward, QA financial state all checked. Initial total 157 provider calls / $0.11363775, no unknown spend or held cost; normal staging generation restored OFF.
- Manual review caught a critical semantic regression missed by the initial smoke assertion: ordinary "help me choose a prototype step" was overwritten by legacy generic meditation routing. Fixed by scoping legacy heuristics, requiring relevant real action evidence and clearing explicit topic switches. False action acknowledgements now fail closed; explicit supported destinations and common meditation typos execute deterministically. Full tests repeated. A single necessary corrective staging publication will verify this fix, not rerun the 150-call benchmark.
- Local mobile: 16 measured EN/RU Tarot/breathing cases at 360/375/390/393 px PASS, plus reveal/zoom/reversed state and actual player opening. Fixture-backed browser QA is distinct from real staging storage tests. Current Dark-only production theme policy preserved. Physical iPhone/real microphone check remains manual.

Corrected-topic smoke PASS on staging 6ad481099906610d12d9be22, runtime source 508a9bbbc4768cd0241cadefe58be205bbbc71eb. The ordinary response now addresses the prototype rather than a meditation menu; typo recommendation, support navigation and honest unsupported-file response reuse saved results with zero provider calls. Finite worker closed; 43 real checks PASS, 158 provider calls total, $0.1144434 actual usage cost, held/unknown cost 0. Normal staging generation restored OFF. The 150-case decision set was not rerun or relabeled as 150 end-to-end conversations.

Final Node 22 checkpoint: frontend 256 PASS; backend 657 PASS / 1 optional SKIP, zero failures; lint/type checks/backend build PASS. Source-bound release evidence is generated locally at `qa/luna-intelligence-release-review.json` (Git-ignored), requiring exact project IDs, current backup, all real staging results, unchanged money/data and no migrations. Production Netlify profile explicitly selects Intelligence; CLI publishes a prebuilt verified artifact, not a synthetic preview. Auto development builds are restricted to main and PR previews are disabled; release commit also skips automatic Netlify builds.

## Coordinated work

| ID | Task | Status | Required evidence |
| --- | --- | --- | --- |
| A1 | Trace exact request, attachment, tool and UI lifecycle | VERIFIED | Generic wellness keyword override and stale context fixed; actual operation IDs/statuses retained |
| A2 | Central verified action registry and discriminated context/attachment contract | IMPLEMENTED / TESTED | Owner-bound handlers, seven discriminants, destinations, failure checks |
| A3 | Unambiguous commands plus structured tools for ambiguity | IMPLEMENTED / TESTED | 40 multi-turn deterministic fixtures plus real typo/navigation/topic regression |
| C1 | Consented relevant context from existing sources | IMPLEMENTED / TESTED | Exact report IDs/pair/kind; confirmed memory only, bounded owner retrieval and privacy boundary |
| U1 | Embedded Tarot using existing engines | VERIFIED STAGING + LOCAL UI | Actual 1/3/5 persisted/reopened/generated; browser selection/reveal/zoom |
| U2 | One canonical breathing timeline/accounting | VERIFIED STAGING + LOCAL UI | Start/pause/resume/stop; real elapsed proof completes and rewards once |
| U3 | Real meditation + existing commerce | VERIFIED WITH LIMITS | Actual catalog card and local player opening; isolated financial concurrency tests, no real Stars charge |
| P1 | Modular personality, starters and title policy | IMPLEMENTED / MEASURED | RU/EN, consent/cooldown tests; possible verbosity remains documented |
| Q1 | 50-case paired model benchmark and actual dialogues | COMPLETE / REVIEWED | 150 benchmark + 8 smoke calls, $0.1144434, no model switch |
| Q2 | Node 22 and responsive checks | PASS | 256 frontend / 657 backend, 1 optional SKIP, 16 measured browser cases; physical phone remains manual |
| R1 | Backup/recovery, data/financial/RLS preflight | PASS | Fresh 80-table encrypted backup, 2 exact restores + 28 media, no migrations |
| R2 | One coordinated production release after gates | DEPLOYED / PUBLIC SMOKE PASS | PR #29, Railway SUCCESS and Netlify Ready, exact SHA, no financial/schema drift |

## Initial verified root causes

- `ChatBreathing.tsx` currently renders a selector and dispatches navigation; it contains no working circle inside the chat.
- Existing `ChatTarotReading.tsx` can reveal saved cards, so it must be reused, not replaced by another draw engine. Creation/selection routing still needs a complete lifecycle review.
- Existing tools, navigation registry, typed outcome/idempotency and owner-scoped storage already exist; extend these rather than creating a competing action framework.
- The historical 4.3 symbolic context boundary only distinguishes `tarot` versus generic `astrology`; exact compatibility/natal discriminants must survive every hop.

## External documentation checked

Official OpenAI Structured Outputs and GPT-5-mini model documentation fetched; keep the current model as baseline. Supabase changelog reviewed: upcoming TLS cipher deprecation does not require changing Node 22/modern iPhone clients; no unrelated project upgrades. Server authorization/owner filters remain mandatory even with service-role credentials.

## Evidence and completion policy

Development checkpoint: Node 22 frontend 256/256 PASS; backend 653 PASS / 1 optional SKIP. Forty deterministic multi-turn action scenarios plus authorization/idempotency/typed-context tests pass. Sixteen browser UI cases (360/375/390/393 widths, EN/RU, Tarot/breathing) pass using isolated local fixtures, NOT real database proof. Screenshots and measured geometry: `/tmp/luna-intelligence-mobile/`. Corrected inherited six-column card positioning and full-page breathing styles; circle center error under 0.01 px and Stop remains above the composer. Five-card selection/reveal, reversed detail view, tab-return breathing pause/resume and real existing meditation-player opening exercised locally. Current production Dark-only policy is preserved, not relabeled as new Light support. Provider calls on this program so far: 0. Production unchanged.

No new SQL migrations are planned. New origin/action metadata is outside the existing strict Tarot-state object, preserving its old parser shape. New entry points/prompt are disabled by default behind frontend/backend `luna_intelligence` flags; prepared action history still uses the shared renderer. Existing prices, ledger and all accounting services remain authoritative. A finite private staging worker stores one durable 180-call/$1 budget and blocks ordinary QA API generations while temporarily testing real synthetic data; restoration is fail-closed. New secrets are not exported or added to client variables.

No feature is marked complete because a UI card or plausible answer exists. Distinguish implemented, locally tested, real provider/server verified, deployed and production end-to-end verified. Record failed gates and fixes; no repeated staging publication to test cosmetic work. Paid benchmark authorization is requested once separately; local work continues without waiting.

## Safe release / rollback

1. Check unchanged remote main, production site/backend IDs, schema/grants and current $100 cap. Preserve all secret values and financial flags. Merge reviewed development PR only after final build passes.
2. Set only `FEATURE_LUNA_INTELLIGENCE=true` and `AI_PROMPT_VERSION=intelligence-v1` on the existing Railway service, without a separate redeploy; the merged main build supplies code. Startup migrations remain disabled.
3. Wait for Railway SUCCESS, exact merged commit, health and real authentication guards. Build the frontend locally on Node 22 against that verified API; publish once to the existing production Netlify site. No provider/QA worker is bundled in the production frontend.
4. Verify Ready, source SHA, assets, public UI/mobile, auth failures and unchanged financial/schema fingerprints. Real device/microphone and an authorized real payment remain separate manual evidence, not implied by public health checks.
5. On a critical regression stop rollout; disable the new feature/restore a verified runtime configuration, then fix forward through a reviewed Git revert and verified rebuild. Do not use Netlify restoreSiteDeploy/publishDeploy. No historical balances/history are deleted. The verified encrypted backup is disaster recovery only, never an automatic overwrite of live users. Intelligence 2.0's narrow RPC inverse is documented separately and retains historic third-attempt cost rows.

## Final production report — 2026-10-18 08:40 UTC

1. Root causes: generic "choose/show" wellness heuristics overwrote ordinary replies; stale artifact types conflated natal/compatibility; earlier chat cards dispatched navigation rather than embedding the session. Explicit selectors, scoped intent, exact references and execution guards now address these cases. The observed prototype-topic failure was fixed and retested, not hidden.
2. Architecture: one typed seven-kind attachment renderer, owner-bound strict tool/action inputs, stable operation IDs and idempotent existing service calls. Legacy strict Tarot state remains compatible. Default flags are OFF; this verified production profile enables Intelligence explicitly.
3. Production model: **gpt-5-mini**, unchanged. Server `AI_PROMPT_VERSION=intelligence-v1`; existing $100 monthly cap retained. No secret exported to frontend.
4. Model comparison: 50 identical cases × 3 models = 150 decisions. Raw expected first-tool matches 37/50, 29/50, 44/50 for GPT-5-mini/4.1-mini/4o-mini; all have semantic/grounding limits. This is not a claim of 100% conversational correctness. See `LUNA-INTELLIGENCE-BENCHMARK.md`.
5. Personalization: bounded relevant confirmed memory, privacy-boundary filtering, explicit save proposals; pending/deleted facts excluded. History/journal lookup is owner-scoped and consented. Exact preferred name and RU/EN remain supported.
6. Embedded Tarot: actual 1/3/5 chooser/reveal/zoom, upright/reversed data, saved reading context and free reopen verified through staging services and local mobile UI. Existing secure 78-card engine and artwork reused; all 79 production WebP files return HTTP 200.
7. Embedded breathing: the same elapsed-time phase engine, pause/resume/stop, proof heartbeats and exact-once completion/reward. Local tab-return works; cold reopening does not silently resume a timer. Actual 62-second staging completion checked; no duplicate reward.
8. Meditation: actual published catalog/access/language data and existing player, no invented track or false playback acknowledgement. Correct player opening tested locally, real server recommendation verified in staging. Playback requires a user tap.
9. Compatibility: distinct exact pair/report/comparison/relationship context; calculated synthetic chart and business follow-up verified, then switched to natal Mercury and general chat without old Tarot contamination.
10. Commerce: existing server catalog, wallet, explicit confirmation, pending continuation and atomic services retained. Premium 500/1000/5000/10000 Stars, AI pack 20/50 Seeds and deep analysis 100 Seeds unchanged. Native tests cover races/refunds/old rights; no real charge or production paid AI test performed.
11. Checks: Node 22, frontend 256 PASS; backend 657 PASS + 1 optional SKIP; lint/types/build PASS; 56 isolated PostgreSQL checks; 43 real staging checks; 16 local embedded mobile cases and 16 live public Home/AI layout cases at 360/375/390/393 EN/RU. Public composer does not overlap navigation; no horizontal overflow. Browser without Telegram auth cannot verify private history. Telegram SDK's standalone-browser 6.0 fallback logs unsupported `checkHomeScreenStatus`; no fatal application/chunk error observed.
12. Cost: 158 total provider calls, $0.1144434 at actual usage/published rates, below 180/$1. Saved reopen 0 calls. Ordinary corrected chat $0.00080565; 1/3/5 Tarot $0.000859/$0.0015065/$0.001936; compatibility $0.00164265. No new deep-analysis or STT cost benchmark claimed. Context/tool overhead and model limits are detailed in the benchmark document.
13. Production: PR https://github.com/luna-meditation/luna-telegram-mvp/pull/29 merged into **main**, commit **58ab85e4729e93197cefa534160cda4172be8e0c**. Railway **2b7aab5c-b121-45f9-a20d-40380f3c6ebc — SUCCESS**, Node 22.14.0. Netlify **6ad4856325d11edfbdc840e3 — Ready**, published 08:38:00 UTC. URL **https://luna-telegram-miniapp.netlify.app**. Backend exact SHA/project/model/Telegram readiness and 6 absent/forged-auth rejects PASS; production JS/CSS match local hashes. No QA Functions shipped to production.
14. Remaining manual checks: real iPhone Telegram keyboard/microphone and actual authenticated playback should be auditioned; a real Stars transaction was intentionally not performed. Voice is the preserved recording → transcription → editable text → normal chat pipeline, not a new stored audio-message/TTS system. Models can still be verbose or generic; unsupported claims fail closed. Current Dark-only policy preserved, no new Light support claimed.

Post-release at 08:40 UTC: shared schema/RLS, function/grant definitions, triggers and all Luna balances/entitlements/payment/ledger fingerprints match pre-release. No production SQL migrations or data resets. Backup: `pre-luna-intelligence-20261018.85Sdp6`, 80 tables / 2272 rows, two exact isolated restores + 28 media archives verified. Existing unrelated worktree edits and old feature branches preserved.
