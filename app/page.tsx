import { OrdersDashboard } from "@/components/OrdersDashboard";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Дашборд заказов
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Данные из Supabase (anon + RLS). Синк:{" "}
          <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-xs">
            npm run sync:crm-to-supabase
          </code>{" "}
          или{" "}
          <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-xs">
            GET /api/sync
          </code>
          .
        </p>
      </header>
      <OrdersDashboard />
    </main>
  );
}
