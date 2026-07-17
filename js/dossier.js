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

  // ---- Figure 2: relationship graph (Cytoscape.js) ------------------------
  (function () {
    var container = document.getElementById("rel-graph");
    if (!container || typeof window.cytoscape === "undefined") return;
    if (!data.graph || !data.graph.nodes) return;

    var groupShape = {
      subject: "round-rectangle",
      person: "ellipse",
      entity: "round-rectangle",
      client: "ellipse",
      source: "diamond",
    };
    var groupColor = {
      subject: CHAMPAGNE,
      person: "#e5e7eb",
      entity: GOLD,
      client: "#9ca3af",
      source: "#6b7280",
    };

    var cy = window.cytoscape({
      container: container,
      elements: { nodes: data.graph.nodes, edges: data.graph.edges },
      style: [
        {
          selector: "node",
          style: {
            "background-color": function (n) { return groupColor[n.data("group")] || "#fff"; },
            shape: function (n) { return groupShape[n.data("group")] || "ellipse"; },
            label: "data(label)",
            color: "#e5e7eb",
            "font-size": 11,
            "font-family": "ui-sans-serif, system-ui, sans-serif",
            "text-valign": "bottom",
            "text-margin-y": 4,
            "text-halign": "center",
            width: function (n) { return n.data("group") === "subject" ? 26 : 16; },
            height: function (n) { return n.data("group") === "subject" ? 26 : 16; },
          },
        },
        {
          selector: "edge",
          style: {
            width: function (e) {
              var s = e.data("status");
              return s === "VERIFIED_PRIMARY" || s === "CORROBORATED" ? 2 : 1;
            },
            "line-color": function (e) {
              var s = e.data("status");
              return s === "VERIFIED_PRIMARY" || s === "CORROBORATED"
                ? "rgba(243,229,192,0.55)"
                : "rgba(255,255,255,0.18)";
            },
            "line-style": function (e) {
              var s = e.data("status");
              return s === "VERIFIED_PRIMARY" || s === "CORROBORATED" ? "solid" : "dashed";
            },
            "target-arrow-color": "rgba(255,255,255,0.35)",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.8,
            "curve-style": "bezier",
          },
        },
      ],
      layout: {
        name: "concentric",
        concentric: function (n) { return n.data("group") === "subject" ? 10 : 1; },
        levelWidth: function () { return 1; },
        minNodeSpacing: 42,
        padding: 28,
        animate: false,
      },
      autoungrabify: true,
      userZoomingEnabled: false,
      userPanningEnabled: false,
      boxSelectionEnabled: false,
    });
    cy.fit(undefined, 28);
    window.addEventListener("resize", function () { cy.fit(undefined, 28); });
  })();

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
