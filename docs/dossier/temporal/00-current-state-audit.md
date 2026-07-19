# Temporal current-state audit (PROMPT-09, phase 1)

Audited: 2026-07-19, repo `unable.cz` @ `04890c4`, platform `~/dev/prismatic-platform`.

## 1. What already exists

### Immutable substrate (real, build on this)

| Store | Path | Semantics |
|---|---|---|
| Provider runs | `cases/DD-Able-CZ-2026-07-17/provider-runs.ndjson` | Append-only; real wall-clock `startedAt`/`finishedAt`, `httpStatus`, `sha256`, `outcome`. |
| Artifact manifest | `cases/…/artifacts/manifest.ndjson` | Append-only; `retrievedAt`, `sha256`, `pubClass`. |
| Artifact bytes | `cases/…/artifacts/sha256/<xx>/<hash>` | Content-addressed, never overwritten (`fetch-evidence.mjs` writes only if absent). |
| Extraction manifest | `cases/…/extraction/manifest.ndjson` | Append-only run log with `parserVersion`. |
| Git history | this repo | Every published canonical state of `data/dossier/able/dossier.json` is recoverable; each was actually deployed to production by `deploy.yml`. |

### Deterministic-but-destructive derived layer

Every generator in `data:build` (`export.mjs → evidence.mjs → derive.mjs → cadastre.mjs → planner.mjs → claims-gen.mjs → finance-gen.mjs`) **overwrites** its outputs under `static/data/**` each run. All `_export` headers stamp `generatedAt = meta.evidenceCutoff` (deterministic, byte-identical on re-run — good for hashing, useless as a change marker). `claims-gen.mjs` `rmSync`s all `content/dossier/claims/clm-*.md` before regenerating — a claim removed from canonical loses its route with no tombstone.

### Prismatic platform inventory (concept reuse only)

`~/dev/prismatic-platform` has **no** dossier-snapshot CLI and no unified temporal model. Honest inventory:

- `PrismaticDd.Schemas.EntityAttribute` / `RelationshipRecord` — fact rows with `source`, `confidence`, `valid_from`, `valid_until`. Valid-time only; no transaction-time axis anywhere in the platform.
- `Prismatic.PromptLibrary.Version` + `ContentHash` — draft/published/superseded lifecycle over a canonicalized content hash that ignores cosmetic edits.
- `Prismatic.Evidence.Snapshot` — Merkle-root snapshot with inclusion proofs (struct, not persisted).
- `prismatic_prisc` hash-chained event store; `audit_versions` paper-trail table.
- Absent: bitemporal schemas, freshness/revalidation model, persisted provider-run entity, revision diffing, any `observed_at`/`retrieved_at` schema field.

Consequence: the temporal engine lives in this repo (`scripts/dossier/temporal/`), reusing Prismatic's three sound concepts — fact rows with valid-time, canonical content hashing with a published/superseded lifecycle, and a Merkle-flat snapshot hash — and this repo's own append-only evidence substrate. No second, competing snapshot model is introduced: the dossier previously had **none**.

## 2. Per-object temporal inventory

Legend: ✔ present · ✖ absent · ~ free-text only.

| Object | stable ID | revision chain | content hash | valid-time | observed/retrieved | verified | superseded | snapshot membership |
|---|---|---|---|---|---|---|---|---|
| claims (58) | ✔ CLM-* | ✖ (only latest `supersededBy`) | ✖ (fnv in derived shard only) | ✖ | ✖ | ✖ | ✔ flag+reason | ✖ |
| sources (22) | ✔ SRC-* | ✖ | ✖ | n/a | ✔ `retrievedAt` | ✖ | ✖ | ✖ |
| identity (11) | ✖ (keyed by field text) | ✖ | ✖ | ~ in `value` prose | ✖ | ✖ | ✖ | ✖ |
| governance roles | ✖ | ✖ | ✖ | ~ `since`/`until` free text | ✖ | ✖ | ✖ | ✖ |
| shareholders | ✖ | ✖ | ✖ | ~ whole ownership series packed into ONE `since` string | ✖ | ✖ | ✖ | ✖ |
| contradictions (3) | ✔ CON-* | ✖ | ✖ | ~ resolution date in prose | ✖ | ✖ | ✖ | ✖ |
| openQuestions (12) | ✖ (bare strings) | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| resolvedQuestions (4) | ✔ RQ-* | ✖ | ✖ | ✔ `resolvedAt` | ✖ | ✖ | ✖ | ✖ |
| timeline (11) | ✖ | ✖ | ✖ | ✔ `date` (real-world) | ✖ | ✖ | ✖ | ✖ |
| transactions (1) | ✔ | ✖ | ✖ | ✔ `effectiveInRegister.*` + ~ `announced` | ✖ | ✖ | ✖ | ✖ |
| graph nodes (43) | ✔ `data.id` | ✖ | ✖ | ✔ `validFrom` (some) | ✖ | ✖ | ✖ | ✖ |
| graph edges (60) | ✔ `data.id` | ✖ | ✖ | ~ `firstObserved`/`lastObserved` (see D4) | ✖ (misnamed) | ✖ | ✖ | ✖ |
| financial facts | ✖ (keyed by metric) | ✖ | ✖ | period in metric text | ✖ | ✖ | ✖ | ✖ |
| provider runs | ✔ runId | append-only ✔ | ✔ sha256 | n/a | ✔ real timestamps | n/a | n/a | ✖ |
| evidence spans | ✔ EVD-* | ✖ | via artifact sha256 | n/a | via artifact | ✖ | ✖ | ✖ |
| narrative (`content/dossier.md`) | route | git only | ✖ | ✖ | ✖ | `reviewed_at` front matter | ✖ | ✖ |

