# 00 — Current-state audit (planner pass)

**Date:** 2026-07-18. What the case actually contained before this pass, with
record IDs. This is the input the planner reasons over.

## Canonical data

Single source of truth: `data/dossier/able/dossier.json` — 41 graph nodes,
48 edges, 27 claims, 19 sources, 2 contradictions, 10 open questions, filed
financials, timeline. Derived exports already present: `coverage.json`,
`gaps.json`, `hypotheses.json`, `frontier.json`, `lineage.json`, `cadastre/*`.

## Defects / weaknesses this pass targets (with examples)

- **Independence was asserted in prose, not computed.** The dossier notes that
  SRC-10/SRC-11 are aggregator mirrors "not VERIFIED_PRIMARY", but nothing
  enforced it — `CORROBORATED` claims (CLM-16…22) *looked* twice-confirmed.
  → now computed as `independentUpstreams` (docs/09).
- **Source monoculture invisible.** 14 of 27 claims rest solely on able.cz's own
  pages (CLM-01…13 marketing); nothing quantified the first-party dependence.
  → `companyControlledOnly` count.
- **Edges could look more certain than their evidence.** A SELF_REPORTED client
  edge and a register-verified edge were both just "edges".
  → per-edge `verificationState` (verified / single_upstream / source_claimed / …).
- **No task ranking rationale.** The frontier had priorities but no stored
  dimensions or "why".
  → `priorityDimensions` + `expectedInformationGain` + `whyRanked`.

## Not defects (deliberate, honest state)

- The data is hand-curated public-source research, not Prismatic-collected — see
  `docs/dossier/depth/19-adversarial-implementation-audit.md`. Unchanged here.
- Marketing claims are correctly `SELF_REPORTED`; the planner does not "fix" them,
  it makes their single-source dependence explicit.
