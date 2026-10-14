# Luna 2.0 Phase 1 — повторный review и тест миграции

Дата: 13 октября 2026. Ветка: `agent/luna-2-phase-1-foundation`.

## Результат

Миграция `20261013061155_luna_security_boundary_hardening.sql` прошла изолированную проверку на PostgreSQL 17.6 — той же версии, что production. Она совместима с DB/API-кодом текущего `main` (`8b2bdd5`); `backend/src/db.ts`, `backend/src/luna-ai.ts`, `plans.ts` и `payment-policy.ts` не менялись. Production получал только запросы к системному каталогу. Изменений production, merge и deployment не было.

SHA-256 проверенного SQL:

```text
179ecc18f9a00745e03b6a0caa892f2b1483c9f790dbfcde1346149965f2d677
```

## Проверка исходных 28 файлов

| Файл | Проверено |
| --- | --- |
| `backend/.env.example` | Все семь flags и RUN_MIGRATIONS — false |
| `backend/package.json` | Полный test glob включает все существующие suites |
| `backend/src/backend-schema-sync-migration.ts` | Ограничение playback grants и RLS не расширяет доступ |
| `backend/src/config.ts` | Настоящий runtime resolver сохраняет false defaults |
| `backend/src/feature-flag-definitions.ts` | Полный набор из семи flags, совместимость типов |
| `backend/src/feature-flags.test.ts` | Дополнен настоящей runtime проверкой в DB harness |
| `backend/src/feature-flags.ts` | Только серверные env boolean, без пользовательских override |
| `backend/src/luna-ai-migration.ts` | Квалифицированные relations, revoke клиентских ролей |
| `backend/src/luna-ai-rpc-ambiguity-fix-migration.ts` | Текущий production контракт RPC сохранён |
| `backend/src/luna-ai-rpc-migration.ts` | Оба RPC остаются доступны service_role, search_path пустой |
| `backend/src/migrations.ts` | Legacy runner больше не вызывается startup backend |
| `backend/src/phase1-security.test.ts` | Static checks дополняются реальным SQL/API тестом |
| `backend/src/version.ts` | Добавление flags не изменяет существующие поля API |
| `database/schema.sql` | Hardened определения для новой базы; полный schema.sql не применяется к production |
| `docs/phase-1-security-hardening.md` | Rollback реально выполнен и восстановил baseline permissions |
| `frontend/.env.example` | Все VITE flags — false |
| `frontend/src/App.tsx` | Только incremental route integration; player/payment/data flows сохранены |
| `frontend/src/api.ts` | Новые version-поля; существующие запросы сохранены |
| `frontend/src/config/featureFlagDefinitions.ts` | Только явное true включает flag |
| `frontend/src/config/featureFlags.ts` | Defaults проверены в default production build |
| `frontend/src/design-system/components/BottomNavigation.tsx` | Legacy пять вкладок; исправлены четыре равные колонки для test flag |
| `frontend/src/navigation/navigationModel.ts` | Legacy/new model, contextual back и start parameters |
| `frontend/src/navigation/useAppRouteState.ts` | Telegram Back, nested Profile и очистка admin URL с сохранением query |
| `frontend/src/vite-env.d.ts` | BackButton contract соответствует используемым методам |
| `frontend/test/journey-hub.test.mjs` | Legacy Journey/Garden routing сохраняется |
| `frontend/test/phase-1-foundation.test.mjs` | Defaults, locale/theme/safe area и navigation guards |
| `package.json` | Root test запускает frontend и backend suites |
| `supabase/migrations/20261013061155_luna_security_boundary_hardening.sql` | Применение, повтор, rollback, grants/RLS, lock timeout и RPC execution |

## Исправления после review

1. Убрано выполнение `runMigrations()` из `server.ts`. Default false сам по себе не защищал от уже заданного в Railway `RUN_MIGRATIONS=true`. Проверка startup с таким значением теперь отвечает HTTP 200 и не меняет схему/данные.
2. Исправлена устаревшая deployment-инструкция, предлагавшая автоматически применять исторические migrations при restart.
3. В security SQL добавлена атомарная транзакция, `lock_timeout=5s`, `statement_timeout=30s` и precondition для `service_role.BYPASSRLS`.
4. Emergency rollback также обёрнут в атомарную транзакцию с timeout.
5. Исправлена сетка BottomNavigation: локальная новая модель получает четыре колонки; default остаётся пять.
6. Добавлены воспроизводимые DB/API/startup и mobile browser harness. Они требуют Node 22, проверяют loopback URL и используют синтетические данные.

## Изолированная среда и результаты

