# 10 — Validation report

Run 2026-07-17 on the built `public/` and a local `zola serve` instance.

## Build
`npm run build` (css + js + data + zola) — **OK**. Emits `public/`, copies
Alpine/Flowbite/Chart.js/Cytoscape/**p5**/`dossier.js` to `static/js/`, and
generates 10 exports under `static/data/able-cz/`. Zola: "Creating 1 pages
(0 orphan)" — the dossier is linked from the hero, so no orphan warning.

## Static validation
`npm run seo:validate` — **0 errors, 0 warnings** across 3 pages (2 indexable).
Canonical, OG, Twitter, JSON-LD (via the `seo::j` macro), robots, and the
Report evidence policy all pass. No hardcoded host; exactly one `<h1>`.

`npm test` — **31/31 pass**. Includes the metadata-invariant tests (no child
template renders its own metadata), JSON-LD `</script>` neutralization, the
Report review-policy check, and the UNABLE-link regression suite.

## Browser smoke test (`zola serve`, 127.0.0.1:1111)
- Homepage renders; **UNABLE** click navigates to `/dossier/` (`Able.cz —
  Public-Evidence Due Diligence`). **OK**
- Figures rendered from embedded data, **no console errors**:
  - Chart.js status doughnut — canvas sized; mostly muted (self-reported) with a
    thin champagne corroborated slice; legend present.
  - Cytoscape relationship graph — 3 layered canvases; subject centred; solid
    champagne edges for verified/corroborated, dashed muted for self-reported;
    edge table beside it.
  - p5 evidence field — 1 canvas; caption "15 claims reviewed — 1 corroborated
    or verified, 14 self-reported or unconfirmed"; deterministic seed; pauses
    off-screen.
- Identity table shows IČO 24278815, statuses, and source IDs; the C 85424 vs
  C 85425 contradiction is displayed.

## Responsive
`document.documentElement.scrollWidth <= innerWidth` — **no horizontal
overflow**; no overflowing elements outside `overflow-x-auto` wrappers. Layout is
a single `max-w-3xl` column with every table scroll-wrapped.
*Limitation:* the automation window clamped to a ~1259px minimum, so a true
375–430px hardware viewport was not exercised; responsiveness is verified
structurally and by the overflow measurement, not by a sub-768px screenshot.

## Accessibility (design-level)
Every figure has an always-present data table/caption; canvases are
`aria-hidden`, graphs use `role="img"` with the edge table as the text
alternative. `prefers-reduced-motion` disables the chart animation and places p5
marks statically. Skip-to-content and focus-visible outlines inherit from the
site. *Not yet run:* an automated axe pass — recommended as a follow-up.

## Screenshots
`docs/dossier/screenshots/`: `01-homepage-desktop.jpg`, `02-dossier-chart.jpg`,
`03-dossier-graph.jpg`, `04-dossier-evidence-field.jpg`.
