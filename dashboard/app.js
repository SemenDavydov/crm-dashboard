/* global Chart, supabase */
(function () {
  const cfg = window.__GBC_CONFIG__;
  if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey) {
    document.getElementById("status").textContent =
      "Создай config.js из config.example.js";
    return;
  }

  const client = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  function localDayKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function last7Keys() {
    const out = [];
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const x = new Date(t);
      x.setDate(x.getDate() - i);
      out.push(localDayKey(x));
    }
    return out;
  }

  async function load() {
    document.getElementById("status").textContent = "Загрузка…";
    const { data, error } = await client
      .from("orders")
      .select("order_number,sum,status,created_at,customer_name,phone")
      .order("created_at", { ascending: false })
      .limit(2000);

    if (error) {
      document.getElementById("status").textContent = error.message;
      return;
    }
    document.getElementById("status").textContent = "";

    const rows = data ?? [];
    const keys = last7Keys();
    const map = new Map(keys.map((k) => [k, 0]));
    const start = new Date(keys[0] + "T12:00:00").getTime();
    const end =
      new Date(keys[keys.length - 1] + "T12:00:00").getTime() +
      86400000 -
      1;
    for (const r of rows) {
      if (!r.created_at) continue;
      const ts = new Date(r.created_at).getTime();
      if (ts < start || ts > end) continue;
      const k = localDayKey(new Date(r.created_at));
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
    }

    const chart = Chart.getChart("ordersChart");
    if (chart) chart.destroy();
    // eslint-disable-next-line no-new
    new Chart(document.getElementById("ordersChart"), {
      type: "bar",
      data: {
        labels: keys.map((k) => k.slice(5)),
        datasets: [
          {
            label: "Заказов",
            data: keys.map((k) => map.get(k) ?? 0),
            backgroundColor: "rgba(99, 102, 241, 0.55)",
            borderRadius: 6,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#8b8b9a" }, grid: { color: "#2a2a34" } },
          y: {
            ticks: { color: "#8b8b9a", precision: 0 },
            grid: { color: "#2a2a34" },
          },
        },
      },
    });

    const top = [...rows]
      .filter((r) => r.sum != null)
      .sort((a, b) => (b.sum ?? 0) - (a.sum ?? 0))
      .slice(0, 5);

    const tbody = document.querySelector("#top tbody");
    tbody.innerHTML = "";
    if (!top.length) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td colspan="4" class="muted">Нет данных с суммой</td>';
      tbody.appendChild(tr);
      return;
    }
    for (const o of top) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="mono">${o.order_number}</td>
        <td>${(o.sum ?? 0).toLocaleString("ru-RU")}</td>
        <td>${o.customer_name ?? "—"}</td>
        <td class="mono">${o.phone ?? "—"}</td>`;
      tbody.appendChild(tr);
    }
  }

  load().catch((e) => {
    document.getElementById("status").textContent = String(e);
  });
})();
