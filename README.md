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

   Либо заголовок `X-Webhook-Token`. При `totalSumm` / `summ` **> 50 000 ₸** уходит сообщение в Telegram (`API_KEY_BOT` + `TELEGRAM_CHANNEL_ID`).

## Скрипты

| Команда | Назначение |
|--------|------------|
| `npm run upload:mock-to-crm` | `mock_orders.json` → RetailCRM (`/api/v5/orders/edit`) |
| `npm run sync:crm-to-supabase` | Все заказы из CRM → `public.orders` |
| `GET /api/sync` | То же на Vercel (нужен `CRON_SECRET` + Bearer на проде) |

## Ограничения и типовые ошибки

- **MCP `mcp-fetch`** к хосту `*.retailcrm.ru` может быть недоступен из‑за `robots.txt`; скрипты и `curl` с твоей машины обычно работают.
- **MCP Postgres** в среде агента был без валидного хоста (`ENOTFOUND`); DDL выполняется в Supabase SQL Editor, не через MCP.
- **403 Forbidden** к API: неверный ключ, ограничение по IP в RetailCRM или лимит нагрузки.
- **Типы заказа / способ** в CRM должны существовать (`orderType`, `orderMethod` из `mock_orders.json`); иначе RetailCRM вернёт ошибку валидации.
- Секреты не коммить: `.env.local`, токен бота, `service_role`.

## Эволюция требований (сводка промптов)

1. Мини-дашборд + инструкции по RetailCRM / Supabase / Vercel.  
2. Реализация Next.js + синк + Telegram (черновой).  
3. Текущий запрос: пошаговый pipeline (mock → CRM → Supabase с новой схемой `orders`), отдельная папка `dashboard/`, вебхук >50 000 ₸, документация и деплой.

Ошибки на пути и исправления: неверное предположение про JSON body для RetailCRM POST → перевод на `x-www-form-urlencoded` + `order` как JSON-строка; конфликт старой таблицы `orders` → явный SQL с `DROP`/предупреждением; уведомления в Telegram перенесены с «каждый синк» на **вебхук по порогу суммы**.

## Деплой

- Корень репозитория — Next.js для Vercel. Укажи все переменные из `.env.example`.  
- Отдельный статический хостинг для `dashboard/` возможен командой `vercel` из каталога `dashboard` (только после подстановки ключей в `config.js`).

## Лицензия

Внутренний проект; при публикации добавь лицензию по договорённости.
