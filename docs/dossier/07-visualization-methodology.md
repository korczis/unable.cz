# 07 — Visualization methodology

Three figures, each rendered from real evidence in `dossier.json`, each paired
with an accessible table/caption. Zero invented values.

## Chart.js — claim verification status (doughnut)
- Input: `claims[]`, counted by `status`.
- Encoding: champagne = verified/corroborated, gold = contradicted, muted grey =
  self-reported/unconfirmed. Tooltip shows count and share of total.
- Alternative: the full claim ledger table above it.
- Purpose: show at a glance that most claims are self-reported — the honest
  state of the evidence, not a flattering KPI.

## Cytoscape.js — entity / relationship graph
- Input: `graph.nodes` (coloured/shaped by `group`) and `graph.edges` (styled by
  `status`: solid champagne for verified/corroborated, dashed muted for
  self-reported).
- Layout: **concentric**, subject centred — deterministic for reproducibility.
- Read-only (no zoom/drag), fit-to-container, resize-aware.
- Every edge is evidence-backed; the edge table lists From/Relationship/To/Status.
- Caveat (stated on the page): position implies neither importance nor causality.

## p5.js — evidence field
- Input: one mark per `claim`, coloured by `status`.
- **Deterministic** (`randomSeed(24278815)`), reduced-motion aware (static
  placement), and **paused when off-screen** via `IntersectionObserver`.
- A textual caption states the counts (e.g. "N claims — M corroborated/verified,
  K self-reported").
- It restates the claim table at a glance; it is never a source of new
  information and implies no precision beyond the underlying data.

## Palette
Monochrome + champagne/gold only. No rainbow, no neon, no gradients — consistent
with the site tokens.
