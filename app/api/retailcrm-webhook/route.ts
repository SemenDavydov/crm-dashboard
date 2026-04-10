import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const THRESHOLD = 50_000;

function parseOrderPayload(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const raw = b.order ?? b.data;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  return b;
}

function orderTotal(order: Record<string, unknown>) {
  const t = order.totalSumm ?? order.summ;
  if (t == null || t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.RETAILCRM_WEBHOOK_SECRET;
  if (secret) {
    const q = request.nextUrl.searchParams.get("token");
    const h = request.headers.get("x-webhook-token");
    if (q !== secret && h !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const ctype = request.headers.get("content-type") ?? "";
  let parsed: unknown;
  try {
    if (ctype.includes("application/json")) {
      parsed = await request.json();
    } else if (
      ctype.includes("application/x-www-form-urlencoded") ||
      ctype.includes("multipart/form-data")
    ) {
      const form = await request.formData();
      const obj: Record<string, string> = {};
      for (const [k, v] of form.entries()) {
        if (typeof v === "string") obj[k] = v;
      }
      parsed = obj;
    } else {
      const text = await request.text();
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }
    }
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }

  const order = parseOrderPayload(parsed);
  if (!order) {
    return NextResponse.json({ ok: true, note: "no order in payload" });
  }

  const total = orderTotal(order);
  const num = order.number != null ? String(order.number) : String(order.id ?? "");
  if (total != null && total > THRESHOLD) {
    const name = [order.firstName, order.lastName].filter(Boolean).join(" ");
    const text = [
      `Новый крупный заказ (> ${THRESHOLD.toLocaleString("ru-RU")} ₸)`,
      num && `№ ${num}`,
      total != null && `Сумма: ${total.toLocaleString("ru-RU")} ₸`,
      name && `Клиент: ${name}`,
      order.phone && `Тел: ${order.phone}`,
    ]
      .filter(Boolean)
      .join("\n");

    const tg = await sendTelegramMessage(text);
    return NextResponse.json({ ok: true, notified: tg.sent, total });
  }

  return NextResponse.json({ ok: true, skipped: true, total });
}
