# 15 — Final implementation report: evidence-completion phase (2026-07-18)

Transformation delivered: claims-with-source-references → claim → normalized
assertion → exact passage/row → preserved artifact → SHA-256 → canonical
source → provider run → publication-safe viewer.

## Numbers (all verifiable in-repo)

| # | Item | Count / status |
|---|------|----------------|
| 1 | Claims audited | 27 original + 31 added/split = 58 (49 live) |
| 2 | Relationships audited | 60 edges (48 original relinked/upgraded, 12 added) |
| 3 | Missing artifacts found (audit) | 13 of 19 sources had none |
| 4 | Artifacts retrieved this phase | 54 content-addressed files (ARES ×44 incl. searches, snapshots ×3, DNS ×3, CT, VIES, Registr smluv ×2) |
| 5 | Artifacts blocked | ISIR (HTTP 500 ×2), LinkedIn (terms), Point FM (JS-rendered, unusable) |
| 6 | Artifacts preserved total | 62 registered (54 new + 8 legacy Sbírka listin files) + 4 hash-only media/probe records |
| 7 | Hashes generated | every artifact + every published copy re-verified at build/test |
| 8 | Documents parsed | 5 PDFs (2 Blackfish extractions newly generated) + 38 ARES records |
| 9 | Exact citations created | 18 document spans + 10 web spans + 453 assertions (COMPLETE on 47/49 live claims) |
| 10 | Claims split | 9 superseded → 24 children (08-claim-splitting-report.md) |
| 11 | Claims relinked | 49/49 live claims carry resolved evidence links |
| 12 | Relationships relinked | 28 edges upgraded to VERIFIED_PRIMARY; 3 CONTRADICTED edges resolved; predicates added |
| 13 | Aggregator sources replaced | all register facts → SRC-12 primary artifacts |
| 14 | Aggregator retained | 1 (signing rule) — labelled with caveat |
| 15 | Financial evidence | 11 metrics with per-row citations; revenue/turnover conflation corrected |
| 16 | Legal evidence | execution order + termination quoted verbatim (6 instruments); cause moved to ASSESSED |
| 17 | Acquisition evidence | transaction:able-blackfish-2025 record; register dates 2025-07-28/29; reciprocal 5.00 % primary-verified |
| 18 | Client claims independently confirmed | 0 (unchanged — honestly none found; contracts register returned zero) |
| 19 | Public contracts / grants | Registr smluv: zero for both IČOs (preserved); grants registers still open |
| 20 | Source families | 9 (mirrors never independent) |
| 21 | Broken links fixed | SRC-03 URL corrected; SRC-22 null-URL honesty record; dead API endpoints superseded |
| 22 | Stale gaps resolved | 4 (RQ-01..04) incl. the "statements not retrieved" gap and its stale risk-register echo |
| 23 | Tasks resolved | planner regenerates from live data; contract's task queue realized as planner tasks + provider-run ledger |
| 24 | Evidence viewer | inspector (exact passage, artifact hash, source, runs), inline citations, deep links — browser-validated |
| 25 | Provenance | claim→span/assertion→artifact→source→run drillable in UI; families + availability surfaced |
| 26 | Validation | verify green: 0 validator errors, 0 SEO errors |
| 27 | Browser tests | 12 flows PASS, 0 console errors (14-browser-validation.md) |
| 28 | Performance | lazy shards; 3 MB artifacts only on demand (13-performance-report.md) |
| 29 | Files changed | ~200 across 4 commits this phase |
| 30 | Commits | 9c99b53 (raw evidence layer), 57fbf68 (primary enrichment), evidence-explorer commit, docs/final commit |
| 31 | Local URL | `npm run dev` → http://127.0.0.1:1111/dossier/ (for static serving use `zola build --base-url` — see 14) |
| 32 | Production URL | https://unable.cz/dossier/ after merge to main |

## Labels

- IMPLEMENTED+VALIDATED: retrieval+preservation pipeline, assertion
  extraction, exact citations, claim splitting/relinking, status
  recalculation, source families, availability monitoring, public exports,
  evidence inspector UI, inline citations, deep links, validation gates,
  tests, browser flows.
- PARTIAL: per-cell buttons in the static financial table (claims-level
  today); edge-row inspector buttons; document diffing (single snapshot
  generation — versioning is in place, diffs need a second capture);
  grants/Hlídač API sweep.
- BLOCKED: ISIR (provider 500), LinkedIn (terms), 2023 CzechCrunch URL
  (lost by earlier pass).
- NOT IMPLEMENTED (documented): moving restricted PDFs out of the public
  repo history; make-targets (npm scripts exist instead: evidence:fetch /
  evidence:parse / evidence:build).

## Reproduction

```sh
npm ci
npm run evidence:fetch            # re-fetch (append-only ledger; idempotent manifests)
npm run evidence:parse            # deterministic assertion extraction
npm run verify                    # build + evidence verify + gates + SEO + tests
zola build --base-url http://localhost:8899   # for local browser validation
```

## Session note

A parallel workstream committed intermediate states of this phase (9c99b53,
57bf68) and added the cockpit layer concurrently; no conflicts resulted, and
nothing in this report claims that work beyond what this phase produced.
