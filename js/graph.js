/*
 * Able.cz dossier — relationship graph as an investigation workspace.
 *
 * Turns the single Cytoscape figure into the primary investigation UI: every
 * node is a portal (single-click = neighbourhood + inspector; double-click =
 * expand), every edge is an explanation (why it exists, with what evidence,
 * since when). Modes, layouts, filters, search, a path finder, live analytics,
 * a time machine, a command palette (Ctrl+K), export, and cross-highlighting
 * from the claim/edge tables are all driven from the same #dossier-data.
 *
 * It invents nothing: every node, edge, and explanation is already present in
 * data/dossier/able/dossier.json, each carrying its own sources. The static
 * edge table beside the graph remains the no-JS / assistive-tech fallback.
 *
 * Authored here; copied to static/js/graph.js by `npm run js:build`. Loaded on
 * /dossier/ only, after Cytoscape.
 */
(function () {
  "use strict";

  var dataEl = document.getElementById("dossier-data");
  var host = document.getElementById("rel-graph");
  if (!dataEl || !host || typeof window.cytoscape === "undefined") return;

  var D;
  try { D = JSON.parse(dataEl.textContent); } catch (e) { return; }
  if (!D.graph || !D.graph.nodes) return;

  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- palette / vocab -----------------------------------------------------
  var CHAMPAGNE = "#f3e5c0", GOLD = "#d4af37", MUTED = "#6b7280", INK = "#0a0a0a";
  var GROUP_COLOR = {
    subject: CHAMPAGNE, person: "#e5e7eb", entity: GOLD, company: GOLD,
    investor: "#c8a24a", client: "#9ca3af", domain: "#9ec5c0", legal: "#c58a8a",
    claim: "#8a8f98", source: "#7d8590",
  };
  var GROUP_SHAPE = {
    subject: "round-rectangle", entity: "round-rectangle", company: "round-rectangle",
    investor: "diamond", person: "ellipse", client: "ellipse",
    domain: "hexagon", legal: "vee", claim: "tag", source: "diamond",
  };
  function confOf(status) {
    if (status === "VERIFIED_PRIMARY" || status === "CORROBORATED") return "high";
    if (status === "CONTRADICTED") return "disputed";
    return "low";
  }
  var SRC_INDEX = {};
  (D.sources || []).forEach(function (s) { SRC_INDEX[s.id] = s; });
  function provClass(srcId) {
    var s = SRC_INDEX[srcId]; if (!s) return "other";
    var k = (s.kind || "") + " " + (s.tier || "");
    if (/register|registr|official/i.test(k)) return "official";
    if (/company|legal notice|marketing/i.test(k)) return "company";
    if (/media|profile|forbes|crunch/i.test(k)) return "media";
    return "other";
  }
  function yearOf(v) { if (!v) return null; var m = String(v).match(/\d{4}/); return m ? +m[0] : null; }

  // ---- build the full element set (base + claim + source layers) ----------
  var nodeById = {};
  D.graph.nodes.forEach(function (n) { nodeById[n.data.id] = n.data; });

  var elements = { nodes: [], edges: [] };
  D.graph.nodes.forEach(function (n) {
    elements.nodes.push({ data: assign({}, n.data, { kind: "entity" }) });
  });
  D.graph.edges.forEach(function (e) {
    elements.edges.push({ data: assign({}, e.data, { kind: "rel" }) });
  });

  // Claim layer — one node per claim, linked to the subject and to any entity
  // whose record references it.
  (D.claims || []).forEach(function (c) {
    var id = "clm:" + c.id;
    elements.nodes.push({ data: {
      id: id, label: c.id, group: "claim", kind: "claim", status: c.status,
      summary: c.text, sources: c.sources || [], ref: c,
    }});
    elements.edges.push({ data: {
      id: "ce:" + c.id, source: id, target: "able", kind: "claimlink",
      cat: "__claims__", status: c.status, label: "claim",
      why: "Claim " + c.id + " (" + c.status + "): " + c.text, sources: c.sources || [],
    }});
    D.graph.nodes.forEach(function (n) {
      if ((n.data.claims || []).indexOf(c.id) !== -1 && n.data.id !== "able") {
        elements.edges.push({ data: {
          id: "ce:" + c.id + ":" + n.data.id, source: id, target: n.data.id,
          kind: "claimlink", cat: "__claims__", status: c.status, label: "about",
          why: "Claim " + c.id + " concerns " + n.data.label + ".", sources: c.sources || [],
        }});
      }
    });
  });

  // Evidence layer — one node per source, linked to everything that cites it.
  (D.sources || []).forEach(function (s) {
    var id = "src:" + s.id;
    elements.nodes.push({ data: {
      id: id, label: s.id, group: "source", kind: "source", status: "SOURCE",
      summary: s.title, ref: s,
    }});
    var seen = {};
    D.graph.nodes.forEach(function (n) {
      if ((n.data.sources || []).indexOf(s.id) !== -1) {
        elements.edges.push({ data: {
          id: "se:" + s.id + ":" + n.data.id, source: id, target: n.data.id,
          kind: "evlink", cat: "__evidence__", status: "SOURCE", label: "cited by",
          why: s.title + " supports the record for " + n.data.label + ".",
        }});
        seen[n.data.id] = 1;
      }
    });
    (D.claims || []).forEach(function (c) {
      if ((c.sources || []).indexOf(s.id) !== -1) {
        elements.edges.push({ data: {
          id: "se:" + s.id + ":clm:" + c.id, source: id, target: "clm:" + c.id,
          kind: "evlink", cat: "__evidence__", status: "SOURCE", label: "supports",
          why: s.title + " supports claim " + c.id + ".",
        }});
      }
    });
  });

  // ---- DOM: build the workspace chrome around the graph -------------------
  injectStyle();
  var wrap = host.parentNode; // the .js-only container
  wrap.classList.add("gw-root");
  wrap.innerHTML =
    '<div class="gw-bar" role="toolbar" aria-label="Graph controls">' +
      '<div class="gw-grp">' +
        '<label class="gw-lbl">Mode' +
          '<select id="gw-mode" class="gw-sel"></select></label>' +
        '<label class="gw-lbl">Layout' +
          '<select id="gw-layout" class="gw-sel">' +
            '<option value="concentric">Concentric</option>' +
            '<option value="breadthfirst">Hierarchy</option>' +
            '<option value="cose">Force</option>' +
            '<option value="circle">Radial</option>' +
            '<option value="grid">Grid</option>' +
          '</select></label>' +
        '<input id="gw-search" class="gw-search" list="gw-nodes" placeholder="Search entity, claim, source…" aria-label="Search the graph" />' +
        '<datalist id="gw-nodes"></datalist>' +
      '</div>' +
      '<div class="gw-grp gw-expand">' +
        '<span class="gw-tag">Expand</span>' +
        btn("owners", "Owners") + btn("governance", "Governance") + btn("people", "People") +
        btn("clients", "Clients") + btn("technical", "Technical") + btn("legal", "Legal") +
        '<button class="gw-b" data-exp="all">All ▸</button>' +
        '<button class="gw-b" data-collapse="1">Collapse</button>' +
      '</div>' +
      '<div class="gw-grp">' +
        '<span class="gw-tag">Confidence</span>' +
        chip("high", "Verified") + chip("low", "Self-reported") + chip("disputed", "Disputed") +
        '<span class="gw-tag">Source</span>' +
        chip("official", "Official") + chip("company", "Company") + chip("media", "Media") +
      '</div>' +
      '<div class="gw-grp">' +
        '<button class="gw-b" id="gw-path">Path finder</button>' +
        '<button class="gw-b" id="gw-analytics">Analytics</button>' +
        '<button class="gw-b" id="gw-export">Export ▾</button>' +
        '<button class="gw-b" id="gw-reset">Reset</button>' +
        '<span class="gw-kbd" title="Command palette">⌘K</span>' +
      '</div>' +
    '</div>' +
    '<div class="gw-stage">' +
      '<div id="rel-graph" class="gw-canvas" role="img" ' +
        'aria-label="Interactive relationship graph. All edges are also listed in the table below."></div>' +
      '<aside id="gw-inspector" class="gw-inspector" aria-live="polite">' +
        '<div class="gw-sheethead"><span class="gw-grab" aria-hidden="true"></span>' +
        '<button class="gw-sheet-close" type="button" aria-label="Close panel">Close ✕</button></div>' +
        '<div id="gw-ibody"></div></aside>' +
    '</div>' +
    '<div class="gw-time">' +
      '<button class="gw-b" id="gw-play" aria-label="Play timeline">▶</button>' +
      '<input id="gw-year" class="gw-range" type="range" min="2012" max="2026" step="1" value="2026" aria-label="Time machine year" />' +
      '<label class="gw-lbl gw-inline"><input type="checkbox" id="gw-alltime" checked /> all time</label>' +
      '<span id="gw-yearlbl" class="gw-yearlbl">All time</span>' +
    '</div>' +
    '<div id="gw-legend" class="gw-legend"></div>';

  host = document.getElementById("rel-graph"); // re-resolve (rebuilt)

  function btn(g, label) { return '<button class="gw-b gw-expbtn" data-exp="' + g + '">' + label + '</button>'; }
  function chip(k, label) { return '<button class="gw-chip is-on" data-filter="' + k + '">' + label + '</button>'; }

  // populate mode select
  var modeSel = document.getElementById("gw-mode");
  var MODES = D.graph.modes || { everything: { label: "Everything", cats: ["*"] } };
  Object.keys(MODES).forEach(function (k) {
    var o = document.createElement("option");
    o.value = k; o.textContent = MODES[k].label; modeSel.appendChild(o);
  });
  modeSel.value = "everything";

  // node search datalist
  var dl = document.getElementById("gw-nodes");
  elements.nodes.forEach(function (n) {
    var o = document.createElement("option"); o.value = n.data.label + "  (" + n.data.id + ")"; dl.appendChild(o);
  });

  // ---- state ---------------------------------------------------------------
  // Default view reveals the structural groups (a rich but non-noisy graph);
  // the self-reported clients and marketing-only people stay behind Expand.
  var DEFAULT_EXPANDED = ["governance", "owners", "technical", "legal"];
  var state = {
    mode: "everything",
    layout: safeLayout(localStorage.getItem("gw-layout")) || "concentric",
    expanded: new Set(DEFAULT_EXPANDED),
    filters: { high: true, low: true, disputed: true, official: true, company: true, media: true },
    year: null,
    pathMode: false, pathA: null, pathB: null,
    sel: null,
  };
  document.getElementById("gw-layout").value = state.layout;

  // ---- cytoscape -----------------------------------------------------------
  var cy = window.cytoscape({
    container: host,
    elements: elements,
    wheelSensitivity: 0.2,
    maxZoom: 1.8,
    minZoom: 0.15,
    style: [
      { selector: "node", style: {
        "background-color": function (n) { return GROUP_COLOR[n.data("group")] || "#fff"; },
        shape: function (n) { return GROUP_SHAPE[n.data("group")] || "ellipse"; },
        label: "data(label)", color: "#f5f5f5", "font-size": 11,
        "font-family": "ui-sans-serif, system-ui, sans-serif",
        "text-valign": "bottom", "text-margin-y": 5, "text-halign": "center",
        "text-wrap": "wrap", "text-max-width": 110,
        // A dark halo keeps labels legible where they cross edges/other labels.
        "text-outline-width": 2.5, "text-outline-color": "#0a0a0a", "text-outline-opacity": 0.95,
        "min-zoomed-font-size": 7,
        width: function (n) { return n.data("id") === "able" ? 40 : (n.data("kind") === "entity" ? 24 : 16); },
        height: function (n) { return n.data("id") === "able" ? 40 : (n.data("kind") === "entity" ? 24 : 16); },
        "border-width": function (n) { return confBorder(n); },
        "border-color": function (n) { return confBorderColor(n); },
      }},
      { selector: 'node[id = "able"]', style: { "font-weight": "bold", "font-size": 13, "text-outline-color": "#111" } },
      { selector: "edge", style: {
        width: function (e) { return e.data("status") === "CONTRADICTED" ? 2.5 : (confOf(e.data("status")) === "high" ? 2 : 1); },
        "line-color": function (e) {
          var s = e.data("status");
          if (s === "CONTRADICTED") return GOLD;
          if (s === "SOURCE") return "rgba(125,133,144,0.35)";
          return confOf(s) === "high" ? "rgba(243,229,192,0.5)" : "rgba(255,255,255,0.16)";
        },
        "line-style": function (e) {
          var s = e.data("status");
          if (e.data("validTo")) return "dotted";
          if (s === "CONTRADICTED") return "solid";
          return confOf(s) === "high" ? "solid" : "dashed";
        },
        "curve-style": "bezier", "target-arrow-shape": "triangle",
        "target-arrow-color": "rgba(255,255,255,0.3)", "arrow-scale": 0.7,
        label: "", "font-size": 8, color: "#9ca3af",
      }},
      { selector: ".gw-hidden", style: { display: "none" } },
      { selector: ".gw-faded", style: { opacity: 0.1 } },
      { selector: ".gw-hi", style: { opacity: 1, "border-width": 3, "border-color": CHAMPAGNE } },
      { selector: "edge.gw-hi", style: { width: 3, "line-color": CHAMPAGNE, opacity: 1 } },
      { selector: ".gw-sel", style: { "border-width": 4, "border-color": GOLD } },
      { selector: ".gw-path", style: { "line-color": GOLD, width: 4, "target-arrow-color": GOLD, opacity: 1 } },
      { selector: ".gw-pathnode", style: { "border-width": 4, "border-color": GOLD, opacity: 1 } },
    ],
    layout: { name: "concentric", animate: false },
    autoungrabify: true,
    boxSelectionEnabled: false,
  });

  function confBorder(n) {
    if (n.data("id") === "able") return 2.5;
    if (n.data("kind") === "source") return 1;
    return 1;
  }
  function confBorderColor(n) {
    var st = n.data("status");
    if (st === "CONTRADICTED") return GOLD;
    if (n.data("id") === "able") return GOLD;
    return "rgba(255,255,255,0.25)";
  }

  // ---- visibility engine ---------------------------------------------------
  function modeCats() { return (MODES[state.mode] || {}).cats || ["*"]; }
  function entityInMode(n, cats) {
    if (cats.indexOf("*") !== -1) return true;
    return n.id() === "able" || (n.data("cats") || []).some(function (c) { return cats.indexOf(c) !== -1; });
  }
  function passExpand(n) {
    if (n.data("kind") !== "entity") return true;
    var g = n.data("expand");
    return g == null || n.data("id") === "able" || state.expanded.has(g);
  }
  function passConf(el) {
    if (el.data("kind") === "source" || el.data("kind") === "evlink") return true;
    // Only records that actually carry a confidence (edges, claims) are filtered.
    // Plain entity nodes have no status and must not be hidden by a confidence
    // toggle — otherwise "hide self-reported" would blank the whole graph.
    var st = el.data("status");
    if (st == null) return true;
    return state.filters[confOf(st)];
  }
  function passProv(el) {
    var srcs = el.data("sources") || (el.data("ref") && [el.data("ref").id]) || [];
    if (!srcs.length) return true;
    var classes = {};
    srcs.forEach(function (s) { classes[provClass(s)] = 1; });
    if (classes.official && state.filters.official) return true;
    if (classes.company && state.filters.company) return true;
    if (classes.media && state.filters.media) return true;
    if (!classes.official && !classes.company && !classes.media) return true;
    return false;
  }
  function passTime(el) {
    if (state.year == null) return true;
    var y = yearOf(el.data("validFrom") || el.data("firstObserved"));
    if (y == null) return true;
    if (y > state.year) return false;
    var to = yearOf(el.data("validTo"));
    if (to != null && to < state.year) return false;
    return true;
  }

  function applyState(relayout) {
    var cats = modeCats();
    var dynC = cats.indexOf("__claims__") !== -1;
    var dynE = cats.indexOf("__evidence__") !== -1;
    var visN = {}, visE = {};

    cy.nodes().forEach(function (n) {
      var k = n.data("kind"), eligible;
      if (dynC) eligible = k === "claim" || n.id() === "able";
      else if (dynE) eligible = k === "source";
      else eligible = k === "entity" && entityInMode(n, cats);
      if (eligible && passExpand(n) && passConf(n) && passProv(n) && passTime(n)) visN[n.id()] = true;
    });

    cy.edges().forEach(function (e) {
      var k = e.data("kind"), ok;
      if (dynC) ok = k === "claimlink";
      else if (dynE) ok = k === "evlink";
      else ok = k === "rel" && (cats.indexOf("*") !== -1 || cats.indexOf(e.data("cat")) !== -1);
      if (!ok || !passConf(e) || !passProv(e) || !passTime(e)) return;
      var s = e.data("source"), t = e.data("target");
      if (dynC || dynE) { visN[s] = true; visN[t] = true; visE[e.id()] = true; }
      else if (visN[s] && visN[t]) visE[e.id()] = true;
    });

    // Count from the sets we just computed. cy.nodes(":visible") lags a render
    // tick behind a class change, so reading it here would be stale.
    state.viewCounts = { n: Object.keys(visN).length, e: Object.keys(visE).length };
    cy.batch(function () {
      cy.nodes().forEach(function (n) { n.toggleClass("gw-hidden", !visN[n.id()]); });
      cy.edges().forEach(function (e) { e.toggleClass("gw-hidden", !visE[e.id()]); });
    });
    if (relayout !== false) runLayout();
    updateLegend();
    syncToolbar();
    // Keep the default inspector's "This view" counts in sync after an expand,
    // collapse, or filter change (which don't otherwise re-render it).
    if (state.sel == null && !state.transientPanel) inspectDefault();
  }

  function runLayout() {
    var vis = cy.elements(":visible");
    if (!vis.length) return;
    // The layout's own fit:true centres the visible set once positions settle;
    // calling cy.fit() here as well would fit to mid-animation positions.
    vis.layout(layoutOpts(state.layout)).run();
  }
  function layoutOpts(name) {
    var base = { animate: !reduceMotion, animationDuration: 350, padding: 40, fit: true };
    if (name === "concentric") return assign(base, {
      name: "concentric",
      concentric: function (n) { return n.data("id") === "able" ? 100 : (n.data("kind") === "entity" ? 10 : 3); },
      levelWidth: function () { return 1; }, minNodeSpacing: 85, spacingFactor: 1,
    });
    if (name === "breadthfirst") return assign(base, { name: "breadthfirst", directed: true, roots: "#able", spacingFactor: 1.4, circle: false });
    if (name === "cose") return assign(base, { name: "cose", idealEdgeLength: 130, nodeRepulsion: 14000, nodeOverlap: 24, gravity: 0.25, componentSpacing: 140, numIter: 1200 });
    if (name === "circle") return assign(base, { name: "circle", spacingFactor: 1.2 });
    if (name === "grid") return assign(base, { name: "grid", spacingFactor: 1.1 });
    return assign(base, { name: name });
  }

  // ---- inspector -----------------------------------------------------------
  var inspector = document.getElementById("gw-ibody");
  var sheet = document.getElementById("gw-inspector");
  function openSheet() { wrap.classList.add("sheet-open"); }
  function closeSheet() { wrap.classList.remove("sheet-open"); }
  sheet.querySelector(".gw-sheet-close").addEventListener("click", closeSheet);
  sheet.querySelector(".gw-sheethead").addEventListener("click", function (e) { if (e.target.classList.contains("gw-grab")) closeSheet(); });
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function badge(status) { return '<span class="gw-badge gw-b-' + confOf(status) + '">' + esc(status) + "</span>"; }
  function srcLinks(ids) {
    return (ids || []).map(function (id) {
      var s = SRC_INDEX[id];
      if (!s) return '<span class="gw-mono">' + esc(id) + "</span>";
      return '<a class="gw-src" href="' + esc(s.url) + '" target="_blank" rel="nofollow noopener">' + esc(id) + " · " + esc(s.title) + "</a>";
    }).join("");
  }
  function section(title, body) { return body ? '<div class="gw-sec"><h4>' + esc(title) + "</h4>" + body + "</div>" : ""; }

  function inspectDefault() {
    state.sel = null; state.transientPanel = false;
    clearHi();
    var counts = { high: 0, low: 0, disputed: 0 };
    cy.edges('[kind = "rel"]').forEach(function (e) { counts[confOf(e.data("status"))]++; });
    inspector.innerHTML =
      '<div class="gw-ihead"><span class="gw-ikind">Workspace</span><h3>Able.cz relationship graph</h3></div>' +
      section("How to read it",
        '<p class="gw-p">Click a node to inspect it and highlight its neighbourhood. Double-click to expand. Click an edge for the evidence behind it. Solid = register-verified or corroborated; dashed = self-reported; gold = a contradiction.</p>') +
      section("This view", '<p class="gw-p gw-mono">' + ((state.viewCounts || {}).n || 0) + " nodes · " + ((state.viewCounts || {}).e || 0) + " edges · mode: " + esc(MODES[state.mode].label) + "</p>") +
      section("Relationship confidence",
        '<ul class="gw-kv"><li><span>Verified / corroborated</span><b>' + counts.high + "</b></li>" +
        "<li><span>Self-reported</span><b>" + counts.low + "</b></li>" +
        "<li><span>Contradicted</span><b>" + counts.disputed + "</b></li></ul>") +
      section("Open questions",
        "<ul class='gw-list'>" + (D.openQuestions || []).map(function (q) { return "<li>" + esc(q) + "</li>"; }).join("") + "</ul>");
  }

  function inspectNode(n) {
    var d = n.data();
    if (d.kind === "source") return inspectSource(n);
    if (d.kind === "claim") return inspectClaim(n);
    var incident = n.connectedEdges('[kind = "rel"]');
    var rels = incident.map(function (e) {
      var other = e.source().id() === n.id() ? e.target() : e.source();
      return '<li><a data-goedge="' + esc(e.id()) + '">' + esc(e.data("label")) + "</a> " +
        badge(e.data("status")) + '<br><span class="gw-dim">' + (e.source().id() === n.id() ? "→ " : "← ") + esc(other.data("label")) + "</span></li>";
    }).join("");
    var claims = (d.claims || []).map(function (cid) {
      var c = (D.claims || []).filter(function (x) { return x.id === cid; })[0];
      return c ? "<li>" + badge(c.status) + " " + esc(c.text) + "</li>" : "";
    }).join("");
    var ident = d.ident ? "<ul class='gw-kv'>" + Object.keys(d.ident).map(function (k) {
      return "<li><span>" + esc(k) + "</span><b class='gw-mono'>" + esc(d.ident[k]) + "</b></li>";
    }).join("") + "</ul>" : "";
    var tl = (D.timeline || []).filter(function (ev) {
      return (ev.event || "").toLowerCase().indexOf((d.label || "").split(" ").pop().toLowerCase()) !== -1 ||
        ((ev.sources || []).some(function (s) { return (d.sources || []).indexOf(s) !== -1; }) && d.id === "able");
    }).map(function (ev) { return "<li><span class='gw-mono'>" + esc(ev.date) + "</span> " + esc(ev.event) + "</li>"; }).join("");
    state.sel = n.id();
    inspector.innerHTML =
      '<div class="gw-ihead"><span class="gw-ikind">' + esc(d.group) + "</span><h3>" + esc(d.label) + "</h3>" +
        (d.validFrom ? '<span class="gw-since">since ' + esc(d.validFrom) + "</span>" : "") + "</div>" +
      section("Overview", d.summary ? '<p class="gw-p">' + esc(d.summary) + "</p>" : "") +
      section("Identifiers", ident) +
      section("Relationships (" + incident.length + ")", rels ? "<ul class='gw-rels'>" + rels + "</ul>" : "") +
      section("Claims", claims ? "<ul class='gw-list'>" + claims + "</ul>" : "") +
      section("Timeline", tl ? "<ul class='gw-list'>" + tl + "</ul>" : "") +
      section("Sources", srcLinks(d.sources) || "") +
      rawJson(d);
    highlightNeighborhood(n);
    wireInspectorLinks();
  }

  function inspectEdge(e) {
    var d = e.data();
    var from = e.source().data("label"), to = e.target().data("label");
    state.sel = e.id();
    var chain =
      '<div class="gw-chain">' +
        '<div class="gw-chain-n">' + esc(from) + "</div>" +
        '<div class="gw-chain-a">▼ ' + esc(d.label) + "</div>" +
        '<div class="gw-chain-n">' + esc(to) + "</div>" +
        (d.sources && d.sources.length ? '<div class="gw-chain-a">▼ evidenced by</div><div class="gw-chain-e">' +
          (d.sources || []).map(function (s) { return esc((SRC_INDEX[s] || {}).tier || s); }).join(", ") + "</div>" : "") +
      "</div>";
    inspector.innerHTML =
      '<div class="gw-ihead"><span class="gw-ikind">relationship</span><h3>' + esc(from) + " → " + esc(to) + "</h3>" + badge(d.status) + "</div>" +
      section("Why this edge exists", '<p class="gw-p">' + esc(d.why || d.label) + "</p>") +
      section("Provenance chain", chain) +
      section("Detail",
        "<ul class='gw-kv'>" +
        "<li><span>Type</span><b>" + esc(d.label) + "</b></li>" +
        "<li><span>Confidence</span><b>" + esc(d.confidence || confOf(d.status)) + "</b></li>" +
        (d.firstObserved ? "<li><span>First observed</span><b class='gw-mono'>" + esc(d.firstObserved) + "</b></li>" : "") +
        (d.lastObserved ? "<li><span>Last observed</span><b class='gw-mono'>" + esc(d.lastObserved) + "</b></li>" : "") +
        "</ul>") +
      section("Sources", srcLinks(d.sources) || "<p class='gw-p gw-dim'>No source id on this edge.</p>") +
      rawJson(d);
    clearHi(); e.addClass("gw-hi"); e.connectedNodes().addClass("gw-hi");
    cy.elements().not(e).not(e.connectedNodes()).addClass("gw-faded");
  }

  function inspectClaim(n) {
    var c = n.data("ref"); state.sel = n.id();
    inspector.innerHTML =
      '<div class="gw-ihead"><span class="gw-ikind">claim</span><h3>' + esc(c.id) + "</h3>" + badge(c.status) + "</div>" +
      section("Statement", '<p class="gw-p">' + esc(c.text) + "</p>") +
      (c.note ? section("Note", '<p class="gw-p gw-dim">' + esc(c.note) + "</p>") : "") +
      section("Sources", srcLinks(c.sources)) + rawJson(c);
    highlightNeighborhood(n);
  }
  function inspectSource(n) {
    var s = n.data("ref"); state.sel = n.id();
    var supports = n.connectedEdges().map(function (e) { return "<li>" + esc(e.target().data("label") || e.source().data("label")) + "</li>"; }).join("");
    inspector.innerHTML =
      '<div class="gw-ihead"><span class="gw-ikind">source · ' + esc(s.tier || "") + '</span><h3>' + esc(s.id) + "</h3></div>" +
      section("Title", '<p class="gw-p">' + esc(s.title) + "</p>") +
      section("Detail", "<ul class='gw-kv'><li><span>Kind</span><b>" + esc(s.kind || "") + "</b></li><li><span>Retrieved</span><b class='gw-mono'>" + esc(s.retrievedAt || "") + "</b></li></ul>") +
      section("Link", '<a class="gw-src" href="' + esc(s.url) + '" target="_blank" rel="nofollow noopener">' + esc(s.url) + "</a>") +
      section("Supports", supports ? "<ul class='gw-list'>" + supports + "</ul>" : "") + rawJson(s);
    highlightNeighborhood(n);
  }
  function rawJson(o) {
    return '<details class="gw-raw"><summary>Raw JSON</summary><pre>' + esc(JSON.stringify(o, function (k, v) { return k === "ref" || k === "_show" ? undefined : v; }, 2)) + "</pre></details>";
  }
  function wireInspectorLinks() {
    inspector.querySelectorAll("[data-goedge]").forEach(function (a) {
      a.addEventListener("click", function () { var e = cy.getElementById(a.getAttribute("data-goedge")); if (e) inspectEdge(e); });
    });
  }

  // ---- highlight -----------------------------------------------------------
  function clearHi() { cy.elements().removeClass("gw-faded gw-hi gw-sel gw-path gw-pathnode"); }
  function highlightNeighborhood(n) {
    clearHi();
    var hood = n.closedNeighborhood();
    cy.elements().not(hood).addClass("gw-faded");
    hood.addClass("gw-hi"); n.addClass("gw-sel");
  }

  // ---- expand / collapse ---------------------------------------------------
  function expand(group) { if (group === "all") { ["owners", "governance", "people", "clients", "technical", "legal"].forEach(function (g) { state.expanded.add(g); }); } else state.expanded.add(group); applyState(); }
  function expandNodeByType(n) {
    var t = n.data("type") || n.data("group");
    var map = { company: ["owners", "governance", "clients", "technical", "legal"], person: ["people", "governance"], domain: ["technical"], court: ["legal"] };
    (map[t] || ["owners", "governance", "people", "clients", "technical", "legal"]).forEach(function (g) { state.expanded.add(g); });
    applyState();
  }

  // ---- path finder ---------------------------------------------------------
  function computePath(a, b) {
    state.transientPanel = true;
    var res = cy.elements(":visible").aStar({ root: cy.getElementById(a), goal: cy.getElementById(b), directed: false });
    clearHi();
    if (!res.found) {
      inspector.innerHTML = '<div class="gw-ihead"><span class="gw-ikind">path</span><h3>No path</h3></div>' +
        section("Result", '<p class="gw-p">No connecting path between these two in the current view. Try Everything mode or expand more.</p>');
      return;
    }
    res.path.addClass("gw-path"); res.path.nodes().addClass("gw-pathnode");
    var steps = "", nodes = res.path.nodes(), edges = res.path.edges();
    nodes.forEach(function (nd, i) {
      steps += '<div class="gw-chain-n">' + esc(nd.data("label")) + "</div>";
      var e = edges[i]; if (e) steps += '<div class="gw-chain-a">▼ ' + esc(e.data("label")) + " " + badge(e.data("status")) + "</div>";
    });
    inspector.innerHTML =
      '<div class="gw-ihead"><span class="gw-ikind">path</span><h3>' + esc(cy.getElementById(a).data("label")) + " ⇢ " + esc(cy.getElementById(b).data("label")) + "</h3></div>" +
      section("Connecting path (" + edges.length + " hops)", '<div class="gw-chain">' + steps + "</div>") +
      section("Reading", '<p class="gw-p gw-dim">Each hop is an evidence-backed relationship; click any edge for its full provenance.</p>');
  }

  // ---- analytics -----------------------------------------------------------
  function analytics() {
    state.transientPanel = true; clearHi();
    var ent = cy.nodes('[kind = "entity"]');
    var deg = ent.map(function (n) { return { l: n.data("label"), d: n.connectedEdges('[kind = "rel"]').length, id: n.id() }; })
      .sort(function (a, b) { return b.d - a.d; }).slice(0, 6);
    var comps = cy.elements(':visible').components().length;
    var selfRep = cy.edges('[kind = "rel"]').filter(function (e) { return e.data("status") === "SELF_REPORTED"; });
    var contra = cy.edges('[status = "CONTRADICTED"]');
    var noSrc = ent.filter(function (n) { return !(n.data("sources") || []).length; });
    inspector.innerHTML =
      '<div class="gw-ihead"><span class="gw-ikind">analytics</span><h3>Graph analytics</h3></div>' +
      section("Most connected entities", "<ul class='gw-kv'>" + deg.map(function (x) { return "<li><span>" + esc(x.l) + "</span><b>" + x.d + "</b></li>"; }).join("") + "</ul>") +
      section("Structure", "<ul class='gw-kv'><li><span>Visible clusters</span><b>" + comps + "</b></li><li><span>Self-reported edges</span><b>" + selfRep.length + "</b></li><li><span>Contradictions</span><b>" + contra.length + "</b></li></ul>") +
      section("Contradictions", contra.length ? "<ul class='gw-list'>" + contra.map(function (e) { return "<li>" + esc(e.source().data("label")) + " → " + esc(e.target().data("label")) + " — " + esc(e.data("label")) + "</li>"; }).join("") + "</ul>" : "<p class='gw-p gw-dim'>None in view.</p>") +
      section("Entities without a source id", noSrc.length ? "<ul class='gw-list'>" + noSrc.map(function (n) { return "<li>" + esc(n.data("label")) + "</li>"; }).join("") + "</ul>" : "<p class='gw-p gw-dim'>None — every entity carries provenance.</p>");
    // gently flag weak-evidence edges
    selfRep.addClass("gw-hi");
  }

  // ---- export --------------------------------------------------------------
  function download(name, mime, content) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }
  function visibleJson() {
    return {
      nodes: cy.nodes(":visible").map(function (n) { return { data: stripData(n.data()) }; }),
      edges: cy.edges(":visible").map(function (e) { return { data: stripData(e.data()) }; }),
    };
  }
  function stripData(d) { var o = assign({}, d); delete o.ref; delete o._show; return o; }
  function toGraphML() {
    var g = visibleJson();
    var s = '<?xml version="1.0" encoding="UTF-8"?>\n<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n' +
      '<key id="label" for="node" attr.name="label" attr.type="string"/>\n' +
      '<key id="status" for="edge" attr.name="status" attr.type="string"/>\n<graph edgedefault="directed">\n';
    g.nodes.forEach(function (n) { s += '  <node id="' + esc(n.data.id) + '"><data key="label">' + esc(n.data.label) + "</data></node>\n"; });
    g.edges.forEach(function (e) { s += '  <edge source="' + esc(e.data.source) + '" target="' + esc(e.data.target) + '"><data key="status">' + esc(e.data.status || "") + "</data></edge>\n"; });
    return s + "</graph>\n</graphml>\n";
  }
  function exportMenu() {
    state.transientPanel = true;
    var picks = ["PNG", "SVG-fallback→PNG", "JSON (view)", "GraphML", "CyJS (full)"];
    // simple inline chooser in the inspector
    inspector.innerHTML = '<div class="gw-ihead"><span class="gw-ikind">export</span><h3>Export current view</h3></div>' +
      '<div class="gw-sec"><div class="gw-expchoices">' +
      '<button class="gw-b" data-x="png">PNG</button>' +
      '<button class="gw-b" data-x="json">JSON (view)</button>' +
      '<button class="gw-b" data-x="graphml">GraphML</button>' +
      '<button class="gw-b" data-x="cyjs">CyJS (full)</button>' +
      "</div><p class='gw-p gw-dim'>PNG captures the current canvas; JSON/GraphML export the visible sub-graph; CyJS exports the full Cytoscape state.</p></div>";
    inspector.querySelectorAll("[data-x]").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-x");
        if (k === "png") download("able-graph.png", "image/png", dataURItoBlob(cy.png({ full: true, scale: 2, bg: INK })));
        else if (k === "json") download("able-graph.json", "application/json", JSON.stringify(visibleJson(), null, 2));
        else if (k === "graphml") download("able-graph.graphml", "application/xml", toGraphML());
        else if (k === "cyjs") download("able-graph.cyjs.json", "application/json", JSON.stringify(cy.json(), null, 2));
      });
    });
  }
  function dataURItoBlob(uri) {
    var b = atob(uri.split(",")[1]), mime = uri.split(",")[0].split(":")[1].split(";")[0];
    var arr = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) arr[i] = b.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  // ---- legend --------------------------------------------------------------
  function updateLegend() {
    var groups = {};
    cy.nodes(":visible").forEach(function (n) { groups[n.data("group")] = 1; });
    var items = Object.keys(groups).map(function (g) {
      return '<span class="gw-leg"><i style="background:' + (GROUP_COLOR[g] || "#fff") + '"></i>' + esc(g) + "</span>";
    }).join("");
    document.getElementById("gw-legend").innerHTML = items +
      '<span class="gw-leg"><i class="gw-line-solid"></i>verified</span>' +
      '<span class="gw-leg"><i class="gw-line-dash"></i>self-reported</span>' +
      '<span class="gw-leg"><i class="gw-line-gold"></i>contradicted</span>' +
      '<span class="gw-legnote">position is layout, not importance</span>';
  }
  function syncToolbar() {
    document.querySelectorAll(".gw-expbtn").forEach(function (b) { b.classList.toggle("is-on", state.expanded.has(b.getAttribute("data-exp"))); });
    document.querySelectorAll("[data-filter]").forEach(function (b) { b.classList.toggle("is-on", state.filters[b.getAttribute("data-filter")]); });
    document.getElementById("gw-path").classList.toggle("is-on", state.pathMode);
  }

  // ---- events --------------------------------------------------------------
  cy.on("tap", "node", function (evt) {
    var n = evt.target;
    if (state.pathMode) {
      if (!state.pathA) { state.pathA = n.id(); clearHi(); n.addClass("gw-pathnode"); toast("Path: pick the second node"); }
      else { state.pathB = n.id(); computePath(state.pathA, state.pathB); state.pathA = state.pathB = null; state.pathMode = false; syncToolbar(); }
      return;
    }
    inspectNode(n); openSheet();
  });
  cy.on("tap", "edge", function (evt) { if (!state.pathMode) { inspectEdge(evt.target); openSheet(); } });
  cy.on("dbltap", "node", function (evt) { expandNodeByType(evt.target); toast("Expanded " + evt.target.data("label")); });
  cy.on("tap", function (evt) { if (evt.target === cy) { inspectDefault(); closeSheet(); } });

  modeSel.addEventListener("change", function () { state.mode = modeSel.value; applyState(); inspectDefault(); });
  document.getElementById("gw-layout").addEventListener("change", function (e) { state.layout = e.target.value; localStorage.setItem("gw-layout", state.layout); runLayout(); });
  document.querySelector(".gw-bar").addEventListener("click", function (e) {
    var t = e.target.closest("button"); if (!t) return;
    if (t.hasAttribute("data-exp")) expand(t.getAttribute("data-exp"));
    else if (t.hasAttribute("data-collapse")) { state.expanded.clear(); applyState(); }
    else if (t.hasAttribute("data-filter")) { var k = t.getAttribute("data-filter"); state.filters[k] = !state.filters[k]; applyState(false); }
    else if (t.id === "gw-reset") resetAll();
    else if (t.id === "gw-analytics") { analytics(); openSheet(); }
    else if (t.id === "gw-export") { exportMenu(); openSheet(); }
    else if (t.id === "gw-path") { state.pathMode = !state.pathMode; syncToolbar(); if (state.pathMode) toast("Path: pick the first node"); }
  });
  var searchEl = document.getElementById("gw-search");
  searchEl.addEventListener("change", function () {
    var m = searchEl.value.match(/\(([^)]+)\)\s*$/); var id = m ? m[1] : null;
    var n = id ? cy.getElementById(id) : cy.nodes().filter(function (x) { return x.data("label").toLowerCase() === searchEl.value.toLowerCase(); })[0];
    if (n && n.length !== 0) { if (n.hasClass("gw-hidden")) { state.mode = "everything"; modeSel.value = "everything"; state.expanded.add(n.data("expand")); applyState(); } cy.animate({ center: { eles: n }, zoom: 1.4 }, { duration: reduceMotion ? 0 : 300 }); inspectNode(n); openSheet(); }
  });

  // time machine
  var yearEl = document.getElementById("gw-year"), allTime = document.getElementById("gw-alltime"), yearLbl = document.getElementById("gw-yearlbl");
  function setYear() {
    if (allTime.checked) { state.year = null; yearLbl.textContent = "All time"; }
    else { state.year = +yearEl.value; var evs = (D.timeline || []).filter(function (ev) { return yearOf(ev.date) === state.year; }); yearLbl.textContent = state.year + (evs.length ? " · " + evs[0].event.slice(0, 40) + "…" : ""); }
    applyState(false);
  }
  yearEl.addEventListener("input", function () { allTime.checked = false; setYear(); });
  allTime.addEventListener("change", setYear);
  var playing = null, playBtn = document.getElementById("gw-play");
  function stopPlay() { if (playing) { clearInterval(playing); playing = null; } playBtn.textContent = "▶"; }
  playBtn.addEventListener("click", function () {
    if (playing) { stopPlay(); return; }
    allTime.checked = false; yearEl.value = 2012; playBtn.textContent = "⏸";
    playing = setInterval(function () {
      if (+yearEl.value >= 2026) { stopPlay(); allTime.checked = true; setYear(); return; }
      yearEl.value = +yearEl.value + 1; setYear();
    }, reduceMotion ? 1 : 1100);
    setYear();
  });

  // command palette (Ctrl/Cmd+K)
  var palette = buildPalette();
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette.toggle(); }
    else if (e.key === "Escape") palette.hide();
  });

  function resetAll() {
    stopPlay();
    state.mode = "everything"; modeSel.value = "everything";
    state.expanded = new Set(DEFAULT_EXPANDED);
    Object.keys(state.filters).forEach(function (k) { state.filters[k] = true; });
    state.pathMode = false; state.pathA = state.pathB = null;
    allTime.checked = true; yearEl.value = 2026; state.year = null; yearLbl.textContent = "All time";
    applyState(); inspectDefault(); closeSheet();
  }

  // cross-highlight: click a row in the sibling edge table / claim table
  wireTableCrosslinks();

  // ---- go ------------------------------------------------------------------
  // Start with a curated core: the subject and its verified backbone; the rest
  // is behind the Expand buttons (lazy reveal).
  applyState();
  inspectDefault();
  window.addEventListener("resize", function () { cy.resize(); runLayout(); });

  // ==== helpers =============================================================
  function assign(t) { for (var i = 1; i < arguments.length; i++) { var s = arguments[i]; if (s) for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k]; } return t; }
  function safeLayout(v) { return ["concentric", "breadthfirst", "cose", "circle", "grid"].indexOf(v) !== -1 ? v : null; }

  var toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "gw-toast"; document.querySelector(".gw-root").appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("is-on");
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove("is-on"); }, 2200);
  }

  function wireTableCrosslinks() {
    var sec = document.getElementById("fig-graph-title");
    if (!sec) return;
    var scope = sec.closest("section");
    if (!scope) return;
    scope.querySelectorAll("tbody tr").forEach(function (tr) {
      tr.style.cursor = "pointer";
      tr.addEventListener("click", function () {
        var cells = tr.querySelectorAll("td");
        if (cells.length < 3) return;
        var from = cells[0].textContent.trim(), to = cells[2].textContent.trim();
        var fn = cy.nodes().filter(function (n) { return n.data("label") === from; })[0];
        var tn = cy.nodes().filter(function (n) { return n.data("label") === to; })[0];
        if (fn && tn) { var e = fn.edgesTo(tn); if (e.length === 0) e = tn.edgesTo(fn); if (e.length) { if (e.hasClass("gw-hidden")) { resetAll(); } inspectEdge(e[0]); scrollToGraph(); } }
      });
    });
  }
  function scrollToGraph() { document.querySelector(".gw-stage").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" }); }

  function buildPalette() {
    var overlay = document.createElement("div");
    overlay.className = "gw-palette"; overlay.setAttribute("role", "dialog");
    overlay.innerHTML = '<div class="gw-pbox"><input class="gw-pin" placeholder="Type a command… (modes, expand, layout, analytics, export, reset)" /><ul class="gw-plist"></ul></div>';
    document.querySelector(".gw-root").appendChild(overlay);
    var input = overlay.querySelector(".gw-pin"), list = overlay.querySelector(".gw-plist");
    var cmds = [];
    Object.keys(MODES).forEach(function (k) { cmds.push({ t: "Mode: " + MODES[k].label, run: function () { state.mode = k; modeSel.value = k; applyState(); inspectDefault(); } }); });
    ["concentric", "breadthfirst", "cose", "circle", "grid"].forEach(function (l) { cmds.push({ t: "Layout: " + l, run: function () { state.layout = l; document.getElementById("gw-layout").value = l; localStorage.setItem("gw-layout", l); runLayout(); } }); });
    ["owners", "governance", "people", "clients", "technical", "legal", "all"].forEach(function (g) { cmds.push({ t: "Expand: " + g, run: function () { expand(g); } }); });
    cmds.push({ t: "Collapse all", run: function () { state.expanded.clear(); applyState(); } });
    cmds.push({ t: "Analytics", run: analytics });
    cmds.push({ t: "Path finder", run: function () { state.pathMode = true; syncToolbar(); toast("Path: pick the first node"); } });
    cmds.push({ t: "Export view", run: exportMenu });
    cmds.push({ t: "Center graph", run: function () { cy.fit(cy.elements(":visible"), 30); } });
    cmds.push({ t: "Reset workspace", run: resetAll });
    (D.graph.nodes || []).forEach(function (n) { cmds.push({ t: "Find: " + n.data.label, run: function () { var nn = cy.getElementById(n.data.id); if (nn.hasClass("gw-hidden")) { state.expanded.add(n.data.expand); applyState(); } cy.animate({ center: { eles: nn }, zoom: 1.4 }, { duration: reduceMotion ? 0 : 300 }); inspectNode(nn); } }); });
    var sel = 0;
    function render() {
      var q = input.value.toLowerCase();
      var f = cmds.filter(function (c) { return c.t.toLowerCase().indexOf(q) !== -1; }).slice(0, 8);
      list.innerHTML = f.map(function (c, i) { return '<li class="' + (i === sel ? "is-sel" : "") + '">' + esc(c.t) + "</li>"; }).join("");
      list._f = f;
    }
    input.addEventListener("input", function () { sel = 0; render(); });
    input.addEventListener("keydown", function (e) {
      var f = list._f || [];
      if (e.key === "ArrowDown") { sel = Math.min(sel + 1, f.length - 1); render(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); render(); e.preventDefault(); }
      else if (e.key === "Enter") { if (f[sel]) { f[sel].run(); hide(); } }
    });
    list.addEventListener("click", function (e) { var li = e.target.closest("li"); if (!li) return; var i = Array.prototype.indexOf.call(list.children, li); if (list._f[i]) { list._f[i].run(); hide(); } });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) hide(); });
    function show() { overlay.classList.add("is-on"); input.value = ""; sel = 0; render(); input.focus(); }
    function hide() { overlay.classList.remove("is-on"); }
    return { toggle: function () { overlay.classList.contains("is-on") ? hide() : show(); }, hide: hide };
  }

  function injectStyle() {
    if (document.getElementById("gw-style")) return;
    var css =
      // ---- mobile-first base ------------------------------------------------
      ".gw-root{position:relative;margin-top:1.25rem;--gw-w:100%}" +
      ".gw-bar{display:flex;flex-wrap:wrap;gap:.5rem .9rem;align-items:center;padding:.6rem;border:1px solid rgba(255,255,255,.1);border-bottom:0;border-radius:.6rem .6rem 0 0;background:rgba(255,255,255,.03)}" +
      ".gw-grp{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center}" +
      ".gw-lbl{display:flex;flex-direction:column;gap:.15rem;font-size:.6rem;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.4)}" +
      ".gw-lbl.gw-inline{flex-direction:row;align-items:center;gap:.4rem;text-transform:none;letter-spacing:0;font-size:.75rem}" +
      ".gw-sel,.gw-search{background:#121212;color:#e5e7eb;border:1px solid rgba(255,255,255,.16);border-radius:.5rem;padding:.45rem .55rem;font-size:.82rem;min-height:38px}" +
      ".gw-search{flex:1 1 190px;min-width:160px}" +
      ".gw-tag{font-size:.6rem;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.4);width:100%}" +
      "@media(min-width:640px){.gw-tag{width:auto;margin-right:.1rem}}" +
      ".gw-b{background:#171717;color:#d1d5db;border:1px solid rgba(255,255,255,.15);border-radius:.5rem;padding:.42rem .7rem;font-size:.78rem;min-height:36px;cursor:pointer;transition:all .12s}" +
      ".gw-b:hover{border-color:" + GOLD + ";color:#fff}" +
      ".gw-b.is-on,.gw-chip.is-on{border-color:" + GOLD + ";color:" + INK + ";background:" + CHAMPAGNE + ";font-weight:600}" +
      ".gw-chip{background:#171717;color:#9ca3af;border:1px solid rgba(255,255,255,.15);border-radius:1rem;padding:.32rem .7rem;font-size:.74rem;min-height:34px;cursor:pointer}" +
      ".gw-b:focus-visible,.gw-sel:focus-visible,.gw-search:focus-visible,.gw-chip:focus-visible{outline:2px solid " + GOLD + ";outline-offset:1px}" +
      ".gw-kbd{display:none;font-size:.66rem;color:rgba(255,255,255,.4);border:1px solid rgba(255,255,255,.15);border-radius:.3rem;padding:.2rem .4rem}" +
      "@media(min-width:1024px){.gw-kbd{display:inline-block}}" +
      ".gw-stage{position:relative;display:block;border:1px solid rgba(255,255,255,.1);overflow:hidden}" +
      ".gw-canvas{width:100%;height:56vh;min-height:320px;background:rgba(255,255,255,.015);touch-action:none}" +
      // inspector = bottom sheet on mobile
      ".gw-inspector{position:fixed;left:0;right:0;bottom:0;z-index:55;max-height:82vh;overflow-y:auto;background:#0c0c0c;border-top:1px solid rgba(255,255,255,.14);border-radius:1rem 1rem 0 0;box-shadow:0 -14px 44px rgba(0,0,0,.6);transform:translateY(101%);transition:transform .28s ease;padding:0 1rem 1.3rem;font-size:.82rem;color:#cbd5e1;-webkit-overflow-scrolling:touch}" +
      ".gw-root.sheet-open .gw-inspector{transform:none}" +
      ".gw-sheethead{position:sticky;top:0;background:#0c0c0c;padding:.6rem 0 .5rem;display:grid;grid-template-columns:1fr auto;align-items:center;gap:.5rem;z-index:2}" +
      ".gw-grab{grid-column:1/3;width:44px;height:4px;border-radius:2px;background:rgba(255,255,255,.28);margin:0 auto .2rem;cursor:pointer}" +
      ".gw-sheet-close{grid-column:2;justify-self:end;background:#1c1c1c;color:#e5e7eb;border:1px solid rgba(255,255,255,.16);border-radius:.5rem;padding:.4rem .7rem;font-size:.78rem;min-height:36px}" +
      ".gw-ihead{border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:.5rem;margin-bottom:.6rem}" +
      ".gw-ikind{font-size:.58rem;text-transform:uppercase;letter-spacing:.08em;color:" + GOLD + "}" +
      ".gw-ihead h3{font-size:1.02rem;font-weight:800;color:#fff;margin:.15rem 0;line-height:1.15}" +
      ".gw-since{font-size:.65rem;color:rgba(255,255,255,.4)}" +
      ".gw-sec{margin-bottom:.8rem}" +
      ".gw-sec h4{font-size:.62rem;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.45);margin:0 0 .3rem}" +
      ".gw-p{font-size:.82rem;line-height:1.5;color:#cbd5e1;margin:0}" +
      ".gw-dim{color:rgba(255,255,255,.45)}.gw-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.74rem}" +
      ".gw-kv{list-style:none;margin:0;padding:0}.gw-kv li{display:flex;justify-content:space-between;gap:.6rem;padding:.25rem 0;border-bottom:1px solid rgba(255,255,255,.06)}" +
      ".gw-kv li span{color:rgba(255,255,255,.5)}.gw-kv li b{color:#e5e7eb;text-align:right}" +
      ".gw-list{margin:0;padding-left:1rem;font-size:.8rem;line-height:1.45}.gw-list li{margin-bottom:.3rem}" +
      ".gw-rels{list-style:none;margin:0;padding:0}.gw-rels li{padding:.4rem 0;border-bottom:1px solid rgba(255,255,255,.06)}" +
      ".gw-rels a{color:" + CHAMPAGNE + ";cursor:pointer;text-decoration:underline;text-underline-offset:2px}" +
      ".gw-badge{display:inline-block;font-size:.58rem;padding:.08rem .34rem;border-radius:.25rem;letter-spacing:.03em;vertical-align:middle}" +
      ".gw-b-high{background:rgba(243,229,192,.18);color:" + CHAMPAGNE + "}.gw-b-low{background:rgba(255,255,255,.08);color:#9ca3af}.gw-b-disputed{background:rgba(212,175,55,.2);color:" + GOLD + "}" +
      ".gw-src{color:#9ec5c0;font-size:.75rem;display:block;margin-bottom:.3rem;word-break:break-word;text-decoration:underline;text-underline-offset:2px}" +
      ".gw-chain{display:flex;flex-direction:column;gap:.2rem}.gw-chain-n{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:.3rem;padding:.3rem .45rem;font-weight:600;font-size:.8rem}" +
      ".gw-chain-a{font-size:.7rem;color:" + GOLD + ";padding-left:.4rem}.gw-chain-e{font-size:.72rem;color:#9ec5c0;padding:.2rem .45rem}" +
      ".gw-raw{margin-top:.5rem}.gw-raw summary{font-size:.68rem;color:rgba(255,255,255,.4);cursor:pointer}.gw-raw pre{font-size:.64rem;line-height:1.35;overflow-x:auto;background:#0a0a0a;border:1px solid rgba(255,255,255,.08);border-radius:.3rem;padding:.5rem;color:#9ca3af;max-height:240px}" +
      ".gw-expchoices{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.5rem}" +
      ".gw-time{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;padding:.55rem .7rem;border:1px solid rgba(255,255,255,.1);border-top:0;background:rgba(255,255,255,.03)}" +
      ".gw-range{flex:1 1 140px;accent-color:" + GOLD + ";min-height:24px}" +
      ".gw-yearlbl{font-size:.74rem;color:#cbd5e1;min-width:90px;font-family:ui-monospace,monospace}" +
      ".gw-legend{display:flex;flex-wrap:wrap;gap:.5rem .9rem;padding:.55rem .2rem;font-size:.66rem;color:rgba(255,255,255,.55);align-items:center}" +
      ".gw-leg{display:inline-flex;align-items:center;gap:.3rem}.gw-leg i{width:10px;height:10px;border-radius:2px;display:inline-block}" +
      ".gw-line-solid{width:16px!important;height:0!important;border-top:2px solid " + CHAMPAGNE + "}.gw-line-dash{width:16px!important;height:0!important;border-top:2px dashed #9ca3af}.gw-line-gold{width:16px!important;height:0!important;border-top:2px solid " + GOLD + "}" +
      ".gw-legnote{width:100%;font-style:italic;color:rgba(255,255,255,.35)}" +
      "@media(min-width:640px){.gw-legnote{width:auto;margin-left:auto}}" +
      ".gw-toast{position:absolute;bottom:14px;left:50%;transform:translateX(-50%) translateY(10px);background:" + GOLD + ";color:" + INK + ";font-size:.74rem;font-weight:600;padding:.4rem .8rem;border-radius:.4rem;opacity:0;pointer-events:none;transition:all .2s;z-index:56}.gw-toast.is-on{opacity:1;transform:translateX(-50%) translateY(0)}" +
      ".gw-palette{position:fixed;inset:0;background:rgba(0,0,0,.65);display:none;z-index:70;align-items:flex-start;justify-content:center}.gw-palette.is-on{display:flex}" +
      ".gw-pbox{margin-top:10vh;width:min(560px,94vw);background:#111;border:1px solid rgba(255,255,255,.15);border-radius:.6rem;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6)}" +
      ".gw-pin{width:100%;box-sizing:border-box;background:#111;border:0;border-bottom:1px solid rgba(255,255,255,.12);color:#fff;padding:.9rem 1rem;font-size:.95rem}" +
      ".gw-plist{list-style:none;margin:0;padding:.3rem;max-height:60vh;overflow-y:auto}.gw-plist li{padding:.6rem .7rem;border-radius:.4rem;font-size:.86rem;color:#cbd5e1;cursor:pointer}.gw-plist li.is-sel{background:" + CHAMPAGNE + ";color:" + INK + "}" +
      // ---- desktop (>=769px): side-by-side, static inspector ---------------
      "@media(min-width:769px){" +
        ".gw-stage{display:flex;border-radius:0}" +
        ".gw-canvas{flex:1 1 auto;min-width:0;height:660px}" +
        ".gw-inspector{position:static;transform:none;flex:0 0 380px;max-width:380px;width:380px;height:660px;max-height:none;z-index:auto;border-top:0;border-left:1px solid rgba(255,255,255,.1);border-radius:0;box-shadow:none;padding:1rem}" +
        ".gw-sheethead{display:none}" +
      "}" +
      // ---- wide (>=1024px): break out of the narrow article column ---------
      "@media(min-width:1024px){" +
        ".gw-root{--gw-w:min(1440px,calc(100vw - 3rem));width:var(--gw-w);margin-left:calc((100% - var(--gw-w)) / 2)}" +
        ".gw-canvas{height:70vh;min-height:560px}" +
        ".gw-inspector{flex-basis:420px;max-width:420px;width:420px;height:70vh;min-height:560px}" +
      "}" +
      "@media(prefers-reduced-motion:reduce){.gw-inspector{transition:none}}";
    var st = document.createElement("style"); st.id = "gw-style"; st.textContent = css; document.head.appendChild(st);
  }
})();
