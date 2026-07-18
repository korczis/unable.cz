# 02 — Task prioritization methodology

**Status: IMPLEMENTED.** Every ranked task answers "why is it ranked here" with
stored dimensions — no unexplained AI score.

## Dimensions (stored per task, not hidden)

`planner.mjs` records these on each task's `priorityDimensions`:

- `materiality` — high / moderate / low (impact on the assessment).
- `uncertainty` — high when the current confidence is `disputed` or `unknown`.
- `sourceAvailability` — `known_public_source` vs `none`.
- `sourceAuthority` — `official_primary` (or.justice.cz, Sbírka listin, ČÚZK) vs
  `secondary`.
- `staleness`, `cost`, `legalRisk`, `privacyRisk` (elevated for natural-person leads).

## Priority (transparent ordinal rule)

Priority (`high`/`medium`/`low`) comes from `derive.mjs`'s frontier rule:
`materiality + resolvability (is a concrete public source known?) + weakness of
current confidence` — **explicitly not graph degree**. `planner.mjs` then adds an
**expected-information-gain** ordinal (`very_low`…`very_high`):

- a task that resolves a **contradiction** → `high`;
- a task that would add a **primary source** to a currently single-upstream claim
  → raised toward `moderate`/`high`;
- otherwise it tracks the frontier priority.

Each task carries `whyRanked`, a plain-language rationale naming the dimensions
that set its rank, shown in the UI.

## Result

19 tasks: EIG high 5, moderate 11, low 3. The highest-gain tasks are the two
contradiction resolutions (CON-01 court-file, CON-02 one-label split) and the
primary-source upgrades for the aggregator-only ownership claims (GAP-10).

## Not done

No cost model in currency, no Bayesian value-of-information — the brief permits
transparent ordinal classes and forbids fake decimals; this uses ordinals.
