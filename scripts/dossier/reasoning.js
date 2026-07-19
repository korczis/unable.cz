/*
 * Able.cz dossier — interactive reasoning DAG (PROMPT-10).
 *
 * Renders static/data/dossier/reasoning/graph.json as a layered graph
 * (observation → evidence → assertion → claim → assessment/inference →
 * conclusion → executive finding). Progressive enhancement only: the page
 * already lists every chain textually; this view adds visual navigation.
 * Clicking a node shows its "why" record (supports / contradicts / produced
 * by / used by) from why.json — never color-only: the panel is text.
 *
 * Authored here; copied to static/js/reasoning.js by `npm run js:build`.
 */
(function () {
  "use strict";
  var host = document.getElementById("reasoning-graph");
  if (!host || !window.cytoscape) return;
  var CHAMPAGNE = "#f3e5c0", GOLD = "#d4af37";
  var KIND_COLOR = {
    source: "#7d8590", observation: "#5b6470", evidence: "#9ec5c0", assertion: "#8fb0d0",
    claim: "#c9c9c9", assessment: CHAMPAGNE, inference: "#d9c9a0", conclusion: GOLD,
    conflict: "#d47b37", assumption: "#a68bc9", executive_finding: "#ffffff",
  };
  var KIND_LABEL = {
    source: "zdroj", observation: "pozorování", evidence: "evidence", assertion: "asercie",
    claim: "tvrzení", assessment: "assessment", inference: "úsudek", conclusion: "závěr",
    conflict: "rozpor", assumption: "předpoklad", executive_finding: "exekutivní zjištění",
  };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  Promise.all([
    fetch(host.getAttribute("data-graph")).then(function (r) { return r.json(); }),
    fetch("/data/dossier/reasoning/why.json").then(function (r) { return r.json(); }),
  ]).then(function (res) {
    var graph = res[0], why = res[1].why;

    host.innerHTML =
      '<div class="rg-legend" role="note">' +
      Object.keys(KIND_LABEL).map(function (k) {
        return '<span class="rg-leg"><i style="background:' + KIND_COLOR[k] + '"></i>' + KIND_LABEL[k] + "</span>";
      }).join("") +
      "</div>" +
      '<div class="rg-canvas" role="application" aria-label="Úsudkový graf — interaktivní; textová alternativa je v řetězcích výše"></div>' +
      '<div class="rg-panel" aria-live="polite"><p class="rg-hint">Klikněte na uzel — panel ukáže, co ho podpírá, co mu odporuje a kdo ho používá.</p></div>';

    var byLayer = {};
    graph.nodes.forEach(function (n) { (byLayer[n.layer] = byLayer[n.layer] || []).push(n); });
    var elements = [];
    graph.nodes.forEach(function (n) {
      var row = byLayer[n.layer];
      var i = row.indexOf(n);
      elements.push({ data: { id: n.id, label: n.id, kind: n.kind, full: n.label }, position: { x: (i - row.length / 2) * 95, y: (6 - n.layer) * 150 } });
    });
    graph.edges.forEach(function (e, i) {
      elements.push({ data: { id: "re" + i, source: e.from, target: e.to, role: e.role } });
    });

    var cy = window.cytoscape({
      container: host.querySelector(".rg-canvas"),
      elements: elements,
      layout: { name: "preset" },
      wheelSensitivity: 0.2, maxZoom: 2, minZoom: 0.08,
      autoungrabify: true, boxSelectionEnabled: false,
      style: [
        { selector: "node", style: {
          "background-color": function (n) { return KIND_COLOR[n.data("kind")] || "#888"; },
          width: function (n) { return n.data("kind") === "executive_finding" ? 26 : 14; },
          height: function (n) { return n.data("kind") === "executive_finding" ? 26 : 14; },
          label: "data(label)", "font-size": 7, color: "#cbd5e1",
          "text-valign": "bottom", "text-margin-y": 3,
          "text-outline-width": 2, "text-outline-color": "#0a0a0a",
          "min-zoomed-font-size": 6,
        }},
        { selector: "edge", style: {
          width: 1, "curve-style": "straight", "target-arrow-shape": "triangle", "arrow-scale": 0.5,
          "line-color": function (e) { return e.data("role") === "contradicts" || e.data("role").indexOf("conflict") === 0 ? GOLD : "rgba(255,255,255,0.14)"; },
          "target-arrow-color": "rgba(255,255,255,0.25)",
        }},
        { selector: ".rg-dim", style: { opacity: 0.12 } },
        { selector: ".rg-hi", style: { opacity: 1, "border-width": 3, "border-color": CHAMPAGNE } },
        { selector: "edge.rg-hi", style: { opacity: 1, width: 2.5, "line-color": CHAMPAGNE } },
      ],
    });
    cy.fit(undefined, 30);

    var panel = host.querySelector(".rg-panel");
    function refLink(ref) {
      if (/^CLM-/.test(ref)) return '<a href="/dossier/claims/' + ref.toLowerCase() + '/">' + esc(ref) + "</a>";
      if (/^(INF|EXEC)-/.test(ref)) return '<a href="/dossier/reasoning/' + ref.toLowerCase() + '/">' + esc(ref) + "</a>";
      return "<span>" + esc(ref) + "</span>";
    }
    cy.on("tap", "node", function (evt) {
      var n = evt.target, id = n.id(), w = why[id] || {};
      cy.elements().addClass("rg-dim").removeClass("rg-hi");
      n.removeClass("rg-dim").addClass("rg-hi");
      n.neighborhood().removeClass("rg-dim").addClass("rg-hi");
      var rows = [];
      rows.push("<h3><span class='rg-k'>" + esc(KIND_LABEL[n.data("kind")] || n.data("kind")) + "</span> " + refLink(id) + "</h3>");
      rows.push("<p class='rg-full'>" + esc(n.data("full")) + "</p>");
      var sup = (w.supporting || []).map(function (s) { return refLink(s.ref); }).join(", ");
      var con = (w.contradicting || []).map(function (s) { return refLink(s.ref); }).join(", ");
      var use = (w.used_by || []).map(function (s) { return refLink(s.ref); }).join(", ");
      if (sup) rows.push("<p><b>Podpírá mě:</b> " + sup + "</p>");
      if (con) rows.push("<p><b>Odporuje mi / rozpor:</b> " + con + "</p>");
      if (w.produced_by_inference) rows.push("<p><b>Vytvořil mě úsudek:</b> " + refLink(w.produced_by_inference) + "</p>");
      if (use) rows.push("<p><b>Používají mě:</b> " + use + "</p>");
      if ((w.assumptions || []).length) rows.push("<p><b>Předpoklady:</b> " + w.assumptions.map(esc).join(", ") + "</p>");
      if ((w.uncertainty || []).length) rows.push("<p><b>Nejistota:</b> " + w.uncertainty.map(esc).join(" · ") + "</p>");
      if (w.reasoning_route) rows.push("<p><a href='" + w.reasoning_route + "'>Otevřít celý úsudkový řetězec ›</a></p>");
      panel.innerHTML = rows.join("");
    });

    injectStyle();
  }).catch(function () { host.innerHTML = '<p class="text-sm" style="color:rgba(255,255,255,.5)">Interaktivní graf se nepodařilo načíst — textové řetězce výše jsou úplné.</p>'; });

  function injectStyle() {
    if (document.getElementById("rg-style")) return;
    var css =
      ".rg-legend{display:flex;flex-wrap:wrap;gap:.4rem .8rem;font-size:.66rem;color:rgba(255,255,255,.6);margin-bottom:.5rem}" +
      ".rg-leg{display:inline-flex;align-items:center;gap:.3rem}.rg-leg i{width:9px;height:9px;border-radius:50%;display:inline-block}" +
      ".rg-canvas{height:480px;border:1px solid rgba(255,255,255,.12);border-radius:.5rem;background:#0a0a0a}" +
      "@media(min-width:1024px){.rg-canvas{height:620px}}" +
      ".rg-panel{margin-top:.6rem;border:1px solid rgba(255,255,255,.1);border-radius:.5rem;background:rgba(255,255,255,.04);padding:.7rem .9rem;font-size:.82rem;color:#cbd5e1;min-height:52px}" +
      ".rg-panel h3{margin:0 0 .3rem;font-size:.85rem;color:#fff}.rg-panel .rg-k{font-size:.62rem;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.45);margin-right:.4rem}" +
      ".rg-panel p{margin:.25rem 0}.rg-panel a{color:#f3e5c0;text-decoration:underline;text-underline-offset:2px}" +
      ".rg-full{color:rgba(255,255,255,.75)}.rg-hint{color:rgba(255,255,255,.4)}";
    var st = document.createElement("style"); st.id = "rg-style"; st.textContent = css; document.head.appendChild(st);
  }
})();
