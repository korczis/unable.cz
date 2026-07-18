/*
 * Able.cz dossier — financial period comparison (FY2024 vs FY2023).
 *
 * The filed figures already carry both periods ("36,319 / 42,642 tis. CZK" =
 * FY2024 / FY2023). This aligns them into an explicit FY2023 | FY2024 | Δ table
 * plus a year-over-year %-change chart. The Δ and % are arithmetic on the filed
 * values — not an invented score — and both periods are annual filings, so the
 * comparison is like-for-like. Nothing is fabricated; where a period is missing
 * the metric is omitted, not zero-filled.
 *
 * Injected after the financials section (no template edit). Each row is drillable
 * to its source via the existing financial inspector (data-fin="v<i>", whose
 * index matches inspector.js's financials.verified order).
 *
 * Authored here; copied to static/js/compare.js by `npm run js:build`.
 */
(function () {
  "use strict";
  var dataEl = document.getElementById("dossier-data");
  if (!dataEl) return;
  var D;
  try { D = JSON.parse(dataEl.textContent); } catch (e) { return; }
  var finSection = document.getElementById("fin-title");
  if (!finSection) return;
  finSection = finSection.closest("section");
  if (!finSection) return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CHAMPAGNE = "#f3e5c0", GOLD = "#d4af37", MUTED = "#6b7280";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(s) { var m = String(s).replace(/\s/g, "").replace(/,/g, ""); var n = parseFloat(m); return isFinite(n) ? n : null; }
  function fmt(n) { return n == null ? "—" : n.toLocaleString("cs-CZ"); }

  // Parse verified metrics that carry two annual periods: "<a> / <b> tis. CZK".
  var rows = [];
  (D.financials && D.financials.verified || []).forEach(function (m, i) {
    var mm = String(m.display).match(/^\s*([\d.,]+)\s*\/\s*([\d.,]+)\s*tis\.\s*CZK/i);
    if (!mm) return;
    var fy24 = num(mm[1]), fy23 = num(mm[2]);
    if (fy24 == null || fy23 == null) return;
    var label = m.metric.replace(/\s*\(FY2024\s*\/\s*FY2023\)\s*/i, "").replace(/\s*—.*$/, "").trim();
    var delta = fy24 - fy23;
    var pct = fy23 !== 0 ? (delta / Math.abs(fy23)) * 100 : null;
    rows.push({ key: "v" + i, label: label, metric: m.metric, fy23: fy23, fy24: fy24, delta: delta, pct: pct, sources: m.sources || [] });
  });
  if (rows.length < 2) return;

  // ---- build the section --------------------------------------------------
  var sec = document.createElement("section");
  sec.className = "mt-16 cmp-section";
  sec.setAttribute("aria-labelledby", "cmp-title");
  sec.innerHTML =
    '<h2 id="cmp-title" class="font-sans text-2xl font-black text-white">Srovnání účetních období</h2>' +
    '<p class="mt-2 text-sm text-white/60">Vykázané roční hodnoty FY2023 vs FY2024 (tis. CZK), zarovnané podle metriky. ' +
    'Δ a % jsou aritmetický rozdíl vykázaných hodnot — obě období jsou roční účetní závěrky, tedy srovnatelná. ' +
    'Není to skóre; klikni na hodnotu pro zdroj a přesné místo ve výkazu.</p>' +
    '<div class="js-only mx-auto mt-6 max-w-2xl rounded border border-white/10 bg-white/[0.02] p-4"><canvas id="cmp-chart" height="240" aria-hidden="true"></canvas></div>' +
    '<div class="mt-6 overflow-x-auto"><table class="w-full border-collapse text-left text-sm"><caption class="sr-only">Srovnání FY2023 a FY2024 podle metriky.</caption>' +
    '<thead><tr class="border-b border-white/20 text-white/60">' +
      '<th scope="col" class="py-2 pr-4 font-medium">Metrika</th>' +
      '<th scope="col" class="py-2 pr-4 text-right font-medium">FY2023</th>' +
      '<th scope="col" class="py-2 pr-4 text-right font-medium">FY2024</th>' +
      '<th scope="col" class="py-2 pr-4 text-right font-medium">Δ</th>' +
      '<th scope="col" class="py-2 text-right font-medium">Meziročně</th>' +
    '</tr></thead><tbody>' +
    rows.map(function (r) {
      var dir = r.delta > 0 ? "▲" : r.delta < 0 ? "▼" : "—";
      var pct = r.pct == null ? "—" : (r.pct > 0 ? "+" : "") + r.pct.toFixed(1) + " %";
      return '<tr class="border-b border-white/10">' +
        '<td class="py-2 pr-4 text-white/90">' + esc(r.label) + "</td>" +
        '<td class="py-2 pr-4 text-right tabular-nums text-white/70">' + fmt(r.fy23) + "</td>" +
        '<td class="py-2 pr-4 text-right tabular-nums cmp-val" data-fin="' + esc(r.key) + '" role="button" tabindex="0" aria-label="Zdroj a přesné místo: ' + esc(r.metric) + '">' + fmt(r.fy24) + "</td>" +
        '<td class="py-2 pr-4 text-right tabular-nums text-white/60">' + (r.delta > 0 ? "+" : "") + fmt(r.delta) + "</td>" +
        '<td class="py-2 text-right tabular-nums whitespace-nowrap ' + (r.delta === 0 ? "text-white/40" : "text-white/80") + '"><span aria-hidden="true">' + dir + "</span> " + pct + "</td>" +
      "</tr>";
    }).join("") +
    "</tbody></table></div>";
  finSection.parentNode.insertBefore(sec, finSection.nextSibling);

  // ---- YoY %-change chart (single comparable scale) -----------------------
  (function () {
    var canvas = document.getElementById("cmp-chart");
    if (!canvas || typeof window.Chart === "undefined") return;
    var withPct = rows.filter(function (r) { return r.pct != null; });
    new window.Chart(canvas, {
      type: "bar",
      data: {
        labels: withPct.map(function (r) { return r.label.length > 22 ? r.label.slice(0, 21) + "…" : r.label; }),
        datasets: [{
          label: "Meziroční změna (%)",
          data: withPct.map(function (r) { return +r.pct.toFixed(1); }),
          backgroundColor: withPct.map(function (r) { return r.pct >= 0 ? CHAMPAGNE : MUTED; }),
          borderColor: "#000", borderWidth: 1,
        }],
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: true,
        animation: reduceMotion ? false : { duration: 400 },
        scales: {
          x: { ticks: { color: "#9ca3af", callback: function (v) { return v + " %"; } }, grid: { color: "rgba(255,255,255,0.06)" } },
          y: { ticks: { color: "#cbd5e1", font: { size: 11 } }, grid: { display: false } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { var r = withPct[ctx.dataIndex]; return fmt(r.fy23) + " → " + fmt(r.fy24) + " tis. (" + (r.pct > 0 ? "+" : "") + r.pct.toFixed(1) + " %)"; } } },
        },
      },
    });
  })();

  // ---- styles --------------------------------------------------------------
  var st = document.createElement("style");
  st.textContent = ".cmp-val{cursor:pointer;border-bottom:1px dotted rgba(243,229,192,.4)}.cmp-val:hover,.cmp-val:focus-visible{color:" + CHAMPAGNE + ";outline:none;border-bottom-color:" + CHAMPAGNE + "}.cmp-val:focus-visible{outline:2px solid " + GOLD + ";outline-offset:2px}";
  document.head.appendChild(st);
})();
