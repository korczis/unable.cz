# Change routes (PROMPT-09 §18, §20, §36)

- `/dossier/changes/` — full ledger, sections per adjacent pair (newest first), executive summary per pair, complete table (all 362 records — non-material rows included, without own routes). No-JS: fully readable. With JS: pair/materiality/type filters bound to URL params (`?from=&to=&materialita=&typ=`), pushState + popstate → links survive reload and Back/Forward (Playwright-proven).
- `/dossier/changes/chg-nnnn/` — one static page per MATERIAL change (124): time axes, snapshot pair, revision ids, field diff with textual old/new labels, evidence and affected claims, JSON link.
- Comparison URLs: `/dossier/changes/?from=<id>&to=<id>` for any adjacent pair (the generated pairs); snapshot detail pages link "Porovnat s předchozím/aktuálním". N×N arbitrary pairs are intentionally not pre-generated (§37 combinatorial explosion); non-adjacent selections are a documented non-goal of this pass.
- Invalid snapshot ids in URL params degrade gracefully: the select shows "Všechny dvojice" and the full ledger stays visible.
