# 15 — Adversarial route audit (cockpit)

**Date:** 2026-07-18. Assume the cockpit cheats or breaks; try to catch it.

| Probe | Finding | Evidence |
|---|---|---|
| Hardcoded counts that could drift? | **No.** Every metric computed from `#dossier-data` at runtime; a test bans `\b(58\|22)\s*(claims\|sources…)` literals. | `dossier-cockpit.test.mjs` |
| Displayed count ≠ canonical? | **No.** Browser: claims metric = 58 = `D.claims.length`. | browser check |
| Inert controls / buttons without behavior? | **No.** Every metric scrolls+highlights; every record link selects+deep-links; navigator jumps+tracks; why-buttons toggle disclosures. | browser check (SRC-12 click → URL + 17 refs; verified → 110 hi) |
| Dead-end record ids? | **Fixed.** 279 ids are keyboard-operable and cross-highlight all mentions. | browser: 279 `[data-record]` |
| Deep link fails on refresh? | **No.** `?claim=CLM-14` restores highlight on load; popstate handled. | browser: clm14Highlighted=true on load |
| Not keyboard accessible? | **No.** Records are `role=button tabindex=0`, Enter/Space handled; Escape clears; focus-visible outlines. | `cockpit.js` |
| Hover-only context (mobile)? | **No.** All actions are click/keyboard; why-boxes toggle on click, not hover. | `cockpit.js` |
| Analyst-only data in the public payload? | **No new data added.** Cockpit reads the already-published `#dossier-data`; adds no records. | — |
| Assessment shown as fact? | **No.** The overview keeps ASSESSED as its own bucket, distinct from verified. | metric defs |
| Breaks with JS off? | **No.** Mount is empty; all content + no-JS fallback tables remain. | progressive enhancement |
| PII leak in DOM? | **No.** rodné-číslo regex over `document.body.innerText` → none. | browser check |
| Console errors? | **None.** | browser check |
| Circular update loops? | **None observed.** Selection sets URL + dispatches once; popstate calls `selectRecord(..., false)` (no re-push). | `cockpit.js` |
| Docs overstate implementation? | **No.** [14](14-final-implementation-report.md) labels lenses/inspector/comparison/timeline/search NOT IMPLEMENTED. | 14 |

**Material defects found & removed:** none. **Residual honest limitation:** the
cockpit is a wired slice, not the full application; the narrative prose still
trails the enriched data in places (live counts are correct). Both are labelled
in 00 and 14, not concealed.
