/**
 * Шаг 2: RetailCRM → Supabase, идемпотентный upsert по order_number.
 * Требует таблицу public.orders из supabase/sql/001_orders_tz.sql
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

function baseUrl() {
  return (process.env.RETAILCRM_URL ?? "").replace(/\/$/, "");
}

function apiKey() {
  return process.env.RETAILCRM_API_KEY ?? "";
}

function parseDate(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function fetchOrdersPage(page, limit) {
  const u = new URL("/api/v5/orders", baseUrl());
  u.searchParams.set("apiKey", apiKey());
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("page", String(page));

  const res = await fetch(u.toString(), {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const j = await res.json();
  if (!res.ok || !j.success) {
    throw new Error(j.errorMsg ?? `HTTP ${res.status}`);
  }
  return j;
}

async function fetchAllOrders(limit = 100) {
  const all = [];
  let page = 1;
  while (page <= 500) {
    const j = await fetchOrdersPage(page, limit);
    const orders = j.orders ?? [];
    all.push(...orders);
    const totalPages = j.pagination?.totalPageCount;
    if (totalPages != null && page >= totalPages) break;
    if (orders.length === 0) break;
    if (orders.length < limit) break;
    page += 1;
  }
  return all;
}

function mapRow(o) {
  const num = o.number != null ? String(o.number) : String(o.id);
  const totalRaw = o.totalSumm ?? o.summ;
  const sum =
    totalRaw != null && totalRaw !== "" ? Number(totalRaw) : null;
  const first = String(o.firstName ?? "").trim();
  const last = String(o.lastName ?? "").trim();
  const name = [first, last].filter(Boolean).join(" ") || null;
  return {
    order_number: num,
    sum: sum != null && Number.isFinite(sum) ? sum : null,
    status: o.status != null ? String(o.status) : null,
    created_at: parseDate(o.createdAt),
    customer_name: name,
    phone: o.phone != null ? String(o.phone) : null,
  };
}

async function main() {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbKey) {
    console.error("Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!baseUrl() || !apiKey()) {
    console.error("Нужны RETAILCRM_URL и RETAILCRM_API_KEY");
    process.exit(1);
  }

  const supabase = createClient(sbUrl, sbKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const raw = await fetchAllOrders(100);
  const rows = raw.map(mapRow).filter((r) => r.order_number);

  const chunk = 100;
  let n = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await supabase.from("orders").upsert(slice, {
      onConflict: "order_number",
    });
    if (error) {
      console.error("Supabase upsert error:", error.message);
      process.exit(1);
    }
    n += slice.length;
    console.log(`Upsert ${n}/${rows.length}`);
  }

  console.log(`--- Синк завершён: строк ${rows.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
