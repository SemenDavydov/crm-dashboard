import { NextRequest, NextResponse } from "next/server";
import { mapRetailCrmOrder, fetchAllOrders } from "@/lib/retailcrm";
import { upsertOrders } from "@/lib/supabase-server";
import { assertSyncAuthorized } from "@/lib/sync-auth";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CHUNK = 80;

export async function GET(request: NextRequest) {
  if (process.env.VERCEL === "1" && !process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "На Vercel задай CRON_SECRET и вызывай с Bearer" },
      { status: 503 }
    );
  }

  const auth = assertSyncAuthorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const raw = await fetchAllOrders(100);
    const rows = [];
    for (const o of raw) {
      try {
        rows.push(mapRetailCrmOrder(o));
      } catch (e) {
        console.warn("skip order", e);
      }
    }

    let upserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error } = await upsertOrders(slice);
      if (error) {
        return NextResponse.json(
          { error: String(error.message ?? error) },
          { status: 500 }
        );
      }
      upserted += slice.length;
    }

    return NextResponse.json({
      ok: true,
      fetched: raw.length,
      upserted,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
