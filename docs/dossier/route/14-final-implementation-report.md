# 14 — Investigation cockpit: final report

**Pass:** cockpit layer for `/dossier/` · **Date:** 2026-07-18 · **Branch:**
`main`. Status labels: **IMPLEMENTED / VALIDATED / PARTIAL / NOT IMPLEMENTED**.
No planned work reported as done.

## Scope decision

The brief describes a full application (shell, lenses, inspector, comparison,
timeline rebuild, shards, command palette). That is a multi-week build. This pass
delivers a **fully-wired vertical slice** that moves the route from "long report"
toward "cockpit" without an SPA framework, without discarding any content, and
without a single inert control — the rest is labelled NOT IMPLEMENTED, not faked.

## Implemented & validated

- **Executive overview** (`cockpit.js`) — 9 canonical metrics (claims, verified,
  self-reported, assessed, contradictions, sources, primary documents,
  entities·edges, open questions), each **computed live from the embedded
  `#dossier-data`** (a test forbids hardcoded totals), each **clickable** to its
  section with cross-highlight, each with a **"Proč toto číslo?"** popover listing
  the calculation and contributing IDs. VALIDATED: browser shows claims=58 =
  canonical `claims.length`.
- **Section navigator** — sticky jump bar over all 15 sections with
  IntersectionObserver active-section tracking; keyboard-operable; mobile-safe
  (bottom-centered, becomes a right rail ≥1280px). VALIDATED: 15 items.
- **Deep-linkable records** — 279 `CLM-/SRC-/CON-/GAP-/HYP-/Q-/TASK-` ids turned
  into keyboard-operable buttons. Selecting one highlights every occurrence,
  cross-references mentions elsewhere, scrolls to it, dispatches
  `dossier:<type>-selected`, and sets `?claim=`/`?source=` via History API.
  VALIDATED: `?claim=CLM-14` restores highlight on load; clicking SRC-12 sets the
  URL and highlights 17 cross-references; back/forward and Escape work.
- **Accessibility** — record links are `role=button`, `tabindex=0`, Enter/Space
  operable; an `aria-live` region announces selections; reduced-motion honored;
  focus-visible outlines; non-color cues (dotted underline, flash).
- **Consistency test** (`dossier-cockpit.test.mjs`) — asserts the template wires
  the mount + module + embedded data, that `cockpit.js` computes counts (no
  drift-prone literals), and that every claim status falls in the known enum so
  the overview buckets are exhaustive. 64 tests pass.

## Not implemented (labelled)

Lens system, right-context inspector rebuild, comparison mode, timeline rebuild,
per-record detail shards, global fuzzy search, expanded command palette, Three.js
temporal view. The existing graph workspace (`graph.js`) already provides a
Ctrl+K palette, path finder, time machine, and inspector scoped to the graph;
the cockpit dispatches `dossier:*-selected` events it (and future work) can
consume, so the integration seam exists.

## Files changed

Added `scripts/dossier/cockpit.js`, `scripts/dossier-cockpit.test.mjs`,
`docs/dossier/route/{00,14,15}.md`; modified `templates/dossier.html` (mount +
script), `package.json` (js:build copies cockpit.js).

## Validation

`npm run verify` green (build + gates + seo + 64 tests). Browser: overview +
navigator + deep-links work, graph intact, no console errors, no rodné číslo in
DOM. Progressive enhancement: with JS off, the mount is empty and all content
(prose, tables, graph fallback tables) remains.

## Reproduction

```bash
npm run build && npm run verify
npm run dev   # /dossier/  → overview strip, section navigator (bottom),
              # click any CLM-/SRC- id; open /dossier/?claim=CLM-14 to test deep-link
```

## Known limitations

Vertical slice only (see "Not implemented"). Narrative prose in
`content/dossier.md` still trails the enriched 58-claim data in places (live
counts are correct; some sentences predate enrichment) — a content-reconciliation
task. Deep links cover claims/sources/records, not yet entity/graph-node routing.
