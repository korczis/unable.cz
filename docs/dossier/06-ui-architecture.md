# 06 — UI architecture

The dossier preserves the site's visual identity (near-black ground, off-white
and muted grey hierarchy, warm gold/champagne accent, editorial type) and reads
as the forensic continuation of the landing page — not a SaaS dashboard.

## Layout
- Single centred column (`max-w-3xl`) on a black ground, matching the site.
- Provenance panel (last updated, evidence cutoff, confidence, source count) from
  the same front-matter fields the validator checks; a stale notice appears if
  the review window lapses.
- Prose (`content/dossier.md`) via Flowbite Typography (`format-invert`).
- Figures and tables follow, each in its own `<section>` with a labelled `<h2>`.

## Progressive enhancement (load-bearing)
Every figure is optional. The **data table or list is always rendered** and is
the source of truth; Chart.js/Cytoscape/p5 draw over the same embedded JSON
(`#dossier-data`). With JS off or a library missing, nothing is lost — the tables
carry the identical numbers to assistive tech (charts are `aria-hidden`, graphs
`role="img"` with the edge table beside them).

## Typography
- Bold sans for UI/headings; serif for the hero statement; **monospace** for IDs,
  IČO, court files, and source IDs.

## Performance
- Chart.js, Cytoscape.js, and p5.js load **only** on `/dossier/` (template
  `scripts` block), never site-wide. The homepage stays lightweight.
- p5 uses a deterministic seed and pauses when off-screen; all figures respect
  `prefers-reduced-motion`.

## Responsive
Single column throughout; tables scroll inside `overflow-x-auto`; the graph and
canvas size to their container. No horizontal page overflow at mobile widths.
