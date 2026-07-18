/*
 * Able.cz dossier — investigation lenses.
 *
 * A lens re-prioritises presentation for a given reader (executive, analyst,
 * investigator…) WITHOUT changing the underlying truth or hiding any data
 * (brief §6). Applying a lens: accents the sections it foregrounds, filters the
 * cockpit's section navigator to them, shows an active-lens indicator, and sets
 * ?lens= in the URL. Every section stays fully on the page and reachable; the
 * lens only guides. "Vše" clears it.
 *
 * Reads the page's own sections + the cockpit navigator — no data, no fabrication.
 * Authored here; copied to static/js/lens.js by `npm run js:build`.
 */
(function () {
  "use strict";
  var main = document.querySelector("main");
  if (!main) return;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var GOLD = "#d4af37", CHAMPAGNE = "#f3e5c0";

  var sections = Array.prototype.slice.call(main.querySelectorAll("section[aria-labelledby]"))
    .map(function (sec) { var h = document.getElementById(sec.getAttribute("aria-labelledby")); return h ? { id: h.id, sec: sec, label: h.textContent.trim() } : null; })
    .filter(Boolean);
  if (sections.length < 4) return;
  var has = {}; sections.forEach(function (s) { has[s.id] = true; });

  // Lens → the section ids it foregrounds (primary first). Filtered to what
  // actually exists on the page, so a template change can't break it.
  var RAW = [
    { key: "vse", label: "Vše", ids: [] },
    { key: "prehled", label: "Přehled", ids: ["fig-claims-title", "fig-graph-title", "id-title", "fin-title", "oq-title"] },
    { key: "struktura", label: "Struktura", ids: ["fig-graph-title", "id-title", "ind-title"] },
    { key: "finance", label: "Finance", ids: ["fin-title"] },
    { key: "evidence", label: "Evidence", ids: ["evd-title", "ind-title", "cov-title", "src-title"] },
    { key: "setreni", label: "Šetření", ids: ["cov-title", "gap-title", "hyp-title", "fr-title", "oq-title", "rq-title"] },
    { key: "prostor", label: "Adresy", ids: ["addr-title"] },
  ];
  var LENSES = RAW.map(function (l) { return { key: l.key, label: l.label, ids: l.ids.filter(function (i) { return has[i]; }) }; })
    .filter(function (l) { return l.key === "vse" || l.ids.length; });
  var byKey = {}; LENSES.forEach(function (l) { byKey[l.key] = l; });

  // ---- chip bar ------------------------------------------------------------
  var bar = document.createElement("div");
  bar.className = "lens-bar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Objektiv šetření");
  bar.innerHTML = '<span class="lens-lbl">Objektiv</span>' +
    LENSES.map(function (l) { return '<button class="lens-chip" data-lens="' + l.key + '"' + (l.key === "vse" ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' + l.label + "</button>"; }).join("");
  var mount = document.getElementById("cockpit-overview");
  if (mount) mount.appendChild(bar); else main.querySelector(".mx-auto").insertBefore(bar, main.querySelector("article"));

  var current = "vse";
  function apply(key, opts) {
    var l = byKey[key] || byKey.vse; key = l.key; current = key;
    opts = opts || {};
    var set = {}; l.ids.forEach(function (i) { set[i] = true; });
    var isAll = key === "vse";
    sections.forEach(function (s) {
      // Coerce to a real boolean: classList.toggle(class, undefined) FLIPS
      // instead of removing, which would accent non-lens sections.
      s.sec.classList.toggle("lens-in", !isAll && set[s.id] === true);
    });
    // filter the cockpit navigator to the lens's sections
    document.querySelectorAll(".cp-nav-list [data-nav]").forEach(function (a) {
      var li = a.closest("li") || a;
      li.classList.toggle("lens-nav-hide", !isAll && !set[a.getAttribute("data-nav")]);
    });
    // chip pressed state
    bar.querySelectorAll(".lens-chip").forEach(function (b) {
      var on = b.getAttribute("data-lens") === key;
      b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on));
    });
    document.body.setAttribute("data-lens", key);
    // URL
    if (opts.push !== false) {
      var u = new URL(window.location.href);
      if (isAll) u.searchParams.delete("lens"); else u.searchParams.set("lens", key);
      history[opts.replace ? "replaceState" : "pushState"]({ lens: key }, "", u);
    }
    // scroll to the primary section
    if (opts.scroll && !isAll && l.ids[0]) {
      var h = document.getElementById(l.ids[0]);
      if (h) (h.closest("section") || h).scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }
    announce(isAll ? "Objektiv zrušen — všechny sekce" : "Objektiv: " + l.label + " · " + l.ids.length + " sekcí");
  }

  bar.addEventListener("click", function (e) {
    var b = e.target.closest("[data-lens]");
    if (b) apply(b.getAttribute("data-lens"), { scroll: true });
  });
  window.addEventListener("popstate", function () {
    var k = new URL(window.location.href).searchParams.get("lens") || "vse";
    apply(byKey[k] ? k : "vse", { push: false });
  });

  // a11y live region (own, to not depend on other modules)
  var live = document.createElement("div");
  live.setAttribute("aria-live", "polite"); live.className = "lens-live";
  document.body.appendChild(live);
  var liveT; function announce(m) { clearTimeout(liveT); liveT = setTimeout(function () { live.textContent = m; }, 80); }

  injectStyle();
  // restore ?lens on load (replaceState so it doesn't add a history entry)
  var initial = new URL(window.location.href).searchParams.get("lens");
  if (initial && byKey[initial] && initial !== "vse") apply(initial, { push: false, scroll: true });

  function injectStyle() {
    if (document.getElementById("lens-style")) return;
    var c =
      ".lens-bar{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem;margin-top:.6rem}" +
      ".lens-lbl{font-size:.6rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.4);margin-right:.2rem}" +
      ".lens-chip{background:#171717;color:#9ca3af;border:1px solid rgba(255,255,255,.15);border-radius:1rem;padding:.28rem .7rem;font-size:.74rem;cursor:pointer;transition:all .12s}" +
      ".lens-chip:hover{border-color:" + GOLD + ";color:#fff}" +
      ".lens-chip.is-on{background:" + CHAMPAGNE + ";border-color:" + GOLD + ";color:#0a0a0a;font-weight:600}" +
      ".lens-chip:focus-visible{outline:2px solid " + GOLD + ";outline-offset:1px}" +
      // foregrounded sections: gold rail + a quiet "v objektivu" tag
      ".lens-in{position:relative;padding-left:1rem;border-left:2px solid " + GOLD + "}" +
      ".lens-in::before{content:'v objektivu';position:absolute;top:.1rem;left:1rem;font-size:.54rem;text-transform:uppercase;letter-spacing:.08em;color:" + GOLD + ";opacity:.75}" +
      "@media(prefers-reduced-motion:no-preference){.lens-in{transition:border-color .2s,padding .2s}}" +
      ".lens-nav-hide{display:none}" +
      ".lens-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}";
    var st = document.createElement("style"); st.id = "lens-style"; st.textContent = c; document.head.appendChild(st);
  }
})();
