/*
 * Able.cz dossier — unified investigation timeline.
 *
 * A chronological surface for the case's temporal record (§20). Distinct from
 * the graph's time-machine (which filters the graph by year): this lists every
 * dated event once, in order, each linked to its sources and — where the event
 * names an in-graph entity — to the graph (dossier:graph-focus-requested).
 *
 * Events come from two canonical places in #dossier-data, nothing invented:
 *   - d.timeline    : curated, sourced milestones (incorporation, acquisitions,
 *                     cap-table changes, enforcement) — all VERIFIED_PRIMARY here;
 *   - graph edges   : relationship start dates (firstObserved), folded in as
 *                     lighter "vztah zapsán" markers, deduped against milestones.
 * A year filter and an all/verified toggle refine the view. Deep-linkable via
 * ?tl=<year>. Injected after the "Lidé, entity a vztahy" graph section.
 *
 * Authored here; copied to static/js/timeline.js by `npm run js:build`.
 */
(function () {
  "use strict";
  var dataEl = document.getElementById("dossier-data");
  if (!dataEl) return;
  var D;
  try { D = JSON.parse(dataEl.textContent); } catch (e) { return; }
  var anchor = document.getElementById("fig-graph-title");
  if (!anchor) return;
  anchor = anchor.closest("section");
  if (!anchor) return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CHAMPAGNE = "#f3e5c0", GOLD = "#d4af37";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function yr(d) { var m = String(d || "").match(/\d{4}/); return m ? +m[0] : null; }

  // node label lookup, for turning an event's named entity into a graph focus
  var nodeById = {}; ((D.graph && D.graph.nodes) || []).forEach(function (n) { nodeById[n.data.id] = n.data; });
  function findEntity(text) {
    var t = (text || "").toLowerCase();
    var best = null;
    Object.keys(nodeById).forEach(function (id) {
      var lbl = (nodeById[id].label || "").toLowerCase().replace(/^[a-z]\.\s*/, ""); // "V. Faraga" → "faraga"
      var key = lbl.split(/\s+/).pop();
      if (key && key.length > 3 && t.indexOf(key) !== -1) { if (!best || key.length > best.key.length) best = { id: id, key: key }; }
    });
    return best ? best.id : null;
  }

  // ---- collect events ------------------------------------------------------
  var events = [];
  (D.timeline || []).forEach(function (t, i) {
    events.push({ date: t.date, y: yr(t.date), kind: "milestone", status: t.status, text: t.event, sources: t.sources || [], entity: findEntity(t.event), key: "m" + i });
  });
  // relationship start-dates, deduped against milestone dates
  var mDates = {}; events.forEach(function (e) { mDates[e.date] = true; });
  ((D.graph && D.graph.edges) || []).map(function (e) { return e.data; }).forEach(function (e) {
    if (!e.firstObserved || mDates[e.firstObserved]) return;
    var s = nodeById[e.source], t = nodeById[e.target];
    events.push({
      date: e.firstObserved, y: yr(e.firstObserved), kind: "rel", status: e.status,
      text: (s ? s.label : e.source) + " — " + e.label + " → " + (t ? t.label : e.target),
      sources: e.sources || [], entity: e.source, key: "e" + e.id,
    });
  });
  if (events.length < 3) return;
  events.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  var years = Object.keys(events.reduce(function (o, e) { if (e.y) o[e.y] = 1; return o; }, {})).map(Number).sort();

  // ---- build section -------------------------------------------------------
  var sec = document.createElement("section");
  sec.className = "mt-16 tl-section";
  sec.setAttribute("aria-labelledby", "tl-title");
  sec.innerHTML =
    '<h2 id="tl-title" class="font-sans text-2xl font-black text-white">Časová osa</h2>' +
    '<p class="mt-2 text-sm text-white/60">Chronologie doložených událostí — vznik, přejmenování, změny na cap table, akvizice, exekuce — a data zápisu klíčových vztahů. ' +
    'Každá událost odkazuje na svůj zdroj; kde jmenuje entitu, zaměří ji v grafu. Milníky jsou <span class="text-[#f3e5c0]">VERIFIED_PRIMARY</span>.</p>' +
    '<div class="tl-controls js-only" role="group" aria-label="Filtr časové osy">' +
      '<button class="tl-b is-on" data-tl-scope="all" aria-pressed="true">Vše</button>' +
      '<button class="tl-b" data-tl-scope="milestone" aria-pressed="false">Jen milníky</button>' +
      '<span class="tl-sep" aria-hidden="true"></span>' +
      '<label class="tl-yl">Rok <select class="tl-year" aria-label="Filtr podle roku"><option value="">vše</option>' +
        years.map(function (y) { return '<option value="' + y + '">' + y + "</option>"; }).join("") + "</select></label>" +
      '<span id="tl-count" class="tl-count" aria-live="polite"></span>' +
    "</div>" +
    '<ol class="tl-list" id="tl-list"></ol>';
  anchor.parentNode.insertBefore(sec, anchor.nextSibling);

  var listEl = sec.querySelector("#tl-list"), countEl = sec.querySelector("#tl-count");
  var scope = "all", yearFilter = null;

  function statusClass(s) { return s === "VERIFIED_PRIMARY" || s === "CORROBORATED" ? "tl-good" : s === "CONTRADICTED" ? "tl-warn" : "tl-muted"; }
  function render() {
    var shown = events.filter(function (e) {
      if (scope === "milestone" && e.kind !== "milestone") return false;
      if (yearFilter != null && e.y !== yearFilter) return false;
      return true;
    });
    listEl.innerHTML = shown.map(function (e) {
      var srcBtns = (e.sources || []).map(function (s) { return '<button class="tl-src" data-record="' + esc(s) + '">' + esc(s) + "</button>"; }).join(" ");
      var focus = e.entity && nodeById[e.entity] ? '<button class="tl-focus" data-tl-focus="' + esc(e.entity) + '">v grafu ›</button>' : "";
      return '<li class="tl-item ' + (e.kind === "rel" ? "tl-rel" : "tl-mile") + '">' +
        '<div class="tl-date"><time datetime="' + esc(e.date) + '">' + esc(e.date) + "</time>" +
          '<span class="tl-dot ' + statusClass(e.status) + '" aria-hidden="true"></span></div>' +
        '<div class="tl-body"><p class="tl-text">' + esc(e.text) + "</p>" +
          '<div class="tl-meta">' + (e.kind === "rel" ? '<span class="tl-tag">vztah zapsán</span> ' : "") + srcBtns + " " + focus + "</div></div></li>";
    }).join("");
    countEl.textContent = shown.length + " z " + events.length + " událostí";
  }

  sec.querySelector(".tl-controls").addEventListener("click", function (e) {
    var b = e.target.closest("[data-tl-scope]");
    if (b) {
      scope = b.getAttribute("data-tl-scope");
      sec.querySelectorAll("[data-tl-scope]").forEach(function (x) { var on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", String(on)); });
      render();
    }
    var f = e.target.closest("[data-tl-focus]");
    if (f) {
      var h = document.getElementById("fig-graph-title"); if (h) (h.closest("section") || h).scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      document.dispatchEvent(new CustomEvent("dossier:graph-focus-requested", { detail: { id: f.getAttribute("data-tl-focus") } }));
    }
  });
  sec.querySelector(".tl-year").addEventListener("change", function (e) {
    yearFilter = e.target.value ? +e.target.value : null;
    var u = new URL(window.location.href);
    if (yearFilter) u.searchParams.set("tl", yearFilter); else u.searchParams.delete("tl");
    history.replaceState({}, "", u);
    render();
  });

  injectStyle();
  // deep-link ?tl=2025 → preselect the year
  var initial = new URL(window.location.href).searchParams.get("tl");
  if (initial && years.indexOf(+initial) !== -1) { yearFilter = +initial; sec.querySelector(".tl-year").value = initial; }
  render();

  function injectStyle() {
    if (document.getElementById("tl-style")) return;
    var c =
      ".tl-controls{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin-top:1rem}" +
      ".tl-b{background:#171717;color:#9ca3af;border:1px solid rgba(255,255,255,.15);border-radius:.5rem;padding:.35rem .7rem;font-size:.76rem;cursor:pointer}" +
      ".tl-b:hover{border-color:" + GOLD + ";color:#fff}.tl-b.is-on{background:" + CHAMPAGNE + ";border-color:" + GOLD + ";color:#0a0a0a;font-weight:600}.tl-b:focus-visible{outline:2px solid " + GOLD + "}" +
      ".tl-sep{width:1px;height:20px;background:rgba(255,255,255,.15)}" +
      ".tl-yl{font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.4);display:flex;align-items:center;gap:.35rem}" +
      ".tl-year{background:#121212;color:#e5e7eb;border:1px solid rgba(255,255,255,.16);border-radius:.4rem;padding:.3rem .4rem;font-size:.8rem}" +
      ".tl-count{font-size:.72rem;color:rgba(255,255,255,.4);margin-left:auto}" +
      ".tl-list{list-style:none;margin:1.2rem 0 0;padding:0;position:relative}" +
      ".tl-list::before{content:'';position:absolute;left:88px;top:0;bottom:0;width:1px;background:rgba(255,255,255,.1)}" +
      "@media(max-width:640px){.tl-list::before{left:0}}" +
      ".tl-item{position:relative;display:grid;grid-template-columns:96px 1fr;gap:.8rem;padding:.55rem 0}" +
      "@media(max-width:640px){.tl-item{grid-template-columns:1fr;padding-left:1.1rem}}" +
      ".tl-date{position:relative;text-align:right;font-family:ui-monospace,monospace;font-size:.72rem;color:rgba(255,255,255,.55);padding-top:.05rem}" +
      "@media(max-width:640px){.tl-date{text-align:left}}" +
      ".tl-dot{position:absolute;right:-12px;top:.25rem;width:9px;height:9px;border-radius:50%;border:2px solid #0a0a0a}" +
      "@media(max-width:640px){.tl-dot{right:auto;left:-1.1rem}}" +
      ".tl-good{background:" + CHAMPAGNE + "}.tl-warn{background:" + GOLD + "}.tl-muted{background:#6b7280}" +
      ".tl-text{font-size:.85rem;line-height:1.45;color:#e5e7eb;margin:0}.tl-rel .tl-text{color:#cbd5e1;font-size:.8rem}" +
      ".tl-meta{margin-top:.3rem;display:flex;flex-wrap:wrap;align-items:center;gap:.35rem}" +
      ".tl-tag{font-size:.58rem;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.35);border:1px solid rgba(255,255,255,.12);border-radius:.25rem;padding:0 .25rem}" +
      ".tl-src{background:rgba(243,229,192,.08);border:1px solid rgba(243,229,192,.2);color:" + CHAMPAGNE + ";border-radius:.25rem;padding:0 .3rem;font-size:.66rem;font-family:ui-monospace,monospace;cursor:pointer}.tl-src:hover,.tl-src:focus-visible{background:rgba(243,229,192,.2);outline:none}.tl-src:focus-visible{outline:2px solid " + GOLD + "}" +
      ".tl-focus{background:none;border:0;color:#9ec5c0;font-size:.68rem;cursor:pointer;text-decoration:underline;text-underline-offset:2px}.tl-focus:hover,.tl-focus:focus-visible{color:" + CHAMPAGNE + ";outline:none}.tl-focus:focus-visible{outline:2px solid " + GOLD + ";outline-offset:1px}";
    var st = document.createElement("style"); st.id = "tl-style"; st.textContent = c; document.head.appendChild(st);
  }
})();