- PostgreSQL 17.6, timezone UTC; PostgREST 13.0.7, localhost.
- Из production взяты только schema metadata: 51 таблица public/private, 417 constraints, 118 дополнительных indexes, 11 функций, 68 policies, table/function/schema/column grants.
- Пользовательские строки, Telegram IDs, платежи, conversations и memory из production не копировались. Все тестовые записи синтетические.
- Owner `postgres` в тесте — non-superuser с BYPASSRLS; service_role также BYPASSRLS, anon/authenticated без BYPASSRLS и без membership в service_role.
- 41 DB/API/startup сценарий — PASS. Проверены SELECT/INSERT/UPDATE service_role, оба RPC, heartbeat/completion/replay/anti-seek, quota concurrency/idempotency, чужая conversation, search_path/temporary-table shadowing, anon/authenticated denial, запрещённые DELETE/TRUNCATE, попытки SET ROLE и отключения RLS, forged JWT, precondition failure и блокировка более 5 секунд.
- При случайном предоставлении table grants и permissive policy restrictive deny всё равно блокирует доступ клиентских ролей.
- Миграция меняет только три Luna объекта и одну named policy; остальные catalog fingerprints, schema/default/column grants, constraints, indexes и все строки совпали до/после.
- Повторное применение — PASS. Rollback возвращает baseline RLS/ACL/search_path; порядок ACL нормализован, реальные права совпадают. Повтор после rollback — PASS. OID функций сохраняется.
- Lifetime с истёкшим active_until сохраняет Premium; действующий fixed-term сохраняет доступ, истёкший fixed-term его не получает. Moon Seeds 123, history, favorites, achievements, streaks, payments и AI memory сохраняются при миграции.
- Реальные функции backend через local service-role REST успешно выполняют playback и Luna AI reservation/answer/retry. Для AI использован deterministic catalog action: реальный OpenAI не вызывался.
- Frontend: 84/84 PASS. Backend: 146/146 PASS, 0 skipped, включая существующий RPC integration test на localhost.
- Frontend/backend typecheck и lint — PASS. Frontend/backend/website production builds — PASS. Всё на Node 22.23.3.
- Browser: 16/16 default сценариев на 390×844, 393×852, 375×812, 360×800 × EN/RU × Light/Dark. Пять legacy tabs, переключение темы, safe-area 34px, scroll reset, meditation/Garden/admin deep links, Profile child и Telegram Back — PASS; JS errors 0.
- Дополнительный локальный build с new_navigation=true: 2/2 EN/RU сценария — четыре равные колонки, Journey под Profile, back из Garden/Journey в Profile — PASS. Default build и все остальные flags остаются false.

## Что не проверено и отдельный существующий риск

- Это PostgreSQL/PostgREST replica, а не полный hosted Supabase: auth.users/auth.uid/auth.jwt — локальные structural stubs. Cloud Auth, Storage, Vault, Edge Functions, production нагрузка и failover не тестировались.
- Browser использует настоящий Chrome с synthetic Telegram bridge; физический iPhone/Telegram WebView и WebKit не проверялись.
- Реальные Telegram Stars платежи, Telegram messages и OpenAI provider calls не выполнялись. Сохранность payment records и entitlement logic проверена отдельно.
- SHA реально работающего Railway deployment и live Railway variables в этом review не подтверждены. Совместимость проверена с текущим main и свежей production schema; startup проверен локально с production build/config behavior.
- `public.meditations` и `public.practices` сейчас имеют public SELECT policies `using(true)` и anon/authenticated SELECT grants. В meditations есть audio_file и translations. Это существующий канал получения audio URLs и draft metadata в обход frontend Premium UI; текущая миграция его не закрывает. Нужна отдельная задача приватной выдачи media/каталога с проверкой всех потребителей, без изменения этой узкой миграции.

## План production применения после отдельного разрешения

1. Повторно снять schema-only baseline трёх объектов: RLS/ACL/policies playback_sessions, определения/config/ACL/OID обеих RPC, role attributes/memberships. Убедиться, что schema не изменилась после review и backend использует service_role. Сохранить snapshot вне публичного репозитория; подтвердить доступный database backup.
2. Подтвердить отдельное разрешение на named security migration и QA smoke tests. Merge и deployment для её применения не требуются: она совместима с существующим DB/API-кодом.
3. Проверить SHA-256 файла выше. Выполнить только этот файл через согласованный SQL workflow от postgres owner. Не запускать database/schema.sql, старые migrations 006–012 или startup runner. Файл уже содержит BEGIN/COMMIT и timeout; при ошибке выполнить ROLLBACK в той же сессии, проверить отсутствие частичных изменений и разбирать причину, не расширяя grants.
4. После commit проверить RLS=true; anon/authenticated не имеют playback privileges и RPC EXECUTE; service_role имеет только SELECT/INSERT/UPDATE на playback и EXECUTE на обеих RPC; search_path пустой, SECURITY DEFINER/owner/OID сохранены. NOTIFY pgrst включён в транзакцию.
5. На отдельно разрешённом QA-аккаунте проверить начало/heartbeat/завершение короткой практики, историю, повтор, Luna AI запрос и retry. От anon/authenticated получить permission errors на sessions и обоих RPC. Не использовать реальные пользовательские аккаунты для тестовых наград/квот.
6. Сравнить schema/grants fingerprints остальных приложений с baseline; проверить health и отсутствие новых permission errors backend. Проверить без изменений сохранённые balances/entitlements/payment/history/memory records через read-only checks без экспорта персональных данных.
7. Если есть подтверждённая permission-регрессия, выполнить только emergency rollback SQL из `docs/phase-1-security-hardening.md` от того же owner, затем повторить service-role smoke и проверку baseline ACL/RLS/config. Data restore не нужен: миграция не меняет строки. Rollback временно возвращает небезопасные client-role grants; после восстановления сервиса нужен исправленный forward rollout.
8. Merge/main deployment и включение любого flag рассматриваются отдельно. Для будущего Railway deployment держать RUN_MIGRATIONS=false; сервер больше не вызывает мигратор даже при старом explicit true. Никаких изменений payment configuration для этой миграции не требуется.
