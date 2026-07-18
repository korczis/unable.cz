# 00 — Flowbite version & integration audit

**Date:** 2026-07-18. Honest audit against the installed versions and the actual
code — not against the mission's assumption that Flowbite is integral.

## Installed versions

| Package | Version | Role in this repo |
|---|---|---|
| `flowbite` | **2.5.2** | JS bundle loaded in `base.html`; **not used** (see below) |
| `flowbite-typography` | **^1.0.5** | Tailwind plugin — **used** for the dossier article prose (`format format-invert lg:format-lg`) |
| `tailwindcss` | **3.4.17** | Utility CSS, compiled `tailwind/input.css` → `static/css/main.css` |

Official Flowbite LLM doc consulted (`flowbite.com/docs/getting-started/llm/`); it
indexes component docs but defers integration specifics to the quickstart. The
2.5.2 JS auto-initializes `data-*` components on `DOMContentLoaded`.

## Integration reality (measured)

- **Tailwind content scan** (`tailwind.config.js`): `./templates/**/*.html`,
  `./content/**/*.md`, `./node_modules/flowbite/**/*.js`. The custom JS
  (`scripts/dossier/*.js`) injects its **own raw CSS** (`cp-*`, `ix-*`, `gw-*`
  class names), not Tailwind utilities, so it is correctly outside the scan and
  at **no purge risk**. The generated claim pages use literal Tailwind classes in
  `templates/dossier/claim.html` (scanned) — safe.
- **Flowbite JS is dead-loaded.** `grep` finds **zero** `initFlowbite`, `data-drawer`,
  `data-modal`, `data-dropdown`, `data-accordion`, `data-tabs`, `data-collapse`,
  `data-tooltip`, or `data-popover` in templates or scripts. `flowbite.min.js` is
  fetched (`base.html`) but nothing uses it.
- **The interactive UI is entirely custom** (Cytoscape graph workspace `graph.js`,
  cockpit `cockpit.js`, context inspector `inspector.js`, claim auto-linking
  `claims-link.js`), each with hand-rolled CSS and its own mobile handling. Per
  the mission's own §4 ("keep custom implementations for the Cytoscape canvas /
  specialized inspector content; do not force Flowbite onto specialized
  analytical surfaces"), this is the **correct** abstraction — not a defect.

## Decision

- **Keep `flowbite-typography`** (genuinely used for prose).
- **Keep the custom analytical surfaces** (graph/cockpit/inspector) — Flowbite is
  not the right primitive for them.
- **`flowbite.min.js` is unused dead weight.** Recommendation (§25 performance):
  remove the load, or adopt Flowbite for a genuine generic primitive (a real
  drawer/modal) before shipping its JS. **Left in place this pass** to avoid
  colliding with a concurrent session's in-flight UI work; flagged for the owner.

## Consequence for this mission

The premise "Flowbite is integral, rebuild components to be mobile-first" does not
match the codebase: there are no Flowbite components to rebuild, and the custom
surfaces already carry mobile behavior. The honest, high-value work is therefore
**structural mobile-first correctness** (documented in [01](01-current-state-audit.md)
and [15](15-final-report.md)), not a component swap.
