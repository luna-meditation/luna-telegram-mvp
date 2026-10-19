# Meet Luna 4.0 — production release, 19 октября 2026

Статус: **опубликовано, доступность и безопасные production smoke-проверки PASS**.

- Приложение: https://luna-telegram-miniapp.netlify.app/
- Telegram: существующий https://t.me/lunameditation_bot — новый bot ID/token не создавался.
- PR: https://github.com/luna-meditation/luna-telegram-mvp/pull/32
- Production commit: `4e632959bb459ce7548b59d404fe65d3c78d2c3f`.
- Проверенный tree: `de7e5823e124a9e3a9687fcb0a28bf05de0624f6`; финальный реальный backend QA source: `ec715d79bf727acc61e4f7e15a7162f04829de20`.
- Railway: `2beffe6d-6754-49b4-9bcd-2f20e084f4ad` — SUCCESS, Online, Node 22.14.0, один running replica, crashes/failures 0, pending work 0.
- Netlify: `6ad56f5c30d4a35acbdd9271` — Ready/current; `2026-10-19T01:16:18.914Z`, **09:16 Asia/Makassar**. Одна frontend production publication, локальная Node 22 сборка, 16 новых/изменённых uploaded files. QA Functions/Edge Functions не публиковались.

## Что доступно

Единый разрешённый персональный контекст и resolver сохранённой даты; narrative «Мой космос» с реальными источниками, birth discovery с подтверждением; девять компактных действий чата, встроенные Journal/Cosmos/date numerology; сохраняемое бесплатное приветствие/follow-up без автоматического AI-расхода; saved paid report delivery/history/discussion; безопасная recovery существующего атомарного paid-operation механизма; видимая отдельная voice quota; source-bound feedback и фактическая недельная сводка.

Tarot 1/3/5 остаётся прямо в чате: выбор, reveal, upright/reversed, zoom, сохранение, обсуждение точного reading. Reversed follow-up не создаёт новый расклад. Медитации используют настоящий catalog/access и существующий player, дыхание — тот же elapsed-time engine и completion proof. Astrology/compatibility привязаны к точным owner-selected chart/pair; десять planet quick replies не теряют карту. Явные menu/profile/resume команды выполняют реальную навигацию вместо обещаний.

