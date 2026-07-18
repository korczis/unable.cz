# 03 — Source intelligence registry

**Status: IMPLEMENTED & VALIDATED.** Sources are investigation objects, not just
citations. `planner.mjs` emits `static/data/able-cz/planner/sources.json`.

## Per-source fields (derived)

`id`, `title`, `url`, `tier`, `kind`, `class` (company / official_register /
register_mirror / register_aggregator / primary_registry_document / media /
profile / technical), `upstream` (authority — see [09](09-source-diversity.md)),
`official`, `primary`, `independence` (independent_origin / derivative /
company_controlled), `freshness`, `retrievedAt`, `claimsSupported[]`,
`edgesSupported`, `contradictionsTouched[]`.

## This case's 19 sources by upstream authority

| upstream | count | independence |
|---|---|---|
| `cz_register` | 10 | official but one authority (mirror/aggregator/primary docs) |
| `czechcrunch` | 2 | one independent outlet |
| `able_cz` | 2 | company-controlled |
| `forbes` / `linkedin` / `dns` / `vies` / `crtsh` | 1 each | independent origins |

## Freshness

All 19 sources were retrieved at the evidence cutoff (2026-07-17) → `fresh`. The
field is explicit so a future refresh can mark aged sources rather than silently
presenting stale data as current.

## Not tracked this pass

Provider success/failure rates, rate limits, last-run timestamps — these require
a live provider layer, which is NOT IMPLEMENTED (see [01](01-prismatic-capability-map.md)).
The registry models what the static case can honestly support: classification,
authority, independence, and contribution.
