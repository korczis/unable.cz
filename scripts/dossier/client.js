/*
 * Client-side rendering for the three dossier figures, all drawn from the same
 * measured/sourced data embedded in #dossier-data (from
 * data/dossier/able/dossier.json). Each figure is a progressive enhancement:
 * the page already shows the same information as data tables, so if a library
 * is missing or JS is off, nothing is lost.
 *
 * Authored here and copied to static/js/dossier.js by `npm run js:build`.
 *
 *   Chart.js     — claim verification status (doughnut)
 *   Cytoscape.js — entity/relationship graph
 *   p5.js        — one mark per claim, coloured by status ("evidence field")
 */
(function () {
  "use strict";

  var el = document.getElementById("dossier-data");
  if (!el) return;
  var data;
  try { data = JSON.parse(el.textContent); } catch (e) { return; }

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var CHAMPAGNE = "#f3e5c0";
  var GOLD = "#d4af37";
  var MUTED = "#6b7280";

  // Colour every status consistently across all three figures.
  function statusColor(status) {
    if (status === "VERIFIED_PRIMARY" || status === "CORROBORATED") return CHAMPAGNE;
    if (status === "CONTRADICTED") return GOLD;
    return MUTED; // SELF_REPORTED, ASSESSED, NOT_FOUND, UNKNOWN
  }

  // Count claims by status — the shared basis of figures 1 and 3.
  // Superseded claims are audit-trail records; the figures show live ones only.
  var claims = (data.claims || []).filter(function (c) { return !c.superseded; });
  var counts = {};
  claims.forEach(function (c) { counts[c.status] = (counts[c.status] || 0) + 1; });
  var statuses = Object.keys(counts);

  // ---- Figure 1: status doughnut (Chart.js) -------------------------------
  (function () {
    var canvas = document.getElementById("status-chart");
    if (!canvas || typeof window.Chart === "undefined") return;

    new window.Chart(canvas, {
      type: "doughnut",
      data: {
        labels: statuses,
        datasets: [{
          data: statuses.map(function (s) { return counts[s]; }),
          backgroundColor: statuses.map(statusColor),
          borderColor: "#000000",
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: reduceMotion ? false : { duration: 400 },
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#cbd5e1", boxWidth: 12, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var total = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                var pct = Math.round((ctx.parsed / total) * 100);
                return ctx.label + ": " + ctx.parsed + " of " + total + " (" + pct + "%)";
              },
            },
          },
        },
      },
    });
  })();

  // ---- Figure 1b: investigation coverage (Chart.js) -----------------------
  // One horizontal bar per dimension, height = ASSESSED ordinal coverage. The
  // matrix table beside it is the full, no-JS fallback. Reads the derived,
  // publication-safe coverage export embedded as #coverage-data.
  (function () {
    var canvas = document.getElementById("coverage-chart");
    var covEl = document.getElementById("coverage-data");
    if (!canvas || !covEl || typeof window.Chart === "undefined") return;
    var cov;
    try { cov = JSON.parse(covEl.textContent); } catch (e) { return; }
    var dims = (cov && cov.dimensions) || [];
    if (!dims.length) return;

    // Ordinal → height. Colour tracks strength so the eye reads it the same way
    // as the status figures (champagne = well-evidenced, muted = thin/absent).
    var RANK = { strong: 5, adequate: 4, partial: 3, weak: 2, absent: 1 };
    var LABEL = { strong: "silné", adequate: "dostatečné", partial: "částečné", weak: "slabé", absent: "chybí" };
    function covColor(state) {
      if (state === "strong" || state === "adequate") return CHAMPAGNE;
      if (state === "partial") return "#c8a24a";
      return MUTED;
    }
    new window.Chart(canvas, {
      type: "bar",
      data: {
        labels: dims.map(function (x) { return x.label; }),
        datasets: [{
          label: "Pokrytí",
          data: dims.map(function (x) { return RANK[x.coverage] || 0; }),
          backgroundColor: dims.map(function (x) { return covColor(x.coverage); }),
          borderColor: "#000000",
          borderWidth: 1,
        }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: true,
        animation: reduceMotion ? false : { duration: 400 },
        scales: {
          x: {
            min: 0, max: 5,
            ticks: {
              color: "#9ca3af", stepSize: 1,
              callback: function (v) {
                var m = { 5: "silné", 4: "dostatečné", 3: "částečné", 2: "slabé", 1: "chybí" };
                return m[v] || "";
              },
            },
            grid: { color: "rgba(255,255,255,0.06)" },
          },
          y: { ticks: { color: "#cbd5e1", font: { size: 11 } }, grid: { display: false } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var dim = dims[ctx.dataIndex];
                return LABEL[dim.coverage] + " · " + dim.sourcesChecked.length + " zdrojů · " + dim.recordsExamined + " záznamů";
              },
            },
          },
        },
      },
    });
  })();

  // ---- Figure 2: relationship graph ---------------------------------------
  // The relationship graph has grown into a full investigation workspace and
  // lives in its own module, scripts/dossier/graph.js (loaded after Cytoscape).
  // It reads the same #dossier-data and mounts on #rel-graph.

  // ---- Figure 3: evidence field (p5.js) -----------------------------------
  (function () {
    var container = document.getElementById("evidence-field");
    var caption = document.getElementById("evidence-field-caption");
    if (!container || typeof window.p5 === "undefined") return;

    var verified = (counts.VERIFIED_PRIMARY || 0) + (counts.CORROBORATED || 0);
    if (caption) {
      caption.textContent =
        claims.length + " claims reviewed — " + verified +
        " corroborated or verified, " + (claims.length - verified) +
        " self-reported or unconfirmed.";
    }

    // One mark per claim; colour by status. Marks drift gently unless the
    // reader prefers reduced motion, in which case they are placed once.
    new window.p5(function (p) {
      var marks = [];
      function build(w, h) {
        marks = claims.map(function (c, i) {
          return {
            x: p.random(12, w - 12),
            y: p.random(12, h - 12),
            r: c.status === "VERIFIED_PRIMARY" || c.status === "CORROBORATED" ? 6 : 4,
            c: statusColor(c.status),
            seed: i * 1.7,
          };
        });
      }
      p.setup = function () {
        var w = container.clientWidth, h = container.clientHeight;
        var cnv = p.createCanvas(w, h);
        cnv.parent(container);
        // Deterministic layout: the same claims always land in the same place,
        // so the figure is reproducible across reloads (brief §13).
        p.randomSeed(24278815);
        build(w, h);
        if (reduceMotion) { p.noLoop(); draw0(); }

        // Pause the animation when the figure is off-screen, to spare CPU/GPU.
        if (!reduceMotion && "IntersectionObserver" in window) {
          new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
              if (en.isIntersecting) p.loop(); else p.noLoop();
            });
          }, { threshold: 0.05 }).observe(container);
        }
      };
      p.windowResized = function () {
        p.resizeCanvas(container.clientWidth, container.clientHeight);
        p.randomSeed(24278815);
        build(container.clientWidth, container.clientHeight);
        if (reduceMotion) draw0();
      };
      function draw0() {
        p.clear();
        for (var i = 0; i < marks.length; i++) {
          var m = marks[i];
          p.noStroke(); p.fill(m.c); p.circle(m.x, m.y, m.r * 2);
        }
      }
      p.draw = function () {
        p.clear();
        var t = p.frameCount * 0.01;
        for (var i = 0; i < marks.length; i++) {
          var m = marks[i];
          var dx = Math.sin(t + m.seed) * 3;
          var dy = Math.cos(t * 0.8 + m.seed) * 3;
          p.noStroke(); p.fill(m.c); p.circle(m.x + dx, m.y + dy, m.r * 2);
        }
      };
    });
  })();

  // ---- Evidence inspector ---------------------------------------------------
  // Opens the full chain for a claim (exact passage → artifact hash → source →
  // provider run) or a source (artifacts + retrieval history). Data is fetched
  // lazily from the evidence exports; nothing loads until the reader asks.
  // Everything is rendered through textContent — no HTML from data.
  (function () {
    var root = document.getElementById("evd-inspector");
    var body = document.getElementById("evd-inspector-body");
    var title = document.getElementById("evd-inspector-title");
    var closeBtn = document.getElementById("evd-inspector-close");
    if (!root || !body || !title) return;

    var BASE = "/data/able-cz/evidence/";
    var cache = {};
    var lastFocus = null;
    function fetchJson(path) {
      if (cache[path]) return cache[path];
      cache[path] = fetch(BASE + path).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
      return cache[path];
    }

    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    }
    function kv(dl, k, v) {
      if (v == null || v === "") return;
      var row = el("div", "flex flex-wrap gap-2 py-0.5");
      row.appendChild(el("dt", "w-40 shrink-0 text-white/40", k));
      row.appendChild(el("dd", "text-white/80 break-all", String(v)));
      dl.appendChild(row);
    }
    function heading(text) { return el("h4", "mt-4 mb-1 font-sans text-sm font-bold text-white first:mt-0", text); }

    function open(kind, id) {
      lastFocus = document.activeElement;
      root.hidden = false;
      document.documentElement.style.overflow = "hidden";
      title.textContent = id;
      body.textContent = "Načítám…";
      try { history.replaceState(null, "", "#evd=" + id); } catch (e) { /* noop */ }
      (kind === "claim" ? renderClaim(id) : renderSource(id)).catch(function (e) {
        body.textContent = "Důkazní záznam se nepodařilo načíst (" + e.message + ").";
      });
      closeBtn && closeBtn.focus();
    }
    function close() {
      root.hidden = true;
      document.documentElement.style.overflow = "";
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* noop */ }
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    closeBtn && closeBtn.addEventListener("click", close);
    var backdrop = document.getElementById("evd-inspector-backdrop");
    backdrop && backdrop.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !root.hidden) close();
    });

    function artifactLine(dl, a) {
      if (!a) return;
      kv(dl, "SHA-256", a.sha256);
      kv(dl, "Získáno", a.retrievedAt);
      kv(dl, "URL", a.url);
    }

    function renderClaim(id) {
      return fetchJson("items/" + id + ".json").then(function (item) {
        return fetchJson("artifacts.json").then(function (arts) {
          var bySha = {};
          (arts.artifacts || []).forEach(function (a) { bySha[a.sha256] = a; });
          body.textContent = "";
          var c = item.claim || {};
          body.appendChild(el("p", "text-white/90", c.text || id));
          var inv = item.inventory || {};
          var meta = el("p", "mt-2 text-xs text-white/50",
            (c.status || "") + " · úplnost: " + (inv.category || "?") +
            " · nezávislé rodiny zdrojů: " + (inv.independentFamilies || 0) +
            " · primární zdroje: " + (inv.primarySources || 0));
          body.appendChild(meta);
          if (c.note) body.appendChild(el("p", "mt-2 text-xs italic text-white/50", c.note));

          (item.links || []).forEach(function (l) {
            var box = el("div", "mt-4 rounded border border-white/10 bg-white/[0.02] p-3");
            box.appendChild(el("p", "font-mono text-xs text-[#d4af37]", (l.relation || "") + (l.sourceId ? " · " + l.sourceId : "") + (l.selector ? " · " + l.selector : "")));
            if (l.note) box.appendChild(el("p", "mt-1 text-xs text-white/50", l.note));
            var dl = el("dl", "mt-2 text-xs");
            if (l.span) {
              box.insertBefore(heading("Přesná pasáž — " + l.span.document + ", s. " + l.span.page), dl);
              var q = el("blockquote", "mt-1 border-l-2 border-[#d4af37]/60 pl-3 font-mono text-xs text-white/80", l.span.exactText);
              box.appendChild(q);
              kv(dl, "Sekce / řádek", l.span.section + " · " + l.span.row);
              kv(dl, "PDF SHA-256", l.span.pdfSha256);
              var pdfArt = bySha[l.span.pdfSha256];
              if (pdfArt && pdfArt.download) {
                var aEl = el("a", "text-[#f3e5c0] underline underline-offset-2", "otevřít originál (PDF)");
                aEl.href = pdfArt.download; aEl.rel = "nofollow";
                var p = el("p", "mt-1"); p.appendChild(aEl); box.appendChild(p);
              }
            }
            if (l.webSpan) {
              box.appendChild(heading("Zachycená formulace — " + (l.webSpan.where || "web")));
              box.appendChild(el("blockquote", "mt-1 border-l-2 border-[#d4af37]/60 pl-3 text-xs text-white/80", l.webSpan.quote));
              kv(dl, "Snímek pořízen", l.webSpan.retrievedAt);
              kv(dl, "Snímek SHA-256", l.webSpan.sha256);
              kv(dl, "URL", l.webSpan.url);
            }
            if (l.assertions && l.assertions.length) {
              box.appendChild(heading("Rejstříková tvrzení (" + l.assertions.length + ")"));
              var list = el("ul", "mt-1 space-y-1 text-xs");
              l.assertions.slice(0, 40).forEach(function (a) {
                var who = a.who && a.who.name ? a.who.name + " " : "";
                var what = a.role || a.stake || a.value || "";
                var span = " [" + (a.validFrom || "?") + " → " + (a.validTo || "nyní") + "]";
                var li = el("li", "text-white/70", a.predicate.replace("registry:", "") + ": " + who + what + span);
                li.appendChild(el("span", "block font-mono text-[10px] text-white/30", a.id + " · " + a.artifact.jsonPointer + " · " + a.artifact.sha256.slice(0, 16) + "…"));
                list.appendChild(li);
              });
              if (l.assertions.length > 40) list.appendChild(el("li", "text-white/40", "… a " + (l.assertions.length - 40) + " dalších"));
              box.appendChild(list);
              var first = l.assertions[0];
              var art = first && bySha[first.artifact.sha256];
              if (art && art.download) {
                var aEl2 = el("a", "text-[#f3e5c0] underline underline-offset-2", "otevřít úřední záznam (JSON, ověřitelný otisk)");
                aEl2.href = art.download; aEl2.rel = "nofollow";
                var p2 = el("p", "mt-2"); p2.appendChild(aEl2); box.appendChild(p2);
              }
            }
            if (l.artifactId && !l.assertions && !l.span) {
              var byId = null;
              (arts.artifacts || []).forEach(function (a) { if (a.id === l.artifactId) byId = a; });
              if (byId) {
                box.appendChild(heading("Artefakt " + byId.id));
                artifactLine(dl, { sha256: byId.sha256, retrievedAt: byId.retrievedAt, url: byId.url });
                if (byId.download) {
                  var aEl3 = el("a", "text-[#f3e5c0] underline underline-offset-2", "otevřít zachovaný artefakt");
                  aEl3.href = byId.download; aEl3.rel = "nofollow";
                  var p3 = el("p", "mt-1"); p3.appendChild(aEl3); box.appendChild(p3);
                } else if (byId.downloadNote) {
                  box.appendChild(el("p", "mt-1 text-xs text-white/40", byId.downloadNote));
                }
              }
            }
            if (dl.childNodes.length) box.appendChild(dl);
            body.appendChild(box);
          });
        });
      });
    }

    function renderSource(id) {
      return Promise.all([fetchJson("sources.json"), fetchJson("artifacts.json"), fetchJson("provider-runs.json")]).then(function (rs) {
        var src = (rs[0].sources || []).filter(function (s) { return s.id === id; })[0];
        var arts = (rs[1].artifacts || []).filter(function (a) { return a.sourceId === id; });
        var runs = (rs[2].runs || []).filter(function (r) { return r.sourceId === id; });
        body.textContent = "";
        if (!src) { body.textContent = "Zdroj nenalezen."; return; }
        body.appendChild(el("p", "text-white/90", src.title));
        var dl = el("dl", "mt-2 text-xs");
        kv(dl, "Rodina původu", src.family);
        kv(dl, "Autorita", src.authority);
        kv(dl, "Povaha", src.primary + (src.official ? " · úřední" : ""));
        kv(dl, "Licence / publikace", src.licensing);
        kv(dl, "Dostupnost", src.availability + (src.lastChecked ? " (" + src.lastChecked + ")" : ""));
        kv(dl, "Podporuje tvrzení", (src.claimsSupported || []).join(", "));
        body.appendChild(dl);
        if (arts.length) {
          body.appendChild(heading("Artefakty (" + arts.length + ")"));
          var ul = el("ul", "mt-1 space-y-2 text-xs");
          arts.forEach(function (a) {
            var li = el("li", "rounded border border-white/10 p-2 text-white/70");
            li.appendChild(el("p", "break-all font-mono text-[10px] text-white/40", a.sha256 + " · " + a.bytes + " B · " + (a.mime || "")));
            li.appendChild(el("p", "mt-0.5", (a.entity || a.tag) + " · " + a.retrievedAt));
            if (a.download) {
              var aEl = el("a", "text-[#f3e5c0] underline underline-offset-2", "otevřít");
              aEl.href = a.download; aEl.rel = "nofollow";
              li.appendChild(aEl);
            } else if (a.downloadNote) {
              li.appendChild(el("p", "text-white/40", a.downloadNote));
            }
            ul.appendChild(li);
          });
          body.appendChild(ul);
        }
        if (runs.length) {
          body.appendChild(heading("Historie stahování (" + runs.length + ")"));
          var ul2 = el("ul", "mt-1 space-y-1 font-mono text-[11px] text-white/60");
          runs.forEach(function (r) {
            ul2.appendChild(el("li", null, (r.finishedAt || r.startedAt || "") + " · " + r.outcome + (r.httpStatus ? " · HTTP " + r.httpStatus : "") + (r.sha256 ? " · " + r.sha256.slice(0, 12) + "…" : "")));
          });
          body.appendChild(ul2);
        }
      });
    }

    document.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target.closest("[data-evd-claim],[data-evd-source]") : null;
      if (!t) return;
      var cid = t.getAttribute("data-evd-claim");
      var sid = t.getAttribute("data-evd-source");
      if (cid) { e.preventDefault(); open("claim", cid); }
      else if (sid) { e.preventDefault(); open("source", sid); }
    });

    // Inline citations: turn [CLM-xx]/[SRC-xx] tokens in the prose into
    // evidence buttons, so every marked statement opens its chain in place.
    (function citeify() {
      var prose = document.querySelectorAll("main .prose, main article, main [data-cites]");
      var re = /\[(CLM-\d+|SRC-\d+)\]/g;
      prose.forEach(function (container) {
        var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
        var nodes = [];
        while (walker.nextNode()) if (re.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
        nodes.forEach(function (node) {
          var frag = document.createDocumentFragment();
          var rest = node.nodeValue, m;
          re.lastIndex = 0;
          var last = 0;
          while ((m = re.exec(rest))) {
            frag.appendChild(document.createTextNode(rest.slice(last, m.index)));
            var btn = el("button", "align-super font-mono text-[10px] text-[#d4af37] underline decoration-dotted underline-offset-2 hover:text-[#f3e5c0]", m[1]);
            btn.type = "button";
            btn.setAttribute(m[1].indexOf("CLM-") === 0 ? "data-evd-claim" : "data-evd-source", m[1]);
            btn.setAttribute("aria-label", "Zobrazit důkaz " + m[1]);
            frag.appendChild(btn);
            last = m.index + m[0].length;
          }
          frag.appendChild(document.createTextNode(rest.slice(last)));
          node.parentNode.replaceChild(frag, node);
        });
      });
    })();

    // Deep link: #evd=CLM-44 opens the inspector on load and survives refresh.
    var h = (location.hash || "").match(/^#evd=((CLM|SRC)-[\w-]+)$/);
    if (h) open(h[1].indexOf("CLM-") === 0 ? "claim" : "source", h[1]);
  })();
})();
