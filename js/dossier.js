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
  var claims = data.claims || [];
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
})();
