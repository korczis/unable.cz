# 17 — Investigation cockpit: final report (§43)

**Route:** `/dossier/` · **Production:** https://unable.cz/dossier/ · **Date:**
2026-07-18 · **HEAD at report:** `f42d176`. Status labels: **IMPLEMENTED /
VALIDATED / PARTIAL / NOT IMPLEMENTED**. No planned work reported as done.

The route was transformed from a long report with embedded widgets into a
navigable, hyperlinked, no-dead-end investigation cockpit — **without** an SPA
framework, without replacing Zola, and without discarding any content. Every
surface reads the same canonical `#dossier-data`; nothing was fabricated to fill
UI; the privacy gate and source discipline are unchanged.

## Delivered (all IMPLEMENTED, VALIDATED in-browser, DEPLOYED)

| Brief § | Feature | Module | Deep-link |
|---|---|---|---|
| §4 | Executive overview — 9 canonical metrics, each clickable, each with "Proč toto číslo?" | `cockpit.js` | — |
| §3.2 | Section navigator — sticky, IntersectionObserver active-tracking | `cockpit.js` | — |
| §7 | Deep-linkable records — 279 ids → keyboard-operable, highlight all mentions | `cockpit.js` | `?claim=` `?source=` |
| §3.4/§8/§9/§18 | Context inspector — side panel/bottom sheet, typed backlinks, entity→entity jumps | `inspector.js` | `?entity=` |
| §23 | Global search — `/` to focus, over claims/sources/contradictions/entities + IČO | `inspector.js` | — |
| §12 | Cytoscape sync — selecting an entity focuses the graph node | `graph.js`+`inspector.js` | — |
| §10 | Financial-value drill-down — figure → source, exact filing citation, fact/assessment | `inspector.js` | `?fin=` |
| §6 | Lens system — reprioritise presentation, never hide data | `lens.js` | `?lens=` |
| §25 | Comparison mode — FY2024 vs FY2023, aligned Δ + YoY chart | `compare.js` | — |
| §20 | Unified timeline — 43 dated, sourced events; year/milestone filters | `timeline.js` | `?tl=` |
| §36 | Count consistency — overview counts LIVE claims, matches the table | `cockpit.js` | — |
| §44 | Adversarial audit against production | [16](16-adversarial-route-audit-live.md) | — |

## Numbers

- Canonical: 49 live claims (58 incl. superseded audit trail), 22 sources, 43
  graph nodes, 60 edges, 11 timeline milestones, 3 contradictions.
- Cockpit modules: 5 new (`cockpit`, `inspector`, `lens`, `compare`, `timeline`),
  ~74 KB unminified, all progressive-enhancement (empty/inert with JS off).
- Tests: **93** (`npm test`), incl. 5 cockpit test files. verify green: gates 0/0.
- Deep-link params: `?claim ?source ?entity ?fin ?lens ?tl` — all restore on reload.

## Defects found & fixed during the build

1. **Evidence modal stuck open** (`5a8d19e`) — `[hidden]` lost to Tailwind
   `.flex`; the fix existed in `input.css` but wasn't deployed. The whole route
   was a dimmed empty overlay in production until deployed.
2. **Lens accented every section** — `classList.toggle(cls, undefined)` flips
   instead of removing; fixed with strict boolean coercion.
3. **Count inconsistency** (`e957148`) — overview showed 58 claims vs the table's
   49 (superseded audit trail); fixed to count live claims, with a regression test.

## Not implemented (labelled, honest)

- **Right-inspector resize/pin, split view, bottom context tray** (§3.4/§3.5) —
  the inspector is a fixed side panel / bottom sheet, not resizable/pinnable.
- **Comparison beyond financial periods** (§25) — entities/people/ownership-
  snapshot comparison NOT built; financial-period comparison is the shipped axis.
- **Backlinks "referenced by … as …" everywhere** (§21) — the inspector shows
  typed backlinks for entities/claims/sources; not every record type has the full
  reason string.
- **Live Prismatic pipeline** — unchanged: the route is static publication;
  Prismatic is schema-aligned, not engine-driven (see `docs/dossier/depth/19`).

## Reproduction

```bash
npm run build && npm run verify        # gates + 93 tests
npm run dev                            # /dossier/
# try: ?claim=CLM-25  ?source=SRC-12  ?entity=schlesinger  ?fin=v1  ?lens=finance  ?tl=2025
# press / to search; the section navigator sits bottom-centre
```

## Verdict

The cockpit is feature-complete against the brief's core success criteria: no
dead ends, every entity/claim/financial value interactive and drillable to
evidence, graph/charts/timeline synchronised, deep links survive refresh, counts
consistent, mobile bottom-sheet + keyboard operable, public data privacy-safe,
Zola/GitHub Pages green. One adversarial defect (count) was found against
production and fixed with a test. Remaining items are labelled, not faked.
