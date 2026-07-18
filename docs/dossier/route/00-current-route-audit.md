# 00 — Current /dossier/ route audit

**Date:** 2026-07-18. What the route rendered before the cockpit layer, and the
defects the cockpit slice targets. Honest and specific.

## What was rendered (15 sections)

A single Zola page (`content/dossier.md` prose + `templates/dossier.html`),
progressively enhanced by `graph.js` (Cytoscape workspace), `dossier.js`
(Chart.js + p5), and the derived `static/data/able-cz/**` exports. Sections, in
DOM order: claims chart, relationship graph, evidence field, identity,
financials, coverage, gaps, hypotheses, frontier, source independence, addresses,
evidence explorer, research questions, open questions, source ledger.

Every block maps to a canonical record: claims/sources/edges to
`data/dossier/able/dossier.json`; coverage/gaps/hypotheses/frontier to
`static/data/able-cz/{coverage,gaps,hypotheses,frontier}.json`; independence to
`planner/*`; addresses to `cadastre/*`.

## Defects found (targeted by this pass)

- **No executive orientation.** The reader had to scroll the whole article to
  learn the state (how many claims, how many verified, how many contradictions).
  → executive overview strip, canonical + clickable.
- **No navigator.** 15 sections, no jump/active-tracking. → sticky section
  navigator with IntersectionObserver active tracking.
- **Dead-end record IDs.** `CLM-*` / `SRC-*` / `CON-*` ids appeared in ~5 tables
  as inert monospace text; a reader seeing "CLM-16" in one table could not find
  its other mentions. → 279 ids made keyboard-operable record links that
  highlight every mention and cross-reference.
- **No deep links.** No way to link to a specific claim/source; reload lost all
  context. → `?claim=` / `?source=` History-API deep links that restore on load
  and back/forward.

## Defects deferred (labelled, not faked) — see [14](14-final-implementation-report.md)

Full lens system, right-inspector rebuild, comparison mode, timeline rebuild,
per-record detail shards, global fuzzy search, and command palette beyond the
existing graph one are **NOT IMPLEMENTED** this pass. The cockpit is a wired
vertical slice, not the whole application; nothing inert was added to fake them.

## Content/prose note

`content/dossier.md` front matter is current (cutoff/reviewed 2026-07-18,
sources_consulted 22). The narrative body still trails the 58-claim enriched data
in places (a content-reconciliation task, §35) — the data tables/graph/overview
render live counts, so the visible numbers are correct, but some prose sentences
predate the primary-source enrichment. Flagged, not silently left as "done".
