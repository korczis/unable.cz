# 19 — Adversarial implementation audit

**Date:** 2026-07-18 · **Repo:** `unable.cz` @ `feat/dossier-epistemic-depth`
(`b6bcf91`) · **Method:** verify claims against exact files, commands, generated
artifacts, and tests — assume every claim is false until proven.

**Purpose.** The brief demands proof that the implementation "truly uses
Prismatic," and instructs me to *find and remove documentation that overstates
reality*. This audit does the opposite of marketing: it states, bluntly and with
reproducible evidence, what the system actually is.

## Verdict (one paragraph)

**unable.cz does not execute Prismatic — at runtime or at build time.** It is a
self-contained static-publication system: hand-curated, cited, status-labelled
evidence in one JSON file, reshaped and analysed by local Node scripts, rendered
by Zola, served as static files. Prismatic is a *separate* Elixir platform that
was **audited** (docs 00) and whose **canonical schema vocabulary was mirrored**,
but it is not imported, called, queried, or deployed by anything in this repo.
No provider ran; the evidence was gathered by manual public-source research in
prior passes. The derived epistemic layers (coverage, gaps, hypotheses, frontier,
risks) are computed by `derive.mjs`/`export.mjs`, not by Prismatic. **Nothing is
faked** — no invented entities, coordinates, magnitudes, or synthetic chart data
— but the phrase "Prismatic is the investigation engine" is, today, **aspirational,
not operative.** The prior depth docs already labelled this PARTIAL / NOT
IMPLEMENTED; this audit confirms that labelling is accurate and sharpens it.

## Proof that Prismatic is NOT wired in

