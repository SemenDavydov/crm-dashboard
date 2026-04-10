# GBC Analytics — RetailCRM, Supabase, Vercel, Telegram

Проект: загрузка тестовых заказов в RetailCRM, синхронизация в Supabase, дашборд (Chart.js), вебхук на крупные заказы в Telegram.

## Быстрый старт

1. **Supabase — SQL**  
   Выполни в SQL Editor содержимое `supabase/sql/001_orders_tz.sql`  
   (пересоздаёт `public.orders`; если нужна старая таблица — сначала переименуй её).

2. **Переменные окружения**  
   Скопируй `.env.example` → `.env.local` и заполни значения.  
   Для UI с браузера обязательны `NEXT_PUBLIC_SUPABASE_ANON_KEY` и RLS-политики из SQL.

3. **Шаг 1 — заливка mock в RetailCRM**

   ```bash
   npm run upload:mock-to-crm
   ```

   RetailCRM API v5 для POST требует `application/x-www-form-urlencoded`, а поле `order` — **JSON-строка** ([правила API](https://help.retailcrm.pro/Developers/ApiRules)).

4. **Шаг 2 — RetailCRM → Supabase**

   ```bash
   npm run sync:crm-to-supabase
   ```

   Идемпотентность: `UNIQUE(order_number)` + upsert.

5. **Локальный дашборд**

   ```bash
   npm install
   npm run dev
   ```

6. **Папка `dashboard/`**  
   Статическая копия (Chart.js CDN + Supabase JS). Подставь URL и anon в `dashboard/config.js` (или скопируй из `config.example.js`).

7. **Вебхук RetailCRM**  
   В админке: исходящий вебхук на событие создания заказа, URL:

   `https://<твой-домен-vercel>/api/retailcrm-webhook?token=<RETAILCRM_WEBHOOK_SECRET>`

   Либо заголовок `X-Webhook-Token`. При `totalSumm` / `summ` **> 50 000 ₸** уходит сообщение в Telegram (`API_KEY_BOT` + `TELEGRAM_CHANNEL_ID`).

## Скрипты

| Команда | Назначение |
|--------|------------|
| `npm run upload:mock-to-crm` | `mock_orders.json` → RetailCRM (`/api/v5/orders/create`) |
| `npm run sync:crm-to-supabase` | Все заказы из CRM → `public.orders` |
| `GET /api/sync` | То же на Vercel (нужен `CRON_SECRET` + Bearer на проде) |

## Деплой

- Корень репозитория — Next.js для Vercel. Укажи все переменные из `.env.example`.
- После пуша в GitHub Vercel автоматически деплоит.

```bash
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

## Ограничения и типовые ошибки

- **403 Forbidden** к API: неверный ключ, ограничение по IP в RetailCRM или лимит нагрузки.
- **Типы заказа / способ** в CRM должны существовать (`orderType`, `orderMethod`); иначе RetailCRM вернёт ошибку валидации.
- **Cron на Hobby-плане Vercel** — только раз в сутки (`0 0 * * *`). Для более частого синка используй вебхук или Pro-план.
- Секреты не коммить: `.env.local`, токен бота, `service_role`.

---

## Работа с Claude Code: промпты, проблемы, решения

### Какие промпты давал

1. **Структура проекта** — «Создай Next.js-проект с Supabase, RetailCRM и Telegram-ботом»
2. **Mock-данные** — «Сгенерируй 50 тестовых заказов и залей в RetailCRM через API»
3. **Синхронизация** — «Напиши скрипт синка RetailCRM → Supabase с upsert по order_number»
4. **Дашборд** — «Сделай дашборд: график заказов за 7 дней (Chart.js) + топ-5 по сумме»
5. **Telegram** — «Добавь вебхук: при заказе > 50 000 ₸ отправлять уведомление в Telegram-группу»
6. **Деплой** — «Помоги задеплоить на Vercel и настроить переменные окружения»

### Где застрял и как решил

| Проблема | Как проявилась | Решение |
|----------|---------------|---------|
| RetailCRM не принимал JSON body | 400 Bad Request при POST | API v5 требует `x-www-form-urlencoded`, поле `order` — JSON-строка |
| `orderType=eshop-individual` не существовал | Ошибка валидации в CRM | Скрипт стал автоматически брать реальные коды из `/api/v5/reference/order-types` |
| `orders/edit` — неверный endpoint | 404 при создании нового заказа | Переключились на `POST /api/v5/orders/create`; `edit` — только для существующих |
| Vercel блокировал вебхук | 401 Authentication Required | Отключил Vercel Authentication в Settings → Deployment Protection |
| Cron `*/20 * * * *` не работает | Ошибка при деплое (Hobby-план) | Изменил расписание на `0 0 * * *` (раз в сутки) |
| Output Directory не найден | Ошибка сборки «No Output Directory named public» | В Settings → General → Framework Preset выставил Next.js, Output Directory оставил пустым |
| `curl` не работает в PowerShell | Ошибка «Не удается найти параметр -X» | Использовал `Invoke-RestMethod` вместо curl |
| Кириллица в тесте → `????` | Имя клиента отображалось вопросиками | Проблема кодировки PowerShell; с реальными данными из CRM всё корректно |
| Telegram `getUpdates` пустой | `{"ok":true,"result":[]}` | Нужно было сначала добавить бота в группу, отключить Group Privacy в BotFather, написать сообщение |

### MCP-инструменты

- **`mcp-fetch`** — не смог обращаться к `*.retailcrm.ru` из-за `robots.txt`; работа через скрипты с локальной машины.
- **`mcp-postgres`** — хост Supabase недоступен из среды агента (`ENOTFOUND`); DDL выполнялся в SQL Editor.

---

## Проверка вебхука и Telegram

1. Укажи `TELEGRAM_CHANNEL_ID` и `API_KEY_BOT` в переменных окружения.
2. Добавь бота в Telegram-группу, отключи Group Privacy через BotFather.
3. Задай `RETAILCRM_WEBHOOK_SECRET` и URL вебхука с `?token=...`.
4. Тестовый вызов (PowerShell):

   ```powershell
   Invoke-RestMethod -Uri "https://<домен>/api/retailcrm-webhook?token=<SECRET>" -Method POST -ContentType "application/json" -Body '{"order":{"number":"TEST-001","totalSumm":75000,"firstName":"Тест","lastName":"Проверка","phone":"+77001234567"}}'
   ```

5. В Telegram-группу должно прийти уведомление о крупном заказе.
