# 13 — Production convergence proof

**Date:** 2026-07-18 · **Route:** `/dossier/` · **Production:**
https://unable.cz/dossier/ · **Method:** assume production is stale/cached/wrong
until proven. Compare four layers, crawl production for stale content, run the
responsive journey, fix every BROKEN/MISSING, redeploy, retest.

## Layers compared

There is **no live Prismatic manifest** — unable.cz does not execute Prismatic
(proved in `docs/dossier/depth/19`); the canonical layer is the single source of
truth `data/dossier/able/dossier.json` and its generated manifests
(`static/data/dossier/claims/manifest.json` is the authoritative claim
accounting, carrying `dataHash` + per-object `routes`). Layers:

1. **Canonical** — `data/dossier/able/dossier.json`
2. **Generated** — `static/data/**/manifest.json` (from the build pipeline)
3. **Built public** — `public/data/**/manifest.json`
4. **Deployed production** — `https://unable.cz/data/**/manifest.json`

## Field comparison (post-fix)

| Field | Canonical | Generated | Built | Production |
|---|---|---|---|---|
| schema_version | 1.0.0 | 1.0.0 | 1.0.0 | 1.0.0 |
| evidence_cutoff | 2026-07-18 | 2026-07-18 | 2026-07-18 | 2026-07-18 ✅ |
| data_hash (claims) | 375b87c5 | 375b87c5 | 375b87c5 | 375b87c5 |
| source_count | 22 | 22 | 22 | 22 |
| claim_accounting | 58=49+9 | 58=49+9 | 58=49+9 | 58=49+9 |
| entity_count | 43 | — | — | 43 |
| relationship_count | 60 | — | — | 60 |
| contradiction_count | 3 (1 resolved) | 3 | 3 | 3 |
| financial_fact_count | 6 | 6 | 6 | 6 |
| open_gap / resolved | 12 / — | — | — | — |

`generated_at` is stamped to the cutoff for determinism (2026-07-18). No
`snapshot_id` exists in the schema; `data_hash` (claims) is the stable identity.

## Divergence found (1) and fixed

**Evidence cutoff drift — dual date on the live page.**
- **Layer where it began:** canonical. `meta.evidenceCutoff` was `2026-07-17`.
- **Root cause:** 4 sources (SRC-20/21/22 + one) were genuinely retrieved
  **2026-07-18**, so the true cutoff (newest retrieval) is the 18th. When those
  sources were added, `meta.evidenceCutoff` was not bumped; the front matter
  (`content/dossier.md cutoff = 2026-07-18`) was. Result: the page rendered the
  subtitle "mezní datum evidence **2026-07-17**" (from `d.meta.evidenceCutoff`)
  and the freshness panel "Mezní datum evidence **18 July 2026**" (from front
  matter) simultaneously — self-contradictory.
- **Affected routes:** `/dossier/` (subtitle vs freshness panel).
- **Affected objects:** the page header only; claim/source records were unaffected.
- **Stale production statement:** "mezní datum evidence 2026-07-17".
- **Canonical replacement:** `2026-07-18` (matches the newest `retrievedAt`).
- **Fix:** bump `meta.evidenceCutoff` → `2026-07-18` in `dossier.json`; rebuild
  (regenerates all manifests) + redeploy. The `_comment` "Recorded 2026-07-17"
  is left intact — it correctly describes the first-pass date, distinct from the
  cutoff.
- **Regression test:** `scripts/dossier-convergence.test.mjs` pins
  `meta.evidenceCutoff == max(source.retrievedAt)` **and** `front-matter cutoff
  == meta.evidenceCutoff` **and** `sources_consulted == source count`, so the
  three can never diverge again.

## Production stale-content crawl

| Prohibited | Result |
|---|---|
| old source count (19) | clean |
| old claim count (27) | clean |
| old evidence cutoff | **was present (2026-07-17 subtitle); fixed** |
| stale "financials not retrieved" language | clean |
| stale ownership structure | clean (ARES-primary; ZenX 45.8% present) |
| resolved question shown as open | clean ("Vyřešeno …" dated correctly) |
| superseded claim shown as live | clean (table + overview count 49 live) |
| old graph manifest | clean |
| broken object link | clean (8/8 JS assets 200; claim routes 200) |
| internal filesystem path | clean |
| localhost URL | clean |

## Responsive journey (Playwright, against production)

All required viewports **PROVEN** — 37/37 tests, no overflow, no console errors:

| Viewport | / | /dossier/ | /dossier/claims/ | clm-22 | clm-52 |
|---|---|---|---|---|---|
| 390×844 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 768×1024 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 1440×900 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 1920×1080 | ✓ | ✓ | ✓ | ✓ | ✓ |

Object route `/dossier/claims/clm-52/` (prod, HTTP 200) exposes the canonical
record verbatim: CLM-52, VERIFIED_PRIMARY, ZenX Capital 45.8%.

## Layer status

| Layer | Snapshot | Hash | Counts match | Routes match | Production | Status |
|---|---|---|---|---|---|---|
| Prismatic (live) | — | — | — | — | n/a — not wired (depth/19) | BLOCKED |
| Canonical | dossier.json | 375b87c5 | ✓ | ✓ | — | PROVEN |
| Generated | claims manifest | 375b87c5 | ✓ | ✓ | — | PROVEN |
| Built public | public/… | 375b87c5 | ✓ | ✓ | — | PROVEN |
| Deployed production | unable.cz | 375b87c5 | ✓ (post-deploy) | ✓ | 2026-07-18 | PROVEN (after redeploy) |

**Verdict: PROVEN** — after the cutoff fix is deployed, the production manifest
matches the approved canonical manifest (`dataHash 375b87c5`, cutoff 2026-07-18,
58=49+9 claims, 22 sources) and representative object routes expose the same
canonical records. The live Prismatic layer is BLOCKED (does not exist), which is
documented and not a regression. Retest results appended below on deploy.

## Retest after deploy (CONFIRMED)

Deployed `05a72d3` (Pages run 29658006371, success). Retested live:
- `/dossier/` subtitle: **`mezní datum evidence 2026-07-18`** ✓ === freshness
  panel **`18 July 2026`** ✓ — the dual-date self-contradiction is gone.
- sources shown: **22** ✓
- production `data/dossier/claims/manifest.json`: `evidenceCutoff 2026-07-18`,
  `dataHash 375b87c5`, `58 = 49 + 9` — **identical to canonical/built**.
- object route `/dossier/claims/clm-52/`: HTTP 200, canonical record (ZenX 45.8%).

**PROVEN.** The production manifest matches the approved canonical manifest and
representative object routes expose the same canonical records.
