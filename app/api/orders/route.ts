import { NextResponse } from "next/server";
import { fetchOrdersForDashboard } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orders = await fetchOrdersForDashboard(300);
    return NextResponse.json({ orders });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
