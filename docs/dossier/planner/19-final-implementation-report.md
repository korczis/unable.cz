# 19 — Investigation planner: final report

**Pass:** source-intelligence + investigation planner · **Date:** 2026-07-18 ·
**Branch:** `feat/dossier-planner`. Status labels: **IMPLEMENTED / VALIDATED /
PARTIAL / BLOCKED / REJECTED / NOT IMPLEMENTED**. No planned work reported as done.

## What this pass adds

The prior passes answered *what do we know / what's missing*. This one adds the
**source layer**: how independently each claim is actually supported, and what to
check next — computed from the sourced records, inventing nothing.

The headline capability is **source independence**. In this case "CORROBORATED"
usually means two aggregator mirrors of the **same** Czech register — one
authority, not two independent confirmations. `planner.mjs` assigns every source
an explicit `upstream` authority and, per claim, counts **distinct upstreams**,
not source records. The dossier's long-standing caveat is now machine-computed
and gate-enforced.

## Results (VALIDATED)

- **Source registry** — 19 sources classified by `upstream`:
  `cz_register` 10, `czechcrunch` 2, `able_cz` 2, and one each of `forbes`,
  `linkedin`, `dns`, `vies`, `crtsh`.
- **Source diversity** — of 27 claims, **24 rest on a single upstream authority**
  (monoculture) and **14 on the company's own pages only**. The three genuinely
  multi-authority claims are the Blackfish acquisition (Forbes + CzechCrunch) and
  its two register-plus-media corroborations.
- **Relationship verification** — of 48 edges: `verified` 7, `single_upstream`
  22, `source_claimed` 9, `contradicted` 4, `partially_verified` 3, `unverified`
  3. The engine correctly separates *two independent media outlets*
  (`partially_verified`) from *two mirrors of one register* (`single_upstream`).
- **Questions** — 16 (from gaps + contradictions), each linked to a task.
- **Planner tasks** — 19, enriched with an ordinal expected-information-gain
  (high 5, moderate 11, low 3), explicit stored prioritization dimensions, and a
  `whyRanked` rationale. Every task traces to a gap/contradiction (gate-enforced).
- **Run diff** — a deterministic `runHash` (`e1b698de`) over a state fingerprint;
  this run is the **baseline**, so `changesSincePrevious: null` (honest — there is
  no prior planner run to diff against).

## Status against the brief

- Source-intelligence registry, coverage, diversity, questions, tasks,
  prioritization + EIG, relationship verification, run-diff baseline —
  **IMPLEMENTED & VALIDATED** (derived, tested, gate-checked).
- Live provider execution / agent orchestration / Prismatic Oban planner —
  **NOT IMPLEMENTED**: unable.cz executes no live pipeline (proved in
  `docs/dossier/depth/19`); Prismatic has a real orchestrator/hypothesis engine
  but is not wired in. This planner is the honest static derivation, schema-aligned.
- Meilisearch / Kuzu / new Cytoscape planner *graph modes* / Three.js — **NOT
  IMPLEMENTED** this pass (the data now exists to build them).

## Pipeline & validation

`npm run data:build` = export → derive → cadastre → **planner**. `npm run verify`
= build → `data:validate` (now 9 gates incl. planner) → seo → 50 tests. GATE 9
fails the build if a copy is counted as an independent upstream, if a monoculture
CORROBORATED claim drops its caveat, or if a task lacks an origin/EIG. Two planted
tests prove it non-vacuous.

## Files changed

Added `scripts/dossier/planner.mjs`, `scripts/dossier-planner.test.mjs`,
`static/data/able-cz/planner/*.json`, `docs/dossier/planner/*`; modified
`scripts/dossier/validate.mjs` (GATE 9), `package.json`, `templates/dossier.html`
("Nezávislost zdrojů a ověření" section).

## Reproduction

```bash
npm run data:build      # export + derive + cadastre + planner
npm run data:validate   # 9 gates incl. source-independence
npm test                # 50 tests incl. 8 planner tests
npm run dev             # /dossier/ → "Nezávislost zdrojů a ověření"
```

## Known limitations

Static derivation only; no live provider/agent execution; `upstream` families are
an explicit documented mapping (docs/09), not auto-discovered. Run-diff has one
baseline run. The independence model treats the whole Czech register as one
authority — deliberately conservative, so "corroborated" is never overstated.
