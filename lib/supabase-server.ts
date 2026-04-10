import { createClient } from "@supabase/supabase-js";
import type { OrderRow } from "./types";

export function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY обязательны");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function upsertOrders(rows: Partial<OrderRow>[]) {
  if (rows.length === 0) return { error: null as Error | null };
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("orders").upsert(rows, {
    onConflict: "order_number",
    ignoreDuplicates: false,
  });
  return { error: error as Error | null };
}

export async function fetchOrdersForDashboard(limit = 500) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select("id,order_number,sum,status,created_at,customer_name,phone")
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return data as OrderRow[];
}
