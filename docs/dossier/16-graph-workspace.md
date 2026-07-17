# 16 — Graph workspace

The relationship graph on `/dossier/` is an **investigation workspace**, not a
static figure. It lives in `scripts/dossier/graph.js` (built to
`static/js/graph.js`, loaded after Cytoscape) and reads the same
`#dossier-data` / `data/dossier/able/dossier.json`.

## Principle: nothing invented
Every node, edge, and explanation already exists in `dossier.json`, each with
its own `sources`. The workspace only *reveals and connects* that evidence — it
does not generate entities, relationships, ownership %, or values. The static
edge table beside the graph remains the no-JS / assistive-tech fallback.

## Data the graph now carries
`dossier.json → graph` was enriched (backward-compatibly) so the UI can act as a
portal:
- **nodes**: `type`, `cats` (mode membership), `expand` (lazy group), `validFrom`,
  `ident` (identifiers), `summary`, `claims`, `sources`.
- **edges**: `cat`, `why` (plain-language explanation), `confidence`,
  `firstObserved` / `lastObserved`, `sources`, `status`.
- **modes**: a `modes` map (Corporate, Ownership, People, Transactions, Legal,
  Technical, Claims, Evidence, Everything) → which categories each shows.
- New **verified** entities added from the register/media: ZenX Capital a.s. and
  5326G s.r.o. (shareholders), Libor Polanský (supervisory board), Point FM
  (2023 media investor), the `able.cz` domain, and the Regional Court in Brno
  (registration + the C 85424/C 85425 contradiction).

## Features
- **Portal nodes** — single-click selects a node, highlights its neighbourhood,
  fades the rest, and fills the inspector (overview, identifiers, relationships
  with status, claims, timeline, sources, raw JSON). Nodes are non-draggable so
  a tap always selects.
- **Explaining edges** — click an edge for *why it exists*, its status,
  confidence, first/last observed, a provenance chain, and source links.
- **Double-click** a node to expand its neighbours (lazy reveal).
- **Modes** switch which categories are shown; Claims/Evidence modes inject
  claim and source constellations.
- **Layouts** — concentric (default, hub-and-spoke), hierarchy, force, radial,
  grid; choice persisted in `localStorage`.
- **Filters** — confidence (verified / self-reported / disputed) and source tier
  (official / company / media).
- **Search** an entity/claim/source and jump to it.
- **Path finder** — pick two nodes, get the evidence-backed connecting path.
- **Analytics** — most-connected entities, clusters, self-reported vs verified
  counts, contradictions, entities lacking a source id.
- **Time machine** — a 2012→2026 slider (with play) that filters by
  `validFrom` / `firstObserved`.
- **Command palette** — Ctrl/Cmd-K over modes, layouts, expand, find, export.
- **Export** — PNG, JSON (visible sub-graph), GraphML, CyJS.
- **Cross-highlighting** — clicking a row in the sibling edge table opens that
  edge in the workspace.

## Responsive
Mobile-first CSS: single column, the inspector becomes a **bottom sheet** that
slides up on selection (drag handle + close), large touch targets, non-draggable
nodes, `touch-action:none` canvas for pan/zoom. From ≥769 px the inspector is a
static right panel; from ≥1024 px the whole workspace **breaks out of the narrow
article column** (up to 1440 px centred) to use the width.
*Verification note:* the automation browser's viewport would not drop below
~1259 px, so the < 768 px bottom-sheet layout is verified by construction and by
its open/close JS, not by a sub-768 px screenshot.

## Confidence encoding (not colour-only)
Edges: solid = verified/corroborated, dashed = self-reported, dotted = historical
(has `validTo`), gold = contradicted. Nodes: shape by type, gold border + larger
size for the subject and for contradicted records, label halos for legibility.
A legend and a "position is layout, not importance" caveat are always shown.

## What this is not (honest scope)
The larger corporate-intelligence spec (recursive depth-3 expansion, ownership
percentages over time, filed financials, insolvency/sanctions/procurement graphs,
a 3-D corporate-evolution view) is **not** built, because the public sources
reviewed do not provide that evidence and the project forbids inventing it. The
graph is rich where real evidence exists (identity, governance, ownership,
transactions, the one contradiction, the digital/legal footprint) and marks the
rest as open questions rather than fabricating nodes to fill the space.