| Check | Command | Result |
|---|---|---|
| No engine refs in code/config/data | `grep -rniE "prismatic\|meilisearch\|:5432\|postgres\|kuzu\|ecto\|oban\|elixir\|mix (run\|test)" scripts templates config.toml package.json data` | **0 matches** |
| No engine refs in build/CI | `grep -rniE "prismatic\|elixir\|mix \|kuzu\|meili" .github package.json` | **0 matches** |
| No live network calls in shipped JS | `grep -rniE "fetch\(\|XMLHttpRequest\|WebSocket\|https?://" scripts/dossier` | only the GraphML XML **namespace string** (`http://graphml.graphdrawing.org`), not a request |
| No able.cz case in Prismatic | `grep -rniE "24278815" ~/dev/prismatic-platform/{apps,lib,priv}` | **0** (the `able.cz` hits are the author's contact email, not an investigation) |

The build is `npm run build` = `css:build && js:build && data:build && zola build`.
`data:build` = `node export.mjs && node derive.mjs`. No stage shells out to Elixir,
Postgres, or any service. A fresh `git clone` builds the whole site offline.

## Capability-by-capability reality table

For each brief capability: is it real, where, and what is its honest status.
"Real (local)" = implemented by this repo's own scripts over the curated data.
"Prismatic" would mean the Elixir platform produced it — **none do**.

| Capability | Status | Implementation | Canonical artifact | Test | UI entry |
|---|---|---|---|---|---|
| Provider execution | **NOT IMPLEMENTED** | — | — | — | — |
| Raw evidence preservation | **PARTIAL (real)** | `cases/DD-Able-CZ-2026-07-17/sbirka-listin/*.pdf` + `.txt` (filed registry PDFs) | the PDFs themselves | none | source ledger links |
| Observation → assertion separation | **PARTIAL (projection)** | `derive.mjs` → `lineage.json` (claim→assertion→source) | `static/data/able-cz/lineage.json` | `dossier-epistemic.test.mjs` | graph inspector provenance |
| Claim normalization | **Real (local), hand-authored** | `data/dossier/able/dossier.json` `claims[]` | `claims.json` | seo/epistemic tests | "Kde stojí evidence" table |
| Entity resolution decisions | **NOT IMPLEMENTED** (asserted in prose only) | prose notes in `dossier.json` (e.g. Artstay≡Lovs&Co.) | — | — | — |
| Relationship derivation | **Real (local), hand-authored** | `dossier.json` `graph.edges[]` (each has `why`+`sources`) | `relationships.json` | edge-provenance gate | Cytoscape graph |
| Temporal validity | **PARTIAL** | `validFrom`/`firstObserved`/`validTo` on edges; no bitemporal store | edges | — | time machine |
| Contradiction detection | **Real (local), hand-authored** | `dossier.json` `contradictions[]` (CON-01/02) | `case.json` | gate 3 + `CON_NO_TASK` | identity table + frontier |
| Gap generation | **VALIDATED (derived)** | `derive.mjs` | `gaps.json` (14) | epistemic test | "Mezery v evidenci" |
| Hypothesis generation | **VALIDATED (derived, hand-seeded)** | `derive.mjs` `hypotheses[]` (4) | `hypotheses.json` | `HYP_AS_FACT` gate + test | "Hypotézy" |
| Frontier prioritization | **VALIDATED (derived)** | `derive.mjs` rule (materiality+resolvability+weak-confidence) | `frontier.json` (19) | epistemic test | "Fronta šetření" |
| Source coverage | **VALIDATED (derived)** | `derive.mjs` per-dimension rule | `coverage.json` (10 dims) | epistemic test | "Pokrytí šetření" + Chart.js |
| Agent orchestration | **NOT IMPLEMENTED** | — | — | — | — |
| Provenance export | **Real (local)** | `lineage.json` + edge `why`/`sources` | `lineage.json` | gate 1/2/5 | inspector "Why this edge" |
| Publication validation | **VALIDATED** | `validate.mjs` (7 gates) | gate report | non-vacuous PII test | `npm run data:validate` |

## What an adversary flags (and the honest response)

1. **"The data is hardcoded."** True in the literal sense: `dossier.json` is
   hand-authored. But it is **sourced** — every record carries `SRC-*` IDs and a
   retrieval date, and the filed financial/legal PDFs are preserved. It is
   *curated public-source research*, not machine-collected and not invented. The
   honest gap: it was not produced by Prismatic providers. Labelled so everywhere.
2. **"`confidence` values are made up."** The edge `confidence`
   (high/medium/low/disputed) is an author's ordinal judgement, not a computed
   metric. It is ordinal and defensible, never a fake numeric probability. The
   `derive.mjs` risks and hypotheses are likewise **ASSESSED, hand-seeded**
   editorial — each tied to a `derivedFrom` record. Flagged as ASSESSED in the
   data headers and docs; not presented as measurement.
3. **"Entity resolution is claimed but absent."** Correct — there are **no**
   resolution-candidate/decision records. Identity assertions (Artstay≡Lovs&Co.;
   Petr Faraga ≠ Václav Faraga is `NOT_FOUND`) live in prose. This is a real GAP
   vs the brief's §10; it is now recorded as such rather than dressed up.
4. **"The canonical §4 NDJSON case tree doesn't exist."** Correct — the case
   bundle is JSON, not the `observations.ndjson`/`assertions.ndjson`/
   `resolution-decisions.ndjson`/`hashes.ndjson`/`agents/runs.ndjson` layers the
   brief specifies. Those are ABSENT. The epistemic chain is *projected*
   (`lineage.json`), not *preserved raw*.
5. **"Inert UI controls."** Checked: every `gw-*` control in `graph.js` is bound
   in the toolbar click delegation (`modeSel`, layout, expand, filters, path,
   analytics, export, reset, time machine, palette). None are dead.
6. **"Synthetic chart data."** Checked: the status doughnut, coverage bar, and
   p5 field all derive counts from the real records; no hardcoded series.
7. **"Docs overstate Prismatic."** Checked all docs. `docs/dossier/01-prismatic-
   tooling-inventory.md` already says the live DBs/adapters were **not** invoked;
   the depth docs label the pipeline PARTIAL / NOT IMPLEMENTED. **One correction
   applied:** that older doc listed "ČÚZK" among observed Prismatic Czech-register
   adapters — the capability audits could not confirm a ČÚZK/cadastre adapter (see
   `docs/dossier/cadastre/00`), so that claim is qualified there.

## Removed / corrected in this pass

- No hardcoded *fake* records were found to remove (the curated data is real and
  sourced; removing it would delete the dossier).
- Corrected the unverified "ČÚZK adapter" mention (see cadastre/00).
- Added this document so the "Prismatic is the engine" framing can never be read
  as "Prismatic runs here." It does not.

## The honest path to "Prismatic is the engine" (not done here)

A serializer inside `apps/prismatic_dd` emitting these exact JSON shapes from the
`dd_*` Ecto schemas, fed by the ARES/justice/ISIR adapters against IČO 24278815,
persisted in Prismatic's Postgres, exported to `static/data/able-cz/`. That makes
the claim operative. Until then: **PARTIAL — schema-aligned, not engine-driven.**
