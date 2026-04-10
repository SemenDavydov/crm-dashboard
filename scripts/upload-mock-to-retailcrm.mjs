/**
 * Шаг 1: читает mock_orders.json и создаёт/обновляет заказы в RetailCRM (API v5).
 * Формат POST: application/x-www-form-urlencoded, поле order — JSON-строка (требование RetailCRM).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function baseUrl() {
  return (process.env.RETAILCRM_URL ?? "").replace(/\/$/, "");
}

function apiKey() {
  return process.env.RETAILCRM_API_KEY ?? "";
}

async function fetchSites() {
  const paths = ["/api/v5/reference/sites", "/api/v5/sites"];
  let lastErr = "unknown";
  for (const p of paths) {
    const u = new URL(p, baseUrl());
    u.searchParams.set("apiKey", apiKey());
    const res = await fetch(u.toString(), {
      headers: { Accept: "application/json" },
    });
    const j = await res.json().catch(() => ({}));
    if (!j.success) {
      lastErr = j.errorMsg ?? `HTTP ${res.status}`;
      continue;
    }
    const sites = j.sites ?? [];
    if (!sites.length) {
      lastErr = "sites[] пустой";
      continue;
    }
    const code = sites[0].code ?? sites[0].name;
    if (!code) {
      lastErr = "нет code у первого site";
      continue;
    }
    return String(code);
  }
  const envSite = process.env.RETAILCRM_SITE;
  if (envSite) return envSite;
  throw new Error(
    `Не удалось получить site: ${lastErr}. Задай RETAILCRM_SITE в .env.local вручную.`
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildOrder(mock, index) {
  const externalId = `mock-${String(index + 1).padStart(4, "0")}`;
  const items = (mock.items ?? []).map((it, j) => ({
    quantity: it.quantity,
    initialPrice: it.initialPrice,
    productName: it.productName,
    offer: {
      name: it.productName,
      displayName: it.productName,
      xmlId: `${externalId}-line-${j}`,
    },
  }));

  const order = {
    externalId,
    firstName: mock.firstName,
    lastName: mock.lastName,
    phone: mock.phone,
    email: mock.email,
    orderType: mock.orderType,
    orderMethod: mock.orderMethod,
    status: mock.status,
    items,
    currency: "KZT",
  };

  if (mock.delivery?.address) {
    order.delivery = {
      address: {
        city: mock.delivery.address.city,
        text: mock.delivery.address.text,
      },
    };
  }
  if (mock.customFields && Object.keys(mock.customFields).length) {
    order.customFields = mock.customFields;
  }
  return order;
}

async function postOrderEdit(site, order) {
  const body = new URLSearchParams();
  body.set("apiKey", apiKey());
  if (site) body.set("site", site);
  body.set("order", JSON.stringify(order));

  const url = new URL("/api/v5/orders/edit", baseUrl());
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  const j = await res.json().catch(() => ({}));
  return { res, j };
}

async function main() {
  if (!baseUrl() || !apiKey()) {
    console.error("Нужны RETAILCRM_URL и RETAILCRM_API_KEY в .env.local");
    process.exit(1);
  }

  const mockPath = path.join(root, "mock_orders.json");
  const mocks = JSON.parse(fs.readFileSync(mockPath, "utf8"));
  if (!Array.isArray(mocks)) throw new Error("mock_orders.json должен быть массивом");

  let site;
  try {
    site = await fetchSites();
  } catch (e) {
    console.warn(String(e.message ?? e));
    site = process.env.RETAILCRM_SITE ?? "";
  }
  console.log(site ? `Site: ${site}` : "Site: (не указан — один магазин или задай RETAILCRM_SITE)");
  console.log(`Заказов в файле: ${mocks.length}`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < mocks.length; i++) {
    const order = buildOrder(mocks[i], i);
    const { res, j } = await postOrderEdit(site, order);
    if (res.ok && j.success) {
      ok++;
      const id = j.id ?? j.order?.id ?? "?";
      console.log(`[OK] ${order.externalId} → CRM id ${id}`);
    } else {
      fail++;
      console.error(
        `[FAIL] ${order.externalId} HTTP ${res.status}`,
        j.errorMsg ?? j.errors ?? j
      );
    }
    await sleep(130);
  }

  console.log(`--- Готово: успех ${ok}, ошибок ${fail}`);
  process.exit(fail > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
