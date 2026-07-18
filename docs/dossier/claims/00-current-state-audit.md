# 00 — Claim references: current-state audit

**Date:** 2026-07-18 (before the Claim Object System).

## Findings

- **58 claim records** exist in `data/dossier/able/dossier.json` (`CLM-01`…`CLM-58`),
  each with `id, text, status, sources` and, for 9 of them, a supersession chain
  (`superseded`, `supersededBy`, `supersededReason`).
- **Count discrepancy explained:** the page showed "58 tvrzení" while other
  surfaces implied ~49 — because **9 records are superseded** (split/merged into
  successors) and preserved for audit. 58 issued = 49 live + 9 superseded. This
  was never stated as an explicit accounting; now it is (manifest).
- **No claim routes existed.** `CLM-*` appeared as: plain text in the narrative
  prose (~49 mentions, non-navigable); monospace cells in tables that the cockpit
  turns into JS `data-record` buttons (open an in-page inspector, no canonical
  URL); and inside the graph inspector. There was **no `/dossier/claims/…` route,
  no per-claim JSON, no stable address**.
- **Generic evidence links** ("důkaz") pointed at section-level anchors, not exact
  records.

## Consequence

A `CLM-22` in the summary could not be opened as its own page, copied as a URL,
middle-clicked, or shared. Superseded claims had no historical address. Counts
were asserted without a reconciliation point. The Claim Object System (docs
[18](18-final-report.md)) fixes the load-bearing subset: canonical routes, JSON,
real anchors in the narrative, and machine-enforced accounting.
