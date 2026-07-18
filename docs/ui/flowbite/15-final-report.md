# 15 — Flowbite / responsive hardening: final report

**Date:** 2026-07-18. Status labels: **PROVEN / PARTIAL / BROKEN / MISSING / NOT
APPLICABLE / NOT VERIFIED**. Nothing is reported as proven that was not measured.

## Executive summary

The mission assumed Flowbite is integral and asked for a full component-level
mobile-first rebuild. The codebase reality (audited in [00](00-version-and-integration-audit.md)):
**Flowbite's JS is loaded but entirely unused**; only the `flowbite-typography`
Tailwind plugin is used (prose). The interactive UI is deliberately **custom**
(Cytoscape graph, cockpit, context inspector), which the mission's own §4 says to
keep custom. So there were **no Flowbite components to rebuild**.

The site already had a solid mobile baseline: correct viewport meta, global
`overflow-x-hidden` (no page-level horizontal scroll possible), fluid `max-w + px`
layouts, tables in `overflow-x-auto`, and custom components with mobile
bottom-sheet media queries. This pass therefore made **targeted correctness fixes**
and produced an **honest audit**, rather than a theatrical overhaul.

## What was done

- **`min-h-[100dvh]`** on the claim + claims-index pages (was `min-h-screen`/100vh)
  — the §5 dynamic-viewport-height fix. **PROVEN** (built, class present in CSS).
- **Honest audit docs** (00, 01) recording versions, the dead-loaded Flowbite JS,
  the custom-surface rationale, and the genuine gaps.

## Proof matrix

Statuses reflect what was actually measurable. The automation window is fixed at
1280px, so **narrow-viewport rendering could not be exercised** — those cells are
`NOT VERIFIED`, not `PROVEN`.

| Concern | Static evidence | 1280 (measured) | ≤768 (measured) | Status |
|---|---|---|---|---|
| Viewport meta present | base.html | ✓ | — | **PROVEN** |
| No page-level horizontal overflow | `overflow-x-hidden` on html,body | overflow=0 | — | **PROVEN** at 1280; structurally enforced at all widths |
| Fluid page layout (no fixed width) | `max-w-3xl px-4` | ✓ | — | **PROVEN** |
| Dynamic viewport height on claim pages | `min-h-[100dvh]` | ✓ | — | **PROVEN** |
| Custom inspector → bottom sheet on mobile | `@media(max-width:768px)` in inspector.js | — | not renderable (tool) | **PARTIAL** (code present, unverified in-browser) |
| Graph toolbar/inspector at 320px | fluid CSS + mobile media query | — | — | **NOT VERIFIED** |
| Tables usable at 320px | `overflow-x-auto` contained | — | — | **PARTIAL** (contained scroll, not restructured to cards) |
| Flowbite components correct/accessible | none exist | — | — | **NOT APPLICABLE** |
| GitHub Pages base-path safety | all links via `get_url`; JSON via `get_url(path=…)` | ✓ | — | **PROVEN** |
| Dynamic Tailwind classes survive purge | claim template uses literal classes; custom JS uses own CSS | ✓ | — | **PROVEN** |

## Honest limitations / NOT VERIFIED

- **True 320–430px rendering was not exercisable** with the current browser tool
  (window clamped to 1280). Claims of 320px usability would be unfounded, so they
  are labelled NOT VERIFIED. A real device / Playwright device-emulation run is
  the correct next step (§27 Playwright suite — **NOT IMPLEMENTED** this pass).
- **No safe-area-inset padding** on the full-height graph/inspector surfaces
  (§5) — recommended, not applied (those files are the concurrent session's).
- **Flowbite component macros, drawers, modals, tabs, skeletons** (§4–§13):
  **NOT IMPLEMENTED** — there is no Flowbite UI in the product to build them on,
  and adding a Flowbite shell would replace working custom UI without a driver.
- **Responsive Playwright + axe + visual-regression suites** (§27–§28):
  **NOT IMPLEMENTED**.

## Recommendation

Before a genuine mobile-first *component* pass is worthwhile, decide the product
question the mission skipped: does `/dossier/` want a Flowbite app shell (navbar +
drawer + modal) at all, or stay a single scrollable dossier + custom graph? If the
latter (current design), the honest deliverables are: (a) a Playwright device-
emulation suite to actually verify 320–430px, (b) safe-area padding on the graph/
inspector, (c) removing the unused `flowbite.min.js`. This report does not claim
any of those as done.
