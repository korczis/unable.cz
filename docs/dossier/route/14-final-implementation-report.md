# 14 — Investigation cockpit: implementation report (passes 1–2)

> **Superseded by [17 — final report](17-final-report.md)**, which consolidates
> the full cockpit (overview, navigator, inspector, search, graph-sync, financial
> drill-down, lens, comparison, timeline) with deployed status. This file records
> passes 1–2 (overview + navigator + deep-links, then inspector + search) and is
> kept as the build trail.

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

## Implemented & validated — pass 2 (context inspector + global search)

- **Context inspector** (`inspector.js`) — selecting a claim, source,
  contradiction, or entity opens a side panel (desktop) / bottom sheet (mobile,
  ≤768px) with the record's **real details from `#dossier-data`** and **typed,
  clickable backlinks**: a claim shows its sources + referencing entities; a
  source shows the claims/edges/identity fields it supports; a contradiction
  shows both sides + resolution; an **entity shows its relationships**, each a
  button that **jumps to the connected entity** — no dead end. VALIDATED:
  `?entity=schlesinger` opens "person · V. Schlesinger" with 7 relationships;
  clicking "Blackfish" navigates to `?entity=blackfish`.
- **Actions** — "V grafu" (scroll + `dossier:graph-focus-requested`), "Kopírovat
  odkaz" (deep link to the record). Escape closes; focus is captured on open and
  restored on close; the panel is a `role=complementary` landmark.
- **Global search** — an input in the overview (focus with `/`) over every
  claim, source, contradiction, and entity (incl. IČO/ident text) plus exact-id
  priority. Arrow/Enter keyboard nav; selecting a record routes through cockpit's
  selection (highlight + URL) or opens the entity inspector. VALIDATED: "24278815"
  and "Schlesinger" return results; keyboard-operable.
- **Deep links** — extended with `?entity=<id>`; restore-on-load handled inside
  `inspector.js` (cockpit dispatches its restore event before this module's
  listeners exist, both `defer`, so the panel restores directly from the URL).
- **Tests** (`dossier-inspector.test.mjs`) — wiring, canonical-data read, and
  that every edge endpoint + node-referenced claim resolves (so no inspector
  backlink can point nowhere). 68 tests pass.

## Not implemented (labelled)

Lens system, comparison mode, timeline rebuild, per-record detail shards,
financial-value drill-down, chart-driven filtering, and a bidirectional
Cytoscape sync (the inspector's "V grafu" scrolls + emits
`dossier:graph-focus-requested`, but `graph.js` does not yet consume it to
select the node). The existing graph workspace already provides a Ctrl+K
palette, path finder, time machine, and a graph-scoped inspector; the page
inspector + `/` search complement it for records/entities. These remain the
honest next steps, labelled rather than faked.

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