Основные изменённые файлы: `luna-ai.ts`, `luna-intelligence-{command,actions,turn,grounding,prompt,personal-context}.ts`, `personal-context-engine.ts`, `birth-discovery*.ts`, `personal-portrait*.ts`, `personal-reflection.ts`, `companion-*.ts`, `personal-report-context.ts`, existing memory/voice/seed-product services; frontend `App.tsx`, `LunaChat`, `LunaActionSheet`, `LunaVoiceInput`, `BirthDiscoveryCard`, `ChatPersonalSpace`, `MyUniverse`, `PersonalPortraitView`, Journal/feedback/weekly/report/Tarot/astrology components; regression tests, preview/release scripts, evidence и `netlify.toml`. Полный список **88 production files**: [PR Files changed](https://github.com/luna-meditation/luna-telegram-mvp/pull/32/files).

## AI и стоимость

Production model **gpt-5-mini**, не менялась. Единственный production configuration delta: `AI_PROMPT_VERSION=meet-luna4`. Серверный API-ключ не выгружался в frontend/чат/Git.

Исправлены реальный caller, ошибочно использовавший legacy policy; stale/unanswered context; смешение chart и Tarot; повторные tools при объяснении exact saved evidence; неверное присвоение планетных аспектов; потеря chart в quick reply; negated Tarot intent; отсутствие реальной проверки доступа к практике; несовместимость со штатным paid-result envelope. Failed outputs не считаются successful answers и не ретраятся автоматически.

Фиксированный benchmark: 60 GPT-5-mini кейсов + 6 парных comparative decisions + 4 before-policy decisions. Exact first-tool matches 45/60; alternatives 3/3 и 3/3. Это маленькая выборка и не E2E-процент. Все 15 несовпадений разобраны; исправления проверены полными server journeys, не объявлены новым 100%-benchmark. Ограничение многословности модели остаётся.

Конечный approved budget 100 Responses + 6 STT, $0.75 общий. Фактически **95 Responses + 3 STT, $0.0758998** по usage/rates, включая неудачные попытки. Unknown cost/holds 0; journal закрыт, обычная staging generation OFF. Production тестовых AI-вызовов **0**. Открытие saved результатов — **0** дополнительных вызовов. Полная таблица tokens/cost и before/after: [Execution](MEET-LUNA-4-EXECUTION.md).

## Проверки

- Node 22.23.3: **723 backend PASS + 1 optional SKIP**, **275 frontend PASS**; types/lint/backend build/frontend production build PASS.
- PostgreSQL 17 на production schema без пользовательских строк: **9 security/concurrency checks PASS**, включая 12-way retries и fulfillment/refund race.
- Локально Chromium/WebKit RU/EN 360/375/390/393: **160 PASS**, 40 Retina screenshots. Saved paid-report UI **4 PASS**; synthetic browser PCM **4 PASS**.
- Реальный существующий staging backend: **78 PASS** — память/consent/CRUD, 1/3/5 и бесплатный reopen, actual chart/pair, one-debit paid result, real 62s breathing proof/replay, три actual STT, foreign-owner denial.
- Production: **48 public mobile checks PASS**, 79/79 Tarot WebP HTTP 200, HTML/JS/CSS hashes совпали с local production build, Telegram SDK подключён, no synthetic initData, no fatal runtime/chunk errors, горизонтального overflow нет. GET protected Admin/profile/chat/meditation API без auth → 401.
- Post-release Supabase: **108 relations / 86 functions**, RLS/ACL/SECURITY DEFINER/config/triggers и финансовые fingerprints совпали с preflight. Это не замена новой физической authenticated Telegram-сессии.

## Данные, подписки и recovery

Новых миграций, новых проектов, сбросов данных и live payment configuration изменений **нет**. Существующие Moon Seeds, сад, история, память, Lifetime и fixed-term entitlements сохранены. Premium Stars 500/1000/5000/10000; AI 20/50 Seeds, deep 100 Seeds — без изменений. Реальных тестовых Stars charge/refund не было.

SQL подтвердил действующий общий AI cap **$100/месяц**. Generation/Public Beta включены как прежде, beta expires `2026-10-31T16:00:00Z` (1 ноября 00:00 Asia/Makassar). Новые финансовые условия не вводились.

Backup: `pre-meet-luna4-20261019.Y4f2kJ`, encrypted Luna-only **80 tables / 2512 rows / 84 functions / 1 view + 28 Storage archives**, два независимых точных восстановления; SQL/media hashes PASS, capture <24 h на момент выпуска. Ключ отдельно вне Git. При аварии — остановить изменения, проверить actual state, вернуть совместимую runtime policy и fix-forward verified Git revert/rebuild; не перезаписывать пользователей автоматически и не использовать Netlify restoreSiteDeploy/publishDeploy.

## Что не объявляется полностью проверенным/готовым

1. Физический iPhone Telegram microphone/keyboard и прослушивание actual audio в этой версии. Голос пока editable transcription, не stored voice messages/call.
2. Новая настоящая Stars-покупка не выполнялась автоматически; только synthetic accounting/concurrency и сохранность прошлых записей.
3. Полный архив всех ревизий портрета и новая отдельная feedback карточка в standalone meditation PlayerPage не реализованы; поддержанные source-feedback пути работают.
4. Dark-only политика сохранена. Midheaven/Human Design/Jyotish/BaZi не имитируются. Bot username `@Meetluna_bot` не подтверждён; рабочая прежняя идентичность сохранена.
5. В production публично проверен shell и authorization denial; owner-private journeys с новыми AI-ответами проверены в настоящем staging, не на synthetic production user.

На iPhone: полностью закрыть обычную Luna (не QA), открыть снова через существующего бота. Проверить RU/«Мой космос»/сохранение заметки; запросить 1/3/5 из чата и открыть saved result; проверить запись → отмена/stop → редактирование → Send, keyboard и Play. Для бесплатного осмотра достаточно открыть сохранённые результаты, не отправляя новых AI-сообщений.