## 3. Destructive-update risks found

- **D1 — no retained prior manifests.** Every `static/data/**` file is regenerated in place; "what did the dossier say last week" is answerable only via git archaeology, not via the published site.
- **D2 — `generatedAt` = cutoff stamp.** Carries no information about when regeneration happened; cannot mark change.
- **D3 — one global `evidenceCutoff` fanned onto every fact.** Per-fact freshness survives only where `retrievedAt` exists (sources, lineage).
- **D4 — mixed date semantics.** `graph.edge.firstObserved` actually holds the **real-world effective date** (e.g. `e1: firstObserved 2012-10-03` = date Faraga became jednatel), not an observation date. JSON-LD `temporalCoverage` = cutoff conflates coverage with retrieval.
- **D5 — ownership history collapsed into prose.** ZenX `since`: `"14 October 2020 (initially 50 %; 47.5 % from 28 Aug 2023; 48.2 % from 14 Nov 2024; 45.80 % since 29 Jul 2025)"` — a real dated series in one mutable string.
- **D6 — claims have no dated history.** In-place text/status edits would vanish silently; supersession records only the latest hop.
- **D7 — routes deleted without tombstone.** `claims-gen.mjs` rm+regenerate; a renumbered claim 404s with no record.
- **D8 — gaps/contradictions can disappear silently.** `derive.mjs`/`export.mjs` recompute from current state; RQ-01's own text documents a stale-gap defect that this class of bug already produced once.
- **D9 — `reviewed_at` misplaced.** `cases/…/corrections/README.md` says corrections bump `reviewed_at` in dossier.json; no such field exists there — it lives in `content/dossier.md` front matter, decoupled from data changes.
- **D10 — orphaned stale copies.** `cases/…/reports/metadata.json` (cutoff 2026-07-17, claims 15) and `case.yaml` (cutoff 2026-07-17) diverge from canonical (2026-07-18, claims 58 issued / 49 live). Accidental snapshots, uncontrolled.
- **D11 — CI deploys committed derived data.** `deploy.yml` never runs `data:build`/`data:validate`; local regeneration + commit is the actual publication step. (Kept as-is by design; the temporal validator must therefore gate **committed** data.)

## 4. Recoverable publication history (basis for snapshot bootstrap)

Every commit below changed `data/dossier/able/dossier.json` and was deployed to production. These are the *real* prior public snapshots; nothing needs to be invented:

| seq | commit | committed at (CET) | cutoff | claims | sources | note |
|---|---|---|---|---|---|---|
| r01 | `cc56717` | 2026-07-17 18:27 | 2026-07-17 | 15 | 6 | first published dossier |
| — | `186ea29` | 2026-07-17 19:43 | — | — | — | **withdrawal**: dossier removed from publication |
| — | `db36129` | 2026-07-17 19:51 | 2026-07-17 | 15 | 6 | re-established, byte-identical canonical to r01 |
| r02 | `01aadea` | 2026-07-17 19:55 | 2026-07-17 | 15 | 9 | digital footprint (DNS/VAT/TLS) |
| r03 | `8004298` | 2026-07-17 21:17 | 2026-07-17 | 27 | 19 | ownership network + Sbírka listin |
| r04 | `9c99b53` | 2026-07-18 07:59 | 2026-07-17 | 58 | 22 | raw evidence layer preserved |
| r05 | `57fbf68` | 2026-07-18 08:09 | 2026-07-17 | 58 | 22 | primary-source enrichment, resolved contradiction |
| r06 | `f9fc4dc` | 2026-07-18 08:43 | 2026-07-17 | 58 | 22 | SRC-22 recovery, adversarial audit fixes |
| r07 | `05a72d3` | 2026-07-18 21:32 | 2026-07-18 | 58 | 22 | cutoff converged to 2026-07-18 |

HEAD (`04890c4`) carries canonical content identical to r07 — the correct no-op case for snapshot creation.

## 5. Decision

Implement in `scripts/dossier/temporal/` (documented in `01-temporal-model.md` onward):
immutable snapshot manifests + frozen object revisions bootstrapped from the real git publication history above; a semantic field-level diff producing first-class change objects; freshness/revalidation projections; and validation gates wired into `npm run verify`. Defects D1–D10 are addressed by the new layer; D11 is documented and gated by the temporal validator running over committed data.
