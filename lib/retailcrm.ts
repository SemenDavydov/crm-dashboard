import type { RetailCrmOrder, RetailCrmOrdersResponse } from "./types";

function baseUrl() {
  const raw = process.env.RETAILCRM_URL?.replace(/\/$/, "") ?? "";
  if (!raw) throw new Error("RETAILCRM_URL не задан");
  return raw;
}

function apiKey() {
  const k = process.env.RETAILCRM_API_KEY;
  if (!k) throw new Error("RETAILCRM_API_KEY не задан");
  return k;
}

export function parseRcrmDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const d = new Date(value * 1000);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const s = String(value).trim();
  if (!s) return null;
  const normalized = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(normalized);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  const d2 = new Date(s);
  return Number.isNaN(d2.getTime()) ? null : d2.toISOString();
}

export function mapRetailCrmOrder(o: RetailCrmOrder) {
  const orderNumber =
    o.number != null ? String(o.number) : o.id != null ? String(o.id) : "";
  if (!orderNumber) {
    throw new Error("order без number/id");
  }
  const totalRaw = o.totalSumm ?? o.summ;
  const sum =
    totalRaw != null && totalRaw !== "" ? Number(totalRaw) : null;
  const first = String(o.firstName ?? "").trim();
  const last = String(o.lastName ?? "").trim();
  const name = [first, last].filter(Boolean).join(" ") || null;
  return {
    order_number: orderNumber,
    sum: sum != null && Number.isFinite(sum) ? sum : null,
    status: o.status != null ? String(o.status) : null,
    created_at: parseRcrmDate(o.createdAt),
    customer_name: name,
    phone: o.phone != null ? String(o.phone) : null,
  };
}

export async function fetchOrdersPage(page: number, limit = 100) {
  const url = new URL(`${baseUrl()}/api/v5/orders`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));
  url.searchParams.set("apiKey", apiKey());

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      "X-API-KEY": apiKey(),
      Accept: "application/json",
    },
  });

  const json = (await res.json()) as RetailCrmOrdersResponse;
  if (!res.ok) {
    throw new Error(
      `RetailCRM HTTP ${res.status}: ${json?.errorMsg ?? res.statusText}`
    );
  }
  if (!json.success) {
    throw new Error(json.errorMsg ?? "RetailCRM success=false");
  }
  return json;
}

export async function fetchAllOrders(limitPerPage = 100) {
  const all: RetailCrmOrder[] = [];
  let page = 1;
  while (page <= 500) {
    const batch = await fetchOrdersPage(page, limitPerPage);
    const orders = batch.orders ?? [];
    all.push(...orders);
    const totalPages = batch.pagination?.totalPageCount;
    if (totalPages != null && page >= totalPages) break;
    if (orders.length === 0) break;
    if (orders.length < limitPerPage) break;
    page += 1;
  }
  return all;
}
