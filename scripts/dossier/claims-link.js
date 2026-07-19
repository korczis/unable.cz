/*
 * Able.cz dossier — narrative claim auto-linking.
 *
 * Converts every `CLM-\d+` mention in the dossier's NARRATIVE prose into a real
 * <a href> pointing at that claim's canonical static route
 * (/dossier/claims/clm-nn/). These are genuine anchors: ordinary click
 * navigates, middle-click / Cmd-click open a new tab, the address can be copied,
 * the browser context menu works, and keyboard focus/Enter works. JavaScript
 * only *upgrades* the text; the claim pages themselves are fully static.
 *
 * Scope is deliberately limited to `main article` (the rendered Markdown prose),
 * which cockpit.js does not touch — cockpit handles monospace table/code cells.
 * So the two enhancers never fight over the same nodes.
 *
 * Base path comes from window.__CLAIMS_BASE__ (set by the template via get_url),
 * so it is correct under any GitHub Pages base path. Only IDs present in the
 * embedded #dossier-data are linked — an unknown CLM is left as plain text.
 *
 * Authored here; copied to static/js/claims-link.js by `npm run js:build`.
 */
(function () {
  "use strict";
  var base = window.__CLAIMS_BASE__;
  if (!base) return;
  if (base.charAt(base.length - 1) !== "/") base += "/";

  // Valid claim ids from the embedded canonical data — never link an unknown id.
  var valid = {};
  var dataEl = document.getElementById("dossier-data");
  if (dataEl) {
    try { (JSON.parse(dataEl.textContent).claims || []).forEach(function (c) { valid[c.id] = 1; }); } catch (e) { /* leave empty → nothing linked */ }
  }
  if (!Object.keys(valid).length) return;

  var scope = document.querySelector("main article");
  if (!scope) return;

  var RE = /\bCLM-\d+\b/g;
  // Collect candidate text nodes first (don't mutate while walking).
  var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
    acceptNode: function (n) {
      if (!n.nodeValue || n.nodeValue.indexOf("CLM-") === -1) return NodeFilter.FILTER_REJECT;
      // skip inside existing links / code / the graph
      var p = n.parentNode;
      while (p && p !== scope) {
        var tag = p.nodeName;
        if (tag === "A" || tag === "CODE" || tag === "PRE" || tag === "BUTTON") return NodeFilter.FILTER_REJECT;
        p = p.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  var targets = [];
  var node;
  while ((node = walker.nextNode())) targets.push(node);

  targets.forEach(function (textNode) {
    var text = textNode.nodeValue;
    RE.lastIndex = 0;
    if (!RE.test(text)) return;
    RE.lastIndex = 0;
    var frag = document.createDocumentFragment();
    var last = 0, m;
    while ((m = RE.exec(text))) {
      var id = m[0];
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      if (valid[id]) {
        var a = document.createElement("a");
        a.href = base + id.toLowerCase() + "/";
        a.textContent = id;
        a.className = "claim-ref";
        a.setAttribute("data-claim-id", id);
        a.setAttribute("aria-label", "Otevřít tvrzení " + id);
        frag.appendChild(a);
      } else {
        frag.appendChild(document.createTextNode(id));
      }
      last = m.index + id.length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    textNode.parentNode.replaceChild(frag, textNode);
  });

  // Minimal styling for the inline claim references.
  if (!document.getElementById("claim-ref-style")) {
    var st = document.createElement("style");
    st.id = "claim-ref-style";
    st.textContent =
      ".claim-ref{color:#f3e5c0;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;white-space:nowrap;font-variant-numeric:tabular-nums}" +
      ".claim-ref:hover{text-decoration-style:solid}" +
      ".claim-ref:focus-visible{outline:2px solid #d4af37;outline-offset:2px}";
    document.head.appendChild(st);
  }
})();
