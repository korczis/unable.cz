# 01 — Current-state responsive audit

**Date:** 2026-07-18. What the mobile posture actually is, measured statically +
in-browser where the tooling allowed.

## Tooling limitation (stated honestlyup front)

The available browser-automation window is **fixed at 1280px** — `resize_window`
calls to 320/390 were clamped (`window.innerWidth` stayed 1280). So a **true
320px viewport could not be rendered/verified in-browser this pass.** Findings
below rest on static analysis + the one width the tool exposes (1280) + reading
the components' own media queries. This is a gap, not a pass — see [15](15-final-report.md).

## Mobile baseline already present (GOOD)

- **Viewport meta:** `width=device-width, initial-scale=1.0` (base.html). ✓
- **No page-level horizontal scroll is possible:** `tailwind/input.css` sets
  `html, body { @apply overflow-x-hidden }`. ✓ This structurally satisfies the
  mission's most-repeated failure mode (body horizontal overflow).
- **Fluid layouts:** the dossier and claim pages use `max-w-3xl` + `px-4` (fluid,
  no fixed page width); tables sit in `overflow-x-auto` containers.
- **Custom components carry mobile handling:** `inspector.js` renders a
  **bottom sheet ≤768px** (`@media(max-width:768px)`); `graph.js` switches to a
  mobile bottom-sheet inspector + stacked toolbar below its desktop breakpoint;
  `cockpit.js` uses responsive grids and a bottom-centered navigator that becomes
  a right rail ≥1280px.
- **The `[hidden]` modal bug** (evidence inspector stuck open) was fixed earlier
  (`5a8d19e`) — a real mobile-and-desktop breakage, now resolved.

## Genuine gaps found

| # | Gap | Severity | Action |
|---|---|---|---|
| 1 | Claim pages used `min-h-screen` (100vh) not `100dvh` (§5) | low | **Fixed** — `min-h-[100dvh]` on `claim.html` + `claims-index.html` |
| 2 | No `env(safe-area-inset-*)` padding anywhere (§5) | low | **Recommended** for the graph/inspector full-height surfaces (concurrent-session code; not edited this pass) |
| 3 | `flowbite.min.js` shipped but unused (§25) | low | **Documented** ([00](00-version-and-integration-audit.md)); conservative keep |
| 4 | True 320px behaviour of the graph toolbar + tables | unknown | **NOT VERIFIED** (tooling); static structure is fluid but unproven at 320 |

## Not defects

The absence of Flowbite drawers/navbars/modals is not a defect — the site is a
single dossier route + a custom graph workspace, and its interactive surfaces are
deliberately custom (see [00](00-version-and-integration-audit.md) §4 rationale).
