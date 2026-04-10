-- Таблица заказов под ТЗ (дашборд + anon read).
-- ВНИМАНИЕ: если у тебя уже была другая public.orders — сделай бэкап или переименуй старую:
--   ALTER TABLE public.orders RENAME TO orders_legacy;

DROP TABLE IF EXISTS public.orders CASCADE;

CREATE TABLE public.orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  sum NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ,
  customer_name TEXT,
  phone TEXT
);

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_sum_idx ON public.orders (sum DESC NULLS LAST);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_anon"
  ON public.orders
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "orders_select_authenticated"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.orders TO anon, authenticated;
