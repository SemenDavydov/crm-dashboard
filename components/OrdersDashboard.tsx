"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

type Row = {
  order_number: string;
  sum: number | null;
  status: string | null;
  created_at: string | null;
  customer_name: string | null;
  phone: string | null;
};

function startOfDayLocal(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function localDayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function last7DayLabels() {
  const labels: string[] = [];
  const today = startOfDayLocal(new Date());
  for (let i = 6; i >= 0; i--) {
    const x = new Date(today);
    x.setDate(x.getDate() - i);
    labels.push(localDayKey(x));
  }
  return labels;
}

function aggregateByDay(rows: Row[], dayKeys: string[]) {
  const map = new Map<string, number>();
  for (const k of dayKeys) map.set(k, 0);
  const start = startOfDayLocal(new Date(dayKeys[0] + "T12:00:00")).getTime();
  const end =
    startOfDayLocal(
      new Date(dayKeys[dayKeys.length - 1] + "T12:00:00")
    ).getTime() +
    24 * 60 * 60 * 1000 -
    1;
  for (const r of rows) {
    if (!r.created_at) continue;
    const t = new Date(r.created_at).getTime();
    if (t < start || t > end) continue;
    const key = localDayKey(new Date(r.created_at));
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return dayKeys.map((k) => map.get(k) ?? 0);
}

export function OrdersDashboard() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setErr("Задай NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY");
      setLoading(false);
      return;
    }
    setSupabase(createClient(url, key));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("order_number,sum,status,created_at,customer_name,phone")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (cancelled) return;
      if (error) {
        setErr(error.message);
        setRows([]);
      } else {
        setErr(null);
        setRows((data ?? []) as Row[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const dayKeys = useMemo(() => last7DayLabels(), []);
  const counts = useMemo(
    () => aggregateByDay(rows, dayKeys),
    [rows, dayKeys]
  );

  const top5 = useMemo(() => {
    return [...rows]
      .filter((r) => r.sum != null)
      .sort((a, b) => (b.sum ?? 0) - (a.sum ?? 0))
      .slice(0, 5);
  }, [rows]);

  const chartData = {
    labels: dayKeys.map((k) => k.slice(5)),
    datasets: [
      {
        label: "Заказов за день",
        data: counts,
        backgroundColor: "rgba(99, 102, 241, 0.55)",
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: "Заказы за последние 7 дней",
        color: "#e8e8ed",
      },
    },
    scales: {
      x: {
        ticks: { color: "#8b8b9a" },
        grid: { color: "rgba(255,255,255,0.06)" },
      },
      y: {
        ticks: { color: "#8b8b9a", precision: 0 },
        grid: { color: "rgba(255,255,255,0.06)" },
      },
    },
  };

  return (
    <div className="space-y-10">
      {loading ? (
        <p className="text-[var(--muted)]">Загрузка…</p>
      ) : err ? (
        <p className="text-red-300" role="alert">
          {err}
        </p>
      ) : null}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
        <Bar data={chartData} options={chartOptions} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-[var(--text)]">
          Топ-5 по сумме
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                <th className="px-4 py-3 font-medium">№</th>
                <th className="px-4 py-3 font-medium">Сумма ₸</th>
                <th className="px-4 py-3 font-medium">Клиент</th>
                <th className="px-4 py-3 font-medium">Телефон</th>
              </tr>
            </thead>
            <tbody>
              {top5.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-[var(--muted)]" colSpan={4}>
                    Нет данных с суммой
                  </td>
                </tr>
              ) : (
                top5.map((o) => (
                  <tr
                    key={o.order_number}
                    className="border-b border-[var(--border)]/60 last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {o.order_number}
                    </td>
                    <td className="px-4 py-3">
                      {(o.sum ?? 0).toLocaleString("ru-RU")}
                    </td>
                    <td className="px-4 py-3">{o.customer_name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {o.phone ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
