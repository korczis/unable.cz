/*
 * Able.cz dossier — investigation cockpit layer.
 *
 * Turns the long report into a navigable, hyperlinked surface WITHOUT replacing
 * any content or introducing an SPA framework. Three progressive enhancements,
 * all computed from the same #dossier-data the page already embeds (so nothing
 * is invented and nothing breaks with JS off):
 *
 *   1. Executive overview — compact canonical metrics, each clickable to its
 *      section, each with a "Proč toto číslo?" calculation popover.
 *   2. Section navigator — a sticky jump bar with active-section tracking.
 *   3. Deep-linkable records — click any CLM-/SRC- id to highlight every mention
 *      and set ?claim=/?source= in the URL; reload/back restore the selection.
 *
 * Authored here; copied to static/js/cockpit.js by `npm run js:build`. Loaded on
 * /dossier/ only. Reduced-motion and keyboard accessible.
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
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }

  // ---- canonical metric computation (from #dossier-data only) --------------
  // Count LIVE claims only. Superseded claims are an audit trail (fact/assessment
  // splits) and the claims table hides them ({% if not c.superseded %}); counting
  // them here would make the overview disagree with the table (§36 consistency).
  var claims = (D.claims || []).filter(function (c) { return !c.superseded; });
  function countStatus(sts) { return claims.filter(function (c) { return sts.indexOf(c.status) !== -1; }); }
  var verified = countStatus(["VERIFIED_PRIMARY", "CORROBORATED"]);
  var selfrep = countStatus(["SELF_REPORTED"]);
  var assessed = countStatus(["ASSESSED"]);
  var contradictedClaims = countStatus(["CONTRADICTED"]);
  var sources = D.sources || [];
  var officialSrc = sources.filter(function (s) { return s.tier === 1 || /official|government|register|VIES|justice|ARES|Sbírka/i.test(s.kind || s.title || ""); });
  var primaryDocs = sources.filter(function (s) { return /primary registry document|filed financial|court (execution|notice)/i.test(s.kind || ""); });
  var cons = D.contradictions || [];
  var resolvedCons = cons.filter(function (c) { return c.status === "RESOLVED"; });
  var openQ = (D.openQuestions || []).length;
  var nodes = (D.graph && D.graph.nodes) || [];
  var edges = (D.graph && D.graph.edges) || [];

  // Each metric: label, value, ids it counts, target section, why-calc text.
  var METRICS = [
    { key: "claims", label: "Tvrzení", value: claims.length, tone: "n", section: "fig-claims-title",
      ids: claims.map(function (c) { return c.id; }),
      why: "Počet všech posuzovaných tvrzení v " + esc("data/dossier/able/dossier.json") + " (pole claims)." },
    { key: "verified", label: "Ověřeno", value: verified.length, tone: "good", section: "fig-claims-title",
      ids: verified.map(function (c) { return c.id; }),
      why: "Tvrzení se stavem VERIFIED_PRIMARY nebo CORROBORATED. Pozor: CORROBORATED přes agregátory téže autority není nezávislé potvrzení — viz Nezávislost zdrojů." },
    { key: "selfrep", label: "Tvrzení firmy", value: selfrep.length, tone: "muted", section: "fig-claims-title",
      ids: selfrep.map(function (c) { return c.id; }),
      why: "Tvrzení se stavem SELF_REPORTED — uvádí je Able nebo přidružený zdroj, nezávisle nepotvrzeno." },
    { key: "assessed", label: "Posouzeno", value: assessed.length, tone: "muted", section: "fig-claims-title",
      ids: assessed.map(function (c) { return c.id; }),
      why: "Tvrzení se stavem ASSESSED — analytické čtení evidence, ne fakt." },
    { key: "contradictions", label: "Rozpory", value: cons.length, tone: cons.length > resolvedCons.length ? "warn" : "n", section: "id-title",
      ids: cons.map(function (c) { return c.id; }),
      why: cons.length + " zaznamenaných rozporů, z toho " + resolvedCons.length + " vyřešeno (RESOLVED). Rozpory se nezamlčují ani nepřepisují." },
    { key: "sources", label: "Zdroje", value: sources.length, tone: "n", section: "src-title",
      ids: sources.map(function (s) { return s.id; }),
      why: sources.length + " veřejných zdrojů; " + officialSrc.length + " oficiálních, " + primaryDocs.length + " primárních dokumentů." },
    { key: "primary", label: "Primární dok.", value: primaryDocs.length, tone: "good", section: "src-title",
      ids: primaryDocs.map(function (s) { return s.id; }),
      why: "Přímé primární registrové dokumenty (Sbírka listin, exekuční příkazy) — nejsilnější tier evidence." },
    { key: "network", label: "Entity · vazby", value: nodes.length + " · " + edges.length, tone: "n", section: "fig-graph-title",
      ids: [], why: nodes.length + " entit a " + edges.length + " vztahů v grafu; každá hrana nese zdroj a vysvětlení." },
    { key: "open", label: "Otevřené otázky", value: openQ, tone: "warn", section: "oq-title",
      ids: [], why: openQ + " otevřených otázek — mezery v evidenci, ne důkaz. Viz Mezery a Fronta šetření." },
  ];

  // ---- 1. executive overview ----------------------------------------------
  var mount = document.getElementById("cockpit-overview");
  if (mount) {
    var toneClass = { good: "cp-good", muted: "cp-muted", warn: "cp-warn", n: "cp-n" };
    var strip = el('<section class="cp-overview" aria-label="Přehled stavu šetření"></section>');
    var grid = el('<div class="cp-grid" role="list"></div>');
    METRICS.forEach(function (m) {
      var cell = el(
        '<div class="cp-cell" role="listitem">' +
          '<button class="cp-metric ' + toneClass[m.tone] + '" data-metric="' + m.key + '" aria-describedby="cpwhy-' + m.key + '">' +
            '<span class="cp-val">' + esc(String(m.value)) + '</span>' +
            '<span class="cp-lbl">' + esc(m.label) + '</span>' +
          '</button>' +
          '<button class="cp-why" data-why="' + m.key + '" aria-expanded="false" aria-controls="cpwhy-' + m.key + '" title="Proč toto číslo?">?</button>' +
          '<div class="cp-whybox" id="cpwhy-' + m.key + '" hidden>' + esc(m.why) +
            (m.ids.length ? '<div class="cp-ids">' + m.ids.slice(0, 60).map(function (i) { return '<code>' + esc(i) + '</code>'; }).join(" ") + '</div>' : '') +
          '</div>' +
        '</div>'
      );
      grid.appendChild(cell);
    });
    strip.appendChild(el('<div class="cp-ohead">Stav šetření <span class="cp-cut">k ' + esc(D.meta && D.meta.evidenceCutoff || "") + '</span></div>'));
    strip.appendChild(grid);
    mount.appendChild(strip);

    strip.addEventListener("click", function (e) {
      var mb = e.target.closest("[data-metric]");
      if (mb) { var m = METRICS.filter(function (x) { return x.key === mb.getAttribute("data-metric"); })[0]; focusSection(m.section); if (m.ids.length) highlightIds(m.ids, m.key); return; }
      var wb = e.target.closest("[data-why]");
      if (wb) { var box = document.getElementById("cpwhy-" + wb.getAttribute("data-why")); var open = !box.hidden; box.hidden = open; wb.setAttribute("aria-expanded", String(!open)); }
    });
  }

  // ---- 2. section navigator (jump bar + active tracking) ------------------
  var sections = Array.prototype.slice.call(document.querySelectorAll("main section[aria-labelledby]"))
    .map(function (sec) { var h = document.getElementById(sec.getAttribute("aria-labelledby")); return h ? { id: h.id, label: h.textContent.trim(), sec: sec, h: h } : null; })
    .filter(Boolean);

  if (sections.length > 3) {
    var nav = el(
      '<nav class="cp-nav" aria-label="Navigátor sekcí">' +
        '<button class="cp-nav-toggle" aria-expanded="false" aria-controls="cp-nav-list">' +
          '<span class="cp-nav-cur">Přehled</span><span class="cp-nav-caret" aria-hidden="true">▾</span></button>' +
        '<ul class="cp-nav-list" id="cp-nav-list" hidden></ul>' +
      '</nav>'
    );
    var list = nav.querySelector(".cp-nav-list");
    sections.forEach(function (s, i) {
      var li = el('<li><a href="#' + esc(s.id) + '" data-nav="' + esc(s.id) + '"><span class="cp-nav-n">' + (i + 1) + '</span>' + esc(s.label) + '</a></li>');
      list.appendChild(li);
    });
    document.body.appendChild(nav);
    var toggle = nav.querySelector(".cp-nav-toggle"), cur = nav.querySelector(".cp-nav-cur");
    function setNavOpen(open) { list.hidden = !open; toggle.setAttribute("aria-expanded", String(open)); }
    toggle.addEventListener("click", function () { setNavOpen(list.hidden); });
    list.addEventListener("click", function (e) { var a = e.target.closest("[data-nav]"); if (a) { setNavOpen(false); } });
    document.addEventListener("click", function (e) { if (!nav.contains(e.target)) setNavOpen(false); });

    // active-section tracking
    if ("IntersectionObserver" in window) {
      var active = null;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) active = en.target.getAttribute("aria-labelledby"); });
        if (active) {
          var s = sections.filter(function (x) { return x.id === active; })[0];
          if (s) cur.textContent = s.label.length > 28 ? s.label.slice(0, 27) + "…" : s.label;
          list.querySelectorAll("a").forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("data-nav") === active); });
        }
      }, { rootMargin: "-20% 0px -70% 0px" });
      sections.forEach(function (s) { io.observe(s.sec); });
    }
  }

  // ---- 3. deep-linkable records (claim / source ids) ----------------------
  var ID_RE = /^(CLM-\d+|SRC-\d+|CON-\d+|GAP[-\w]*|HYP-\d+|Q-[\w-]+|TASK-[\w-]+)$/;
  // Make every mono cell that is exactly an id into a record link.
  Array.prototype.slice.call(document.querySelectorAll("main td.font-mono, main span.font-mono, main code")).forEach(function (node) {
    var txt = node.textContent.trim();
    if (!ID_RE.test(txt)) return;
    if (node.querySelector("button")) return;
    node.setAttribute("data-record", txt);
    node.classList.add("cp-rec");
    node.setAttribute("tabindex", "0");
    node.setAttribute("role", "button");
    node.setAttribute("aria-label", "Zvýraznit záznam " + txt);
  });

  function recType(id) {
    if (id.indexOf("CLM-") === 0) return "claim";
    if (id.indexOf("SRC-") === 0) return "source";
    if (id.indexOf("CON-") === 0) return "contradiction";
    return "record";
  }
  function highlightIds(ids, tag) {
    clearRecHi();
    var set = {};
    ids.forEach(function (i) { set[i] = 1; });
    var first = null;
    document.querySelectorAll("[data-record]").forEach(function (n) {
      if (set[n.getAttribute("data-record")]) { n.classList.add("cp-hi"); var row = n.closest("tr"); if (row) row.classList.add("cp-hi-row"); if (!first) first = n; }
    });
    // announce
    announce((ids.length) + " zvýrazněno" + (tag ? " (" + tag + ")" : ""));
    return first;
  }
  function selectRecord(id, push) {
    clearRecHi();
    var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-record="' + id + '"]'));
    var first = null;
    nodes.forEach(function (n) { n.classList.add("cp-hi"); var row = n.closest("tr"); if (row) row.classList.add("cp-hi-row"); if (!first) first = n; });
    // cross-reference: highlight rows/cells that mention this id anywhere
    document.querySelectorAll("main td, main li").forEach(function (c) {
      if (c.getAttribute && c.getAttribute("data-record") === id) return;
      if (new RegExp("\\b" + id.replace(/[-]/g, "\\-") + "\\b").test(c.textContent)) c.classList.add("cp-hi-ref");
    });
    if (first) { first.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" }); flash(first); }
    var t = recType(id);
    if (push !== false) setParam(t === "source" ? "source" : t === "claim" ? "claim" : "record", id);
    // let the graph workspace react if it listens
    document.dispatchEvent(new CustomEvent("dossier:" + t + "-selected", { detail: { id: id } }));
    announce("Vybrán záznam " + id);
  }
  function clearRecHi() {
    document.querySelectorAll(".cp-hi").forEach(function (n) { n.classList.remove("cp-hi"); });
    document.querySelectorAll(".cp-hi-row").forEach(function (n) { n.classList.remove("cp-hi-row"); });
    document.querySelectorAll(".cp-hi-ref").forEach(function (n) { n.classList.remove("cp-hi-ref"); });
  }
  function flash(n) { n.classList.add("cp-flash"); setTimeout(function () { n.classList.remove("cp-flash"); }, reduceMotion ? 0 : 1100); }

  document.addEventListener("click", function (e) {
    var rec = e.target.closest("[data-record]");
    if (rec) { selectRecord(rec.getAttribute("data-record"), true); }
  });
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.hasAttribute && e.target.hasAttribute("data-record")) { e.preventDefault(); selectRecord(e.target.getAttribute("data-record"), true); }
    if (e.key === "Escape") { clearRecHi(); clearParams(); }
  });

  // ---- URL state (History API) --------------------------------------------
  function setParam(k, v) {
    var u = new URL(window.location.href);
    ["claim", "source", "record"].forEach(function (p) { u.searchParams.delete(p); });
    u.searchParams.set(k, v);
    history.pushState({ k: k, v: v }, "", u);
  }
  function clearParams() {
    var u = new URL(window.location.href);
    var had = ["claim", "source", "record"].some(function (p) { return u.searchParams.has(p); });
    if (!had) return;
    ["claim", "source", "record"].forEach(function (p) { u.searchParams.delete(p); });
    history.pushState({}, "", u);
  }
  function focusSection(id) { var h = document.getElementById(id); if (h) { (h.closest("section") || h).scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); flash(h); } }
  function restoreFromUrl(push) {
    var u = new URL(window.location.href);
    var id = u.searchParams.get("claim") || u.searchParams.get("source") || u.searchParams.get("record");
    if (id && document.querySelector('[data-record="' + id + '"]')) selectRecord(id, false);
    else clearRecHi();
  }
  window.addEventListener("popstate", function () { restoreFromUrl(false); });

  // ---- a11y live region ----------------------------------------------------
  var live = el('<div class="cp-live" aria-live="polite" role="status"></div>');
  document.body.appendChild(live);
  var liveT;
  function announce(msg) { clearTimeout(liveT); liveT = setTimeout(function () { live.textContent = msg; }, 60); }

  injectStyle();
  restoreFromUrl(false); // deep-link on load

  function injectStyle() {
    if (document.getElementById("cp-style")) return;
    var c =
      ".cp-overview{margin-top:1.5rem;border:1px solid rgba(255,255,255,.1);border-radius:.6rem;background:rgba(255,255,255,.02);padding:.7rem .8rem}" +
      ".cp-ohead{font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.4);margin-bottom:.55rem}" +
      ".cp-cut{color:rgba(255,255,255,.3);text-transform:none;letter-spacing:0}" +
      ".cp-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem}" +
      "@media(min-width:520px){.cp-grid{grid-template-columns:repeat(3,1fr)}}" +
      "@media(min-width:900px){.cp-grid{grid-template-columns:repeat(9,1fr)}}" +
      ".cp-cell{position:relative;min-width:0}" +
      ".cp-metric{display:flex;flex-direction:column;align-items:flex-start;gap:.1rem;width:100%;text-align:left;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:.45rem;padding:.4rem .5rem;cursor:pointer;transition:border-color .12s,background .12s;min-height:52px}" +
      ".cp-metric:hover{border-color:" + GOLD + ";background:rgba(255,255,255,.06)}" +
      ".cp-metric:focus-visible{outline:2px solid " + GOLD + ";outline-offset:1px}" +
      ".cp-val{font-size:1.05rem;font-weight:800;line-height:1;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}" +
      ".cp-lbl{font-size:.6rem;text-transform:uppercase;letter-spacing:.04em;color:rgba(255,255,255,.5);line-height:1.1}" +
      ".cp-good .cp-val{color:" + CHAMPAGNE + "}.cp-warn .cp-val{color:" + GOLD + "}.cp-muted .cp-val{color:#9ca3af}.cp-n .cp-val{color:#e5e7eb}" +
      ".cp-why{position:absolute;top:.25rem;right:.25rem;width:16px;height:16px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:#111;color:rgba(255,255,255,.5);font-size:.6rem;line-height:1;cursor:pointer;padding:0}" +
      ".cp-why:hover,.cp-why:focus-visible{border-color:" + GOLD + ";color:" + GOLD + ";outline:none}" +
      ".cp-whybox{position:absolute;z-index:40;top:calc(100% + .3rem);left:0;right:auto;min-width:230px;max-width:min(340px,80vw);background:#0c0c0c;border:1px solid rgba(255,255,255,.15);border-radius:.4rem;padding:.55rem .6rem;font-size:.72rem;line-height:1.45;color:#cbd5e1;box-shadow:0 12px 30px rgba(0,0,0,.6)}" +
      ".cp-ids{margin-top:.4rem;display:flex;flex-wrap:wrap;gap:.2rem}.cp-ids code{font-size:.6rem;color:rgba(255,255,255,.45);background:rgba(255,255,255,.05);border-radius:.2rem;padding:0 .2rem}" +
      // record links
      ".cp-rec{cursor:pointer;border-bottom:1px dotted rgba(243,229,192,.4);transition:color .1s}" +
      ".cp-rec:hover,.cp-rec:focus-visible{color:" + CHAMPAGNE + ";outline:none;border-bottom-color:" + CHAMPAGNE + "}" +
      ".cp-rec:focus-visible{outline:2px solid " + GOLD + ";outline-offset:2px}" +
      ".cp-hi{background:rgba(243,229,192,.16);color:" + CHAMPAGNE + " !important;border-radius:.2rem}" +
      ".cp-hi-row{background:rgba(243,229,192,.06)}.cp-hi-ref{background:rgba(243,229,192,.05)}" +
      ".cp-flash{animation:cpflash 1.1s ease}@keyframes cpflash{0%{background:rgba(212,175,55,.35)}100%{background:transparent}}" +
      "@media(prefers-reduced-motion:reduce){.cp-flash{animation:none}}" +
      // section navigator
      ".cp-nav{position:fixed;left:50%;transform:translateX(-50%);bottom:1rem;z-index:60;width:min(560px,92vw)}" +
      ".cp-nav-toggle{display:flex;align-items:center;justify-content:space-between;gap:.5rem;width:100%;background:#0c0c0c;color:#e5e7eb;border:1px solid rgba(255,255,255,.18);border-radius:.6rem;padding:.5rem .8rem;font-size:.8rem;cursor:pointer;box-shadow:0 8px 26px rgba(0,0,0,.55)}" +
      ".cp-nav-toggle:focus-visible{outline:2px solid " + GOLD + "}" +
      ".cp-nav-cur{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".cp-nav-caret{color:" + GOLD + "}" +
      ".cp-nav-list{list-style:none;margin:0 0 .35rem;padding:.3rem;background:#0c0c0c;border:1px solid rgba(255,255,255,.16);border-radius:.6rem;max-height:60vh;overflow-y:auto;box-shadow:0 12px 34px rgba(0,0,0,.6)}" +
      ".cp-nav-list li{margin:0}.cp-nav-list a{display:flex;gap:.5rem;align-items:baseline;padding:.42rem .55rem;border-radius:.4rem;color:#cbd5e1;text-decoration:none;font-size:.82rem}" +
      ".cp-nav-list a:hover{background:rgba(255,255,255,.06);color:#fff}.cp-nav-list a.is-active{background:rgba(243,229,192,.12);color:" + CHAMPAGNE + "}" +
      ".cp-nav-list a:focus-visible{outline:2px solid " + GOLD + ";outline-offset:-2px}" +
      ".cp-nav-n{font-family:ui-monospace,monospace;font-size:.66rem;color:rgba(255,255,255,.35);min-width:1.2em}" +
      ".cp-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}" +
      "@media(min-width:1280px){.cp-nav{left:auto;right:1.2rem;transform:none;width:280px}}";
    var st = document.createElement("style"); st.id = "cp-style"; st.textContent = c; document.head.appendChild(st);
  }
})();
