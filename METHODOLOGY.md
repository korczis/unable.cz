# Methodology

How the `/dossier/` review of **Able.cz s.r.o. (IČO 24278815)** was produced, and
how to reproduce it.

## Scope
Public-source (OSINT) due diligence, authorized by the site owner on the record
(2026-07-17; see [AGENTS.md](AGENTS.md) → *Content about real parties*). No data
room, interviews, contracts, bank records, tax files, or source code were
available. Public evidence does not substitute for them.

## Evidence status taxonomy
Every statement carries exactly one status, and they are never collapsed into a
single score:

| Status | Meaning |
|---|---|
| `VERIFIED_PRIMARY` | Directly supported by a primary/authoritative source (e.g. ARES). |
| `CORROBORATED` | Two or more independent sources agree. |
| `SELF_REPORTED` | The company's own statement; not independently verified. |
| `ASSESSED` | An analytical reading of cited evidence — never a bare fact. |
| `CONTRADICTED` | Credible sources materially disagree. |
| `NOT_FOUND` | Searched in public sources; unresolved in this pass. |

Risk **severity** is shown separately from evidence **confidence**: a
high-severity risk with low confidence is not a confirmed severe issue.

## Source tiers (priority order)
1. Official registries — ARES, justice.cz, ISIR.
2. The company's own pages — able.cz, `/legal/gdpr`.
3. Independent media — CzechCrunch, Forbes.
4. Registry mirrors / aggregators — kurzy.cz, hlídač státu.

A lower-tier lead is never promoted to a confirmed finding on its own. Failed
retrievals are recorded, not omitted (see `DATA_PROVENANCE.md`; the ISIR
insolvency query returned HTTP 500 and is logged as such).

## Identity resolution
able.cz → Able.cz s.r.o. was fixed by matching the company's own site details to
the ARES register — **not** by the "unable/able" name pun. The relationship is
asserted only where the register and the site agree.

## Data flow
```
data/dossier/able/dossier.json     # single source of truth (hand-authored, sourced)
        │  load_data (Zola)                │  node scripts/dossier/export.mjs
        ▼                                  ▼
templates/dossier.html  ──►  /dossier/     static/data/able-cz/*.json  (downloadable exports)
```
The three figures (Chart.js status doughnut, Cytoscape relationship graph, p5
evidence field) are progressive enhancements over always-present data tables.

## Reproduce
```
npm install
npm run data:build                # export.mjs (reshape) + derive.mjs (epistemic layer)
npm run data:validate             # evidence-integrity gate
npm run build                     # css + js + data + zola  -> ./public
npm run seo:validate && npm test  # gates (must be green)
```

The epistemic projections — coverage, gaps, hypotheses, and the investigation
frontier — are **derived** from the same sourced records, never hand-authored;
every derived row traces back to a dossier record via `derivedFrom`, and the gate
fails the build if that provenance is broken or a hypothesis is presented as a
fact. See [docs/dossier/depth/](docs/dossier/depth/).

Since 2026-07-18 the dossier also carries a verified **evidence layer**:
`npm run evidence:fetch` preserves sources content-addressed (SHA-256, every
run logged), `evidence:parse` extracts register assertions deterministically,
and `scripts/dossier/evidence.mjs` (part of `data:build`) verifies the whole
chain — artifact hashes, exact citations, claim links, publication classes —
and fails the build on any mismatch. See
[docs/dossier/evidence/](docs/dossier/evidence/03-evidence-data-model.md).

## Limitations
See [docs/dossier/11-open-questions.md](docs/dossier/11-open-questions.md) and
the per-source notes in [DATA_PROVENANCE.md](DATA_PROVENANCE.md). This review
asserts no insolvency or wrongdoing — none was found.

## Temporal integrity (added 2026-07-19)

Valid time (when a fact applied in the world) and system time (when this
investigation knew it) are recorded separately end-to-end; discovery dates are
never presented as event dates. All previously published states are preserved
as immutable snapshots and every material difference between them is an
auditable change record linking to the evidence that caused it. Freshness is
policy-based: evidence quality never decays, currentness does; BLOCKED
providers stay BLOCKED until a query actually succeeds. See
docs/dossier/temporal/.

## Explicit reasoning (added 2026-07-19, PROMPT-10)

Analytical judgments (ASSESSED claims, financial assessments, risks) are no
longer terminal labels: each carries a published inference record with
premises, steps, declared assumptions, at least one alternative explanation
with the evidence needed to distinguish it, counterfactuals (what would
falsify/strengthen/weaken), and remaining uncertainty. Confidence is expressed
as a six-dimensional diversity vector (sources, evidence, documents, upstream
families, jurisdictions, time span) with an explicit monoculture flag — never
a single number. Conflicting sources are represented two-sided with a named
resolution state. The reasoning objects are snapshot-tracked, so changed
reasoning is auditable history.
