/*
 * Able.cz dossier — context inspector + global search.
 *
 * Companion to cockpit.js. Turns records from "highlighted text" into
 * first-class objects: selecting a claim / source / contradiction / entity opens
 * a side panel (desktop) or bottom sheet (mobile) with the record's real
 * details, TYPED backlinks ("referenced by CLM-16 as ownership"), and actions
 * (show in graph, copy link, close). Also adds a global search over every record
 * and section. Everything is read from the embedded #dossier-data — nothing is
 * invented, and it degrades to nothing with JS off.
 *
 * It reuses cockpit.js's seam: ID records rendered here carry data-record, so a
 * click flows through cockpit's selection (highlight + ?claim=/?source= URL +
 * dossier:<type>-selected event), which this module listens for to (re)render.
 * Entities use data-entity + ?entity= handled here.
 *
 * Authored here; copied to static/js/inspector.js by `npm run js:build`.
 */
(function () {
  "use strict";
  var dataEl = document.getElementById("dossier-data");
  if (!dataEl) return;
  var D;
  try { D = JSON.parse(dataEl.textContent); } catch (e) { return; }

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CHAMPAGNE = "#f3e5c0", GOLD = "#d4af37";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function el(h) { var t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstChild; }

  // ---- indices -------------------------------------------------------------
  var claimById = {}; (D.claims || []).forEach(function (c) { claimById[c.id] = c; });
  var srcById = {}; (D.sources || []).forEach(function (s) { srcById[s.id] = s; });
  var conById = {}; (D.contradictions || []).forEach(function (c) { conById[c.id] = c; });
  var nodeById = {}; ((D.graph && D.graph.nodes) || []).forEach(function (n) { nodeById[n.data.id] = n.data; });
  var edges = ((D.graph && D.graph.edges) || []).map(function (e) { return e.data; });

  function statusTone(s) {
    if (s === "VERIFIED_PRIMARY" || s === "CORROBORATED") return "good";
    if (s === "CONTRADICTED") return "warn";
    if (s === "RESOLVED") return "good";
    return "muted";
  }
  function badge(s) { return '<span class="ix-badge ix-' + statusTone(s) + '">' + esc(s) + "</span>"; }
  function recLink(id, label) { return '<button class="ix-rl" data-record="' + esc(id) + '">' + esc(label || id) + "</button>"; }
  function entLink(id) { var n = nodeById[id]; return '<button class="ix-rl" data-entity="' + esc(id) + '">' + esc(n ? n.label : id) + "</button>"; }
  function srcLine(id) {
    var s = srcById[id];
    if (!s) return recLink(id);
    return '<button class="ix-rl" data-record="' + esc(id) + '">' + esc(id) + "</button> " +
      '<a class="ix-ext" href="' + esc(s.url) + '" target="_blank" rel="nofollow noopener">' + esc((s.title || "").slice(0, 60)) + "</a>";
  }
  function sec(title, body) { return body ? '<div class="ix-sec"><h4>' + esc(title) + "</h4>" + body + "</div>" : ""; }

  // ---- backlink computation (typed) ---------------------------------------
  function claimBacklinks(id) {
    var out = [];
    (D.graph && D.graph.nodes || []).forEach(function (n) {
      if ((n.data.claims || []).indexOf(id) !== -1) out.push({ t: "entity", id: n.data.id, why: "týká se entity" });
    });
    return out;
  }
  function sourceUsage(id) {
    return {
      claims: (D.claims || []).filter(function (c) { return (c.sources || []).indexOf(id) !== -1; }).map(function (c) { return c.id; }),
      edges: edges.filter(function (e) { return (e.sources || []).indexOf(id) !== -1; }),
      identity: (D.identity || []).filter(function (f) { return (f.sources || []).indexOf(id) !== -1; }).map(function (f) { return f.field; }),
    };
  }
  function entityEdges(id) {
    return edges.filter(function (e) { return e.source === id || e.target === id; });
  }

  // ---- panel ---------------------------------------------------------------
  var panel = el(
    '<aside class="ix-panel" role="complementary" aria-label="Detail záznamu" aria-hidden="true" tabindex="-1">' +
      '<div class="ix-head"><span class="ix-grab" aria-hidden="true"></span>' +
        '<div class="ix-kind" id="ix-kind"></div>' +
        '<button class="ix-close" type="button" aria-label="Zavřít panel">Zavřít ✕</button></div>' +
      '<div class="ix-body" id="ix-body"></div>' +
    "</aside>"
  );
  document.body.appendChild(panel);
  var body = panel.querySelector("#ix-body"), kindEl = panel.querySelector("#ix-kind");
  var lastFocus = null;
  function open() { if (panel.getAttribute("aria-hidden") === "true") { lastFocus = document.activeElement; } panel.setAttribute("aria-hidden", "false"); document.body.classList.add("ix-open"); panel.focus(); }
  function close() { panel.setAttribute("aria-hidden", "true"); document.body.classList.remove("ix-open"); if (lastFocus && lastFocus.focus) lastFocus.focus(); clearEntityParam(); }
  panel.querySelector(".ix-close").addEventListener("click", close);
  panel.querySelector(".ix-grab").addEventListener("click", close);

  function actions(kind, id, extra) {
    return '<div class="ix-actions">' +
      (nodeById[id] || kind === "entity" ? '<button class="ix-b" data-act="graph" data-id="' + esc(id) + '">V grafu</button>' : "") +
      '<button class="ix-b" data-act="copy" data-id="' + esc(id) + '" data-kind="' + esc(kind) + '">Kopírovat odkaz</button>' +
      (extra || "") + "</div>";
  }

  function renderClaim(id) {
    var c = claimById[id]; if (!c) return notFound(id);
    kindEl.textContent = "tvrzení · " + id;
    var srcs = (c.sources || []).map(function (s) { return "<li>" + srcLine(s) + "</li>"; }).join("");
    var bl = claimBacklinks(id).map(function (b) { return "<li>" + entLink(b.id) + ' <span class="ix-dim">— ' + esc(b.why) + "</span></li>"; }).join("");
    body.innerHTML =
      '<div class="ix-title">' + badge(c.status) + "</div>" +
      sec("Tvrzení", '<p class="ix-p">' + esc(c.text) + "</p>") +
      (c.note ? sec("Poznámka", '<p class="ix-p ix-dim">' + esc(c.note) + "</p>") : "") +
      sec("Zdroje (" + (c.sources || []).length + ")", srcs ? "<ul class='ix-list'>" + srcs + "</ul>" : "") +
      sec("Odkazováno z", bl ? "<ul class='ix-list'>" + bl + "</ul>" : "<p class='ix-p ix-dim'>Žádná entita se na toto tvrzení přímo neodkazuje.</p>") +
      actions("claim", id);
  }
  function renderSource(id) {
    var s = srcById[id]; if (!s) return notFound(id);
    kindEl.textContent = "zdroj · " + id;
    var u = sourceUsage(id);
    body.innerHTML =
      '<div class="ix-title">tier ' + esc(s.tier) + " · " + esc(s.kind || "") + "</div>" +
      sec("Titul", '<p class="ix-p">' + esc(s.title) + "</p>") +
      sec("Odkaz", '<a class="ix-ext" href="' + esc(s.url) + '" target="_blank" rel="nofollow noopener">' + esc(s.url) + "</a>") +
      sec("Získáno", '<p class="ix-p ix-mono">' + esc(s.retrievedAt || "—") + "</p>") +
      sec("Podporuje tvrzení (" + u.claims.length + ")", u.claims.length ? "<ul class='ix-chips'>" + u.claims.map(function (x) { return "<li>" + recLink(x) + "</li>"; }).join("") + "</ul>" : "<p class='ix-p ix-dim'>—</p>") +
      sec("Podporuje vztahy (" + u.edges.length + ")", u.edges.length ? "<ul class='ix-list'>" + u.edges.map(function (e) { return "<li>" + entLink(e.source) + " → " + entLink(e.target) + ' <span class="ix-dim">(' + esc(e.label) + ")</span></li>"; }).join("") + "</ul>" : "") +
      (u.identity.length ? sec("Identita", "<p class='ix-p ix-dim'>" + esc(u.identity.join(", ")) + "</p>") : "") +
      actions("source", id);
  }
  function renderContradiction(id) {
    var c = conById[id]; if (!c) return notFound(id);
    kindEl.textContent = "rozpor · " + id;
    function side(v) { return v ? '<div class="ix-conside"><div class="ix-p">' + esc(v.value) + '</div><div class="ix-dim">' + esc(v.where || "") + " · " + srcLine(v.source) + "</div></div>" : ""; }
    body.innerHTML =
      '<div class="ix-title">' + badge(c.status) + "</div>" +
      sec("Pole", '<p class="ix-p">' + esc(c.field) + "</p>") +
      sec("Verze A", side(c.valueA)) +
      sec("Verze B", side(c.valueB)) +
      sec(c.status === "RESOLVED" ? "Vyřešení" : "Rozbor", '<p class="ix-p">' + esc(c.resolution) + "</p>") +
      actions("contradiction", id);
  }
  function renderEntity(id) {
    var n = nodeById[id]; if (!n) return notFound(id);
    kindEl.textContent = (n.group || "entita") + " · " + n.label;
    var ident = n.ident ? "<ul class='ix-kv'>" + Object.keys(n.ident).map(function (k) { return "<li><span>" + esc(k) + "</span><b class='ix-mono'>" + esc(n.ident[k]) + "</b></li>"; }).join("") + "</ul>" : "";
    var eds = entityEdges(id);
    var rels = eds.map(function (e) {
      var other = e.source === id ? e.target : e.source;
      var dir = e.source === id ? "→" : "←";
      return "<li>" + dir + " " + entLink(other) + ' <span class="ix-dim">' + esc(e.label) + "</span> " + badge(e.status) + "</li>";
    }).join("");
    var claims = (n.claims || []).map(function (x) { return "<li>" + recLink(x) + (claimById[x] ? ' <span class="ix-dim">' + esc((claimById[x].text || "").slice(0, 60)) + "…</span>" : "") + "</li>"; }).join("");
    var srcs = (n.sources || []).map(function (s) { return "<li>" + srcLine(s) + "</li>"; }).join("");
    body.innerHTML =
      '<div class="ix-title">' + esc(n.label) + "</div>" +
      (n.summary ? sec("Přehled", '<p class="ix-p">' + esc(n.summary) + "</p>") : "") +
      sec("Identifikátory", ident) +
      sec("Vztahy (" + eds.length + ")", rels ? "<ul class='ix-list'>" + rels + "</ul>" : "") +
      sec("Tvrzení", claims ? "<ul class='ix-list'>" + claims + "</ul>" : "") +
      sec("Zdroje", srcs ? "<ul class='ix-list'>" + srcs + "</ul>" : "") +
      actions("entity", id);
  }
  function notFound(id) { kindEl.textContent = "záznam · " + id; body.innerHTML = "<p class='ix-p ix-dim'>Záznam " + esc(id) + " není v datech.</p>" + actions("record", id); }

  function inspect(kind, id) {
    var isEntity = kind === "entity" || (!kind && !claimById[id] && !srcById[id] && !conById[id] && nodeById[id]);
    if (kind === "claim") renderClaim(id);
    else if (kind === "source") renderSource(id);
    else if (kind === "contradiction") renderContradiction(id);
    else if (kind === "entity") renderEntity(id);
    else if (claimById[id]) renderClaim(id);
    else if (srcById[id]) renderSource(id);
    else if (conById[id]) renderContradiction(id);
    else if (nodeById[id]) renderEntity(id);
    else notFound(id);
    open();
    // Sync the Cytoscape graph to the selected entity (graph.js listens). Only
    // for entities — claims/sources would force an aggressive graph mode switch.
    if (isEntity && nodeById[id]) document.dispatchEvent(new CustomEvent("dossier:entity-selected", { detail: { id: id } }));
  }

  // ---- listen to cockpit's selection events -------------------------------
  ["claim", "source", "contradiction", "record"].forEach(function (t) {
    document.addEventListener("dossier:" + t + "-selected", function (e) { inspect(t === "record" ? null : t, e.detail.id); });
  });
  // entity links (rendered here) — cockpit doesn't own these
  document.addEventListener("click", function (e) {
    var ent = e.target.closest("[data-entity]");
    if (ent) { e.preventDefault(); var id = ent.getAttribute("data-entity"); setEntityParam(id); inspect("entity", id); }
    var act = e.target.closest(".ix-b[data-act]");
    if (act) doAction(act.getAttribute("data-act"), act.getAttribute("data-id"), act.getAttribute("data-kind"));
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel.getAttribute("aria-hidden") === "false") close(); });

  function doAction(act, id, kind) {
    if (act === "copy") {
      var u = new URL(window.location.href);
      ["claim", "source", "record", "entity"].forEach(function (p) { u.searchParams.delete(p); });
      u.searchParams.set(kind === "entity" ? "entity" : kind === "source" ? "source" : kind === "claim" ? "claim" : "record", id);
      copy(u.toString());
    } else if (act === "graph") {
      var h = document.getElementById("fig-graph-title"); if (h) (h.closest("section") || h).scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      document.dispatchEvent(new CustomEvent("dossier:graph-focus-requested", { detail: { id: id } }));
    }
  }
  function copy(txt) {
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(toast.bind(null, "Odkaz zkopírován"), function () { toast("Odkaz: " + txt); });
    else toast("Odkaz: " + txt);
  }

  // ---- entity URL param (cockpit owns claim/source/record) ----------------
  function setEntityParam(id) { var u = new URL(window.location.href); ["claim", "source", "record"].forEach(function (p) { u.searchParams.delete(p); }); u.searchParams.set("entity", id); history.pushState({ entity: id }, "", u); }
  function clearEntityParam() { var u = new URL(window.location.href); if (u.searchParams.has("entity")) { u.searchParams.delete("entity"); history.replaceState({}, "", u); } }
  function restoreEntity() { var id = new URL(window.location.href).searchParams.get("entity"); if (id && nodeById[id]) inspect("entity", id); }
  window.addEventListener("popstate", function () { var id = new URL(window.location.href).searchParams.get("entity"); if (id && nodeById[id]) inspect("entity", id); else if (panel.getAttribute("aria-hidden") === "false" && !new URL(location.href).searchParams.get("claim") && !new URL(location.href).searchParams.get("source") && !new URL(location.href).searchParams.get("record")) close(); });

  // ---- global search -------------------------------------------------------
  var INDEX = [];
  (D.claims || []).forEach(function (c) { INDEX.push({ type: "claim", id: c.id, label: c.text, kind: "tvrzení", state: c.status, rec: true }); });
  (D.sources || []).forEach(function (s) { INDEX.push({ type: "source", id: s.id, label: s.title, kind: "zdroj", state: "tier " + s.tier, rec: true }); });
  (D.contradictions || []).forEach(function (c) { INDEX.push({ type: "record", id: c.id, label: c.field, kind: "rozpor", state: c.status, rec: true }); });
  Object.keys(nodeById).forEach(function (id) { var n = nodeById[id]; INDEX.push({ type: "entity", id: id, label: n.label + " " + JSON.stringify(n.ident || ""), display: n.label, kind: n.group || "entita", state: "", ent: true }); });

  var search = el(
    '<div class="ix-search">' +
      '<input class="ix-sin" type="search" placeholder="Hledat záznam, IČO, zdroj… (/)" aria-label="Globální hledání v dosieru" autocomplete="off" />' +
      '<ul class="ix-sres" role="listbox" hidden></ul>' +
    "</div>"
  );
  var mount = document.getElementById("cockpit-overview");
  if (mount) mount.appendChild(search); else document.querySelector("main .mx-auto").insertBefore(search, document.querySelector("main article"));
  var sin = search.querySelector(".ix-sin"), sres = search.querySelector(".ix-sres");
  var selIdx = -1, results = [];
  function runSearch() {
    var q = sin.value.trim().toLowerCase();
    if (q.length < 2) { sres.hidden = true; return; }
    results = INDEX.filter(function (r) { return (r.id + " " + r.label).toLowerCase().indexOf(q) !== -1; }).slice(0, 12);
    // exact id match first
    results.sort(function (a, b) { return (b.id.toLowerCase() === q) - (a.id.toLowerCase() === q); });
    selIdx = -1;
    sres.innerHTML = results.map(function (r, i) {
      return '<li role="option" data-i="' + i + '" class="ix-sr"><span class="ix-sr-t">' + esc(r.kind) + "</span>" +
        '<span class="ix-sr-l">' + esc((r.display || r.label).slice(0, 64)) + "</span>" +
        '<span class="ix-sr-id ix-mono">' + esc(r.id) + "</span></li>";
    }).join("") || '<li class="ix-sr ix-dim">Nic nenalezeno</li>';
    sres.hidden = false;
  }
  function pick(i) {
    var r = results[i]; if (!r) return;
    sres.hidden = true; sin.value = "";
    if (r.ent) { setEntityParam(r.id); inspect("entity", r.id); }
    else { var node = document.querySelector('[data-record="' + r.id + '"]'); if (node) node.click(); else inspect(r.type === "record" ? null : r.type, r.id); }
  }
  sin.addEventListener("input", runSearch);
  sin.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { selIdx = Math.min(selIdx + 1, results.length - 1); hi(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { selIdx = Math.max(selIdx - 1, 0); hi(); e.preventDefault(); }
    else if (e.key === "Enter") { pick(selIdx < 0 ? 0 : selIdx); }
    else if (e.key === "Escape") { sres.hidden = true; sin.blur(); }
  });
  sres.addEventListener("click", function (e) { var li = e.target.closest("[data-i]"); if (li) pick(+li.getAttribute("data-i")); });
  document.addEventListener("click", function (e) { if (!search.contains(e.target)) sres.hidden = true; });
  function hi() { sres.querySelectorAll(".ix-sr").forEach(function (li, i) { li.classList.toggle("is-sel", i === selIdx); }); }
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== sin && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "")) { e.preventDefault(); sin.focus(); }
  });

  // ---- toast + style -------------------------------------------------------
  var toastEl;
  function toast(m) { if (!toastEl) { toastEl = el('<div class="ix-toast" role="status" aria-live="polite"></div>'); document.body.appendChild(toastEl); } toastEl.textContent = m; toastEl.classList.add("on"); clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove("on"); }, 2200); }

  injectStyle();
  // Restore on load. cockpit.js dispatches its selection event before this
  // module's listeners exist (both defer, cockpit first), so open the panel
  // directly from the URL rather than relying on that event.
  (function restoreOnLoad() {
    var u = new URL(window.location.href);
    var ent = u.searchParams.get("entity");
    if (ent && nodeById[ent]) { inspect("entity", ent); return; }
    var id = u.searchParams.get("claim") || u.searchParams.get("source") || u.searchParams.get("record");
    if (id) inspect(u.searchParams.get("claim") ? "claim" : u.searchParams.get("source") ? "source" : null, id);
  })();

  function injectStyle() {
    if (document.getElementById("ix-style")) return;
    var c =
      ".ix-panel{position:fixed;z-index:70;right:0;top:0;bottom:0;width:min(400px,92vw);background:#0b0b0b;border-left:1px solid rgba(255,255,255,.14);box-shadow:-18px 0 46px rgba(0,0,0,.6);transform:translateX(101%);transition:transform .26s ease;overflow-y:auto;padding:0 1rem 1.4rem;color:#cbd5e1;font-size:.84rem}" +
      ".ix-panel[aria-hidden='false']{transform:none}" +
      "@media(max-width:768px){.ix-panel{right:0;left:0;top:auto;width:auto;max-height:84vh;border-left:0;border-top:1px solid rgba(255,255,255,.14);border-radius:1rem 1rem 0 0;transform:translateY(101%)}.ix-panel[aria-hidden='false']{transform:none}}" +
      "@media(prefers-reduced-motion:reduce){.ix-panel{transition:none}}" +
      ".ix-head{position:sticky;top:0;background:#0b0b0b;display:grid;grid-template-columns:1fr auto;align-items:center;gap:.5rem;padding:.7rem 0 .55rem;border-bottom:1px solid rgba(255,255,255,.1);z-index:2}" +
      ".ix-grab{grid-column:1/3;width:44px;height:4px;border-radius:2px;background:rgba(255,255,255,.28);margin:0 auto .3rem;cursor:pointer}@media(min-width:769px){.ix-grab{display:none}}" +
      ".ix-kind{font-size:.6rem;text-transform:uppercase;letter-spacing:.08em;color:" + GOLD + ";font-family:ui-monospace,monospace}" +
      ".ix-close{background:#1c1c1c;color:#e5e7eb;border:1px solid rgba(255,255,255,.16);border-radius:.5rem;padding:.35rem .6rem;font-size:.76rem;cursor:pointer}.ix-close:focus-visible{outline:2px solid " + GOLD + "}" +
      ".ix-title{font-size:1rem;font-weight:800;color:#fff;margin:.7rem 0 .3rem}" +
      ".ix-sec{margin:.7rem 0}.ix-sec h4{font-size:.6rem;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.45);margin:0 0 .3rem}" +
      ".ix-p{font-size:.82rem;line-height:1.5;margin:0}.ix-dim{color:rgba(255,255,255,.45)}.ix-mono{font-family:ui-monospace,monospace;font-size:.74rem}" +
      ".ix-list{list-style:none;margin:0;padding:0}.ix-list li{padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.06);line-height:1.4}" +
      ".ix-kv{list-style:none;margin:0;padding:0}.ix-kv li{display:flex;justify-content:space-between;gap:.6rem;padding:.22rem 0;border-bottom:1px solid rgba(255,255,255,.06)}.ix-kv span{color:rgba(255,255,255,.5)}.ix-kv b{color:#e5e7eb;text-align:right}" +
      ".ix-chips{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.3rem}" +
      ".ix-rl{background:rgba(243,229,192,.08);border:1px solid rgba(243,229,192,.2);color:" + CHAMPAGNE + ";border-radius:.3rem;padding:.05rem .35rem;font-size:.75rem;cursor:pointer;font-family:ui-monospace,monospace}" +
      ".ix-rl:hover,.ix-rl:focus-visible{background:rgba(243,229,192,.18);outline:none}.ix-rl:focus-visible{outline:2px solid " + GOLD + ";outline-offset:1px}" +
      ".ix-ext{color:#9ec5c0;text-decoration:underline;text-underline-offset:2px;word-break:break-word}" +
      ".ix-badge{display:inline-block;font-size:.56rem;padding:.06rem .3rem;border-radius:.25rem;vertical-align:middle}" +
      ".ix-good{background:rgba(243,229,192,.18);color:" + CHAMPAGNE + "}.ix-warn{background:rgba(212,175,55,.2);color:" + GOLD + "}.ix-muted{background:rgba(255,255,255,.08);color:#9ca3af}" +
      ".ix-conside{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:.4rem;padding:.45rem .55rem}" +
      ".ix-actions{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:1rem;padding-top:.7rem;border-top:1px solid rgba(255,255,255,.1)}" +
      ".ix-b{background:#171717;color:#d1d5db;border:1px solid rgba(255,255,255,.15);border-radius:.5rem;padding:.4rem .7rem;font-size:.76rem;cursor:pointer}.ix-b:hover{border-color:" + GOLD + ";color:#fff}.ix-b:focus-visible{outline:2px solid " + GOLD + "}" +
      // search
      ".ix-search{position:relative;margin-top:.6rem}" +
      ".ix-sin{width:100%;box-sizing:border-box;background:#121212;color:#e5e7eb;border:1px solid rgba(255,255,255,.16);border-radius:.5rem;padding:.5rem .6rem;font-size:.82rem}.ix-sin:focus-visible{outline:2px solid " + GOLD + ";border-color:" + GOLD + "}" +
      ".ix-sres{position:absolute;z-index:65;left:0;right:0;top:calc(100% + .25rem);list-style:none;margin:0;padding:.25rem;background:#0c0c0c;border:1px solid rgba(255,255,255,.16);border-radius:.5rem;max-height:52vh;overflow-y:auto;box-shadow:0 14px 34px rgba(0,0,0,.6)}" +
      ".ix-sr{display:grid;grid-template-columns:auto 1fr auto;gap:.5rem;align-items:baseline;padding:.4rem .5rem;border-radius:.35rem;cursor:pointer;font-size:.8rem}.ix-sr:hover,.ix-sr.is-sel{background:rgba(243,229,192,.12)}" +
      ".ix-sr-t{font-size:.58rem;text-transform:uppercase;letter-spacing:.04em;color:" + GOLD + "}.ix-sr-l{color:#e5e7eb;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ix-sr-id{color:rgba(255,255,255,.4)}" +
      ".ix-toast{position:fixed;bottom:4.2rem;left:50%;transform:translateX(-50%);background:" + GOLD + ";color:#0a0a0a;font-size:.76rem;font-weight:600;padding:.4rem .8rem;border-radius:.4rem;opacity:0;pointer-events:none;transition:opacity .2s;z-index:80}.ix-toast.on{opacity:1}";
    var st = document.createElement("style"); st.id = "ix-style"; st.textContent = c; document.head.appendChild(st);
  }
})();
