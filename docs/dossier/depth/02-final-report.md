# 02 — Final report

**Pass:** epistemic-depth layer for the Able.cz dossier · **Date:** 2026-07-18 ·
**Branch:** `feat/dossier-epistemic-depth`

Status labels: **IMPLEMENTED / VALIDATED / PARTIAL / NOT IMPLEMENTED / REJECTED**.
This report does not describe planned work as done.

## 1. Prismatic components reused — PARTIAL (schema alignment, not live wiring)
The dossier's model was aligned to Prismatic's canonical schemas
(`Prismatic.Epistemic.Assertion`, `dd_evidence_items.direction`,
`PrismaticNabla.Contradiction`, `dd_hypotheses`, `dd_score_cards`). No live
Prismatic process ran; no Able.cz record exists in Prismatic's DB. See
[00](00-prismatic-deep-capability-audit.md).

## 2. Components added to Prismatic — NOT IMPLEMENTED
Nothing was written into `~/dev/prismatic-platform` this pass. The missing
component it needs for this use case (a static-site export serializer over the
`dd_*` schemas) is prototyped on the publication side as `export.mjs` + `derive.mjs`.

## 3. Providers executed — NONE this pass
No provider/adapter was run. The underlying Able.cz evidence was collected in
prior passes and is unchanged. This layer re-expresses its epistemics.

## 4–5. Sources / raw artifacts — unchanged
19 public sources (`SRC-01…19`); primary filed registry PDFs preserved under
`cases/DD-Able-CZ-2026-07-17/sbirka-listin/`.

## 6–16. Investigation state (derived, IMPLEMENTED & VALIDATED)
- Entities **41**, relationships **48**, claims **27**, contradictions **2**.
- Coverage matrix: **2 strong, 4 adequate, 1 partial, 2 weak, 1 absent** (10 dimensions).
- Gaps: **14** (2 high, 6 moderate, 6 low materiality).
- Hypotheses: **4** (1 plausible, 2 unresolved, 1 contradicted) — none as fact.
- Frontier tasks: **19** (3 high, 7 medium, 9 low priority).
- Lineage index: **27** claim→assertion→source rows.
- Changes detected between runs — **NOT IMPLEMENTED** (single run; the schema
  supports diffing but no prior derived snapshot exists to diff against).

## 17–18. Exports
- **Public** (IMPLEMENTED): `static/data/able-cz/*.json` — the only tier the Zola
  build consumes; privacy-gated by `validate.mjs`.
- **Analyst/forensic** (PARTIAL): the raw case tree under
  `cases/DD-Able-CZ-2026-07-17/` (evidence, sbirka-listin PDFs, logs) is the
  fuller tier. A formal three-profile split with per-field publication classes is
  NOT IMPLEMENTED; the privacy gate enforces the one invariant that matters for
  publication (no rodné číslo / prohibited PII in public bytes).

## 19–20. UI modes & graph depth
- New page sections (IMPLEMENTED & VALIDATED, Czech): Pokrytí šetření (+ Chart.js
  bar), Mezery v evidenci, Hypotézy, Fronta šetření — each with a no-JS table.
- Pre-existing graph workspace (modes, path finder, time machine, provenance
  inspector, command palette) unchanged and still functional.
- Dedicated fullscreen "frontier/contradiction/coverage" graph *modes* inside the
  Cytoscape workspace — NOT IMPLEMENTED this pass (the data now exists for them).

## 21–22. Provenance & coverage behavior — IMPLEMENTED
Every derived row has `derivedFrom`; the gate rejects orphan provenance. Coverage
is measurable per dimension and states what was checked/found/missing.

## 23. Browser-test results — VALIDATED
Served build at `http://127.0.0.1:1111/dossier/`: 2 Chart.js instances render,
10 coverage rows, 14 gap rows, 4 hypothesis cards, 19 frontier rows, graph canvas
mounts, **no console errors**.

## 24. Performance — PARTIAL
Zola build ~90 ms; five small derived JSON files (all &lt; 40 KB). No sharding
was needed at this data size; the mission's shard scheme is deferred.

## 25. Validation results — VALIDATED
`npm run verify`: build + evidence-integrity gate (0 errors, 0 warnings) +
`seo:validate` (0 errors) + **37 tests pass** (6 new). The privacy gate is proven
non-vacuous by a planted-birth-number test.

## 26. Privacy review — VALIDATED
No rodné číslo or prohibited PII in any public export (gate 4). The one known
birth-ID in source documents (CLM-26) was already redacted upstream; the gate now
proves it on shipped bytes.

## 27. Files changed
- Added: `scripts/dossier/derive.mjs`, `scripts/dossier/validate.mjs`,
  `scripts/dossier-epistemic.test.mjs`,
  `static/data/able-cz/{coverage,gaps,hypotheses,frontier,lineage}.json`,
  `docs/dossier/depth/{README,00,01,02}.md`.
- Modified: `package.json` (data:build/validate, verify), `templates/dossier.html`
  (4 sections + coverage-data block), `scripts/dossier/client.js` (coverage chart),
  `CLAUDE.md`/`README.md`/`METHODOLOGY.md` pointers.

## 28. Commits
One coherent commit on `feat/dossier-epistemic-depth` (see git log).

## 29–30. URLs
- Local: `http://127.0.0.1:1111/dossier/` (via `npm run dev`).
- Production: `https://unable.cz/dossier/` (GitHub Pages, on merge to `main`).

## 31. Known limitations
Static publication only; no live Prismatic pipeline, no new provider calls, no
Meilisearch/Kuzu/Three.js, no run-to-run diffing, no per-field publication-class
matrix, no bitemporal validity. Aggregator-sourced facts (SRC-10/11) remain
`CORROBORATED`, not `VERIFIED_PRIMARY` — surfaced as GAP-10 and a frontier task.

## 32. Reproduction
```bash
git checkout feat/dossier-epistemic-depth
npm ci
npm run data:build      # export.mjs + derive.mjs
npm run data:validate   # evidence-integrity gate
npm run verify          # build + validate + seo + tests
npm run dev             # serve at :1111, open /dossier/
```
