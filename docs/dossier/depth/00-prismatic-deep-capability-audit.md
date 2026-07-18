# 00 — Prismatic deep capability audit

**Date:** 2026-07-18 · **Auditor:** implementation audit of `~/dev/prismatic-platform`
at commit `8ffcc2ed57` (branch `main`), reading modules/schemas/migrations/tests
directly, not docs.

**Why this document exists.** The mission requires that Prismatic — not a
throwaway crawler — be the investigation engine. Before writing anything, we had
to know exactly which Prismatic components are real, which are degraded, and
which are absent, so the deeper Able.cz layer aligns to the platform's canonical
vocabulary instead of inventing a competing one. This is that map. It is
deliberately honest about gaps; a few polished moduledocs oversell what the code
does, and this audit flags those.

## Orientation

Prismatic is a large Elixir umbrella (~90 apps). Investigation-engine
functionality is split across:

- **`apps/prismatic_dd`** — the Ecto-backed due-diligence case engine (most mature).
- **`apps/prismatic_osint_sources`** — ~130 provider adapters (ARES, justice, ISIR…).
- **`apps/prismatic_osint_core`** — orchestration, tool runner, hypothesis engine.
- **`apps/prismatic_nabla`** + `apps/prismatic/lib/prismatic/epistemic/` — the epistemic layer.
- **`apps/prismatic_cer`** — corporate entity/risk vetting + report generation.
- Storage: `prismatic_storage_kuzudb`, `prismatic_storage_meilisearch`, Postgres repo in `apps/prismatic`.

DD migrations live in `apps/prismatic/priv/repo/migrations/` (e.g.
`20260218000001_create_dd_entities_and_relationships.exs`).

## Findings by capability area

| # | Area | Maturity | Canonical file |
|---|------|----------|----------------|
| 1 | Case / investigation lifecycle | **WORKING** (two parallel impls) | `apps/prismatic_dd/lib/prismatic_dd/schemas/case_record.ex` (`dd_cases`) |
| 2 | Entity model + resolution | **WORKING** model / **PROTOTYPE** resolution | `.../schemas/entity_record.ex` (`dd_entities`; `content_hash`, `source_id`, `status: merged`) |
| 3 | Relationship / graph model | **WORKING** | `.../schemas/relationship_record.ex` (`dd_relationships`) |
| 4 | Claim / assertion / observation split | **WORKING** — strongest asset | `apps/prismatic/lib/prismatic/epistemic/assertion.ex` |
| 5 | Evidence / source / provenance / hashing | **WORKING** | `.../schemas/evidence_item.ex` (`category`/`direction` = supporting/contradicting) |
| 6 | Contradiction detection | **WORKING** | `apps/prismatic_nabla/lib/prismatic_nabla/contradiction.ex` (typed, severity-weighted, "never average away") |
| 7 | Temporal validity / events | **PROTOTYPE** | `.../schemas/dd_activity_event.ex` — event-stamped + recency, **no** bitemporal `valid_from`/`valid_to` on facts |
| 8 | Confidence / materiality / risk | **WORKING** | `.../schemas/score_card.ex` (`dd_score_cards`) |
| 9 | Hypothesis modelling | **WORKING** | `apps/prismatic_osint_core/lib/prismatic_osint_core/hypothesis/hypothesis.ex` (+ ACH strategies) |
| 10 | Frontier / task queue (Oban) | **WORKING** (no named "frontier") | `apps/prismatic_osint_core/lib/prismatic_osint_core/investigation/orchestrator.ex` |
| 11 | Public-data provider adapters | **WORKING / PRODUCTION-leaning** — breadth is the standout | `apps/prismatic_osint_sources/.../adapters/czech/ares.ex` |
| 12 | Document / PDF / OCR | **WORKING** (OCR marked `SIMULATION_OK`) | `apps/prismatic/lib/prismatic/catch/processing/document_extractor.ex` |
| 13 | Graph DB (Kuzu) | **PROTOTYPE / degraded** | `apps/prismatic_storage_kuzudb/lib/prismatic_storage_kuzudb.ex` — **disabled in prod since 2025-12-03** (GLIBC 2.38 vs 2.36); JSON fallback |
| 14 | Meilisearch | **WORKING** | `apps/prismatic_storage_meilisearch/lib/prismatic_storage_meilisearch.ex` |
| 15 | LLM agents / Nabla / epistemic protocols | **WORKING** (Nabla) / **PROTOTYPE** (personas) | `apps/prismatic_nabla/lib/prismatic_nabla/unified_epistemic_store.ex` |
| 16 | Static-site export interface | **PROTOTYPE / near-ABSENT** — biggest build gap | `apps/prismatic_dd/lib/prismatic_dd/cfo_demo/exporter.ex` (MD/HTML; `to_pdf` not implemented) |

### Adapters present for the sources this dossier needs (area 11)

ARES (`czech/ares.ex`, reference quality — real HTTPS, circuit breaker, ETS cache,
rate limit), justice.cz / commercial register (`justice.ex`, `or_registry.ex`,
`commercial_register.ex`, `rejstrik_firem.ex`), ISIR insolvency (`isir.ex`), VAT
(`dph.ex`, `nespolehlivy_platce.ex`), RDAP/DNS/WHOIS (`global/*` + `osint_network`),
certificate transparency (`crtsh.ex`, `sslmate.ex`, perimeter CT client),
procurement (`registr_smluv.ex`, `verejne_zakazky.ex`, `hlidac_statu.ex`, `uohs.ex`),
sanctions (OFAC/EU/UN). Caveat: adapter quality is uneven behind uniformly
polished moduledocs — ARES is the one to trust without a live re-check.

## Honesty flags (do not over-claim)

- **`ClaimMap` and `TraceGraph` do not exist** by those names (zero grep hits).
  Closest real analogues: `Prismatic.Epistemic.ReasoningTrace` and the
  evidence-graph tables (`20251211170000_create_evidence_graph_tables.exs`).
- **Kuzu is disabled in production**; graph path-finding runs on a JSON fallback.
- **No bitemporal fact validity** — temporal reasoning is event-stamped + recency-weighted.
- **Entity resolution is hash/source-id based**, not probabilistic matching.
- **OCR module carries a `SIMULATION_OK` marker** — verify before trusting.
- **No NDJSON/static-site artifact exporter** and **no able.cz wiring**: the
  strings `24278815`, `able.cz`, and a project-specific `dossier` are **absent**
  from `apps/`, `lib/`, `priv/`, `scripts/`. Wiring one up is greenfield.

## Reuse decision for the Able.cz dossier

The Able.cz case is **published statically** (Zola → GitHub Pages) and its
evidence was collected in prior passes (already in this repo). Running a **live**
Prismatic pipeline here would require the platform's Postgres/Oban/adapters
running with credentials, which the static-publication context does not have, and
would still hit the one component Prismatic lacks — a static-site export
serializer. So the honest integration is **schema alignment now, live wiring
later**, documented in [01](01-epistemic-derivation-layer.md):

| Prismatic canonical | This dossier's projection |
|---|---|
| `Prismatic.Epistemic.Assertion` (`claim`, `source_id`, `artifact_hash`, `confidence`) | claim record + `lineage.json` (claim → source assertion → retrieval) |
| `dd_evidence_items.direction` (supporting/contradicting) | hypothesis `supporting`/`contradicting` arrays |
| `PrismaticNabla.Contradiction` (typed, severity, never averaged) | `contradictions[]` (CON-01/02) + one frontier task each |
| `dd_hypotheses.status` | `hypotheses.json` ordinal `state` |
| `dd_score_cards` (risk, ordinal) | `risks.json` (ASSESSED, ordinal) |
| Oban frontier orchestration | `frontier.json` (prioritized tasks; priority is ASSESSED, not graph degree) |
| `cfo_demo/exporter.ex` (the missing static exporter) | `scripts/dossier/{export,derive}.mjs` — the serializer Prismatic does not have |

**Status of "Prismatic is the engine":** PARTIAL. The dossier's data model is
aligned to Prismatic's canonical schemas and its derivation layer implements the
static-export serializer Prismatic is missing. No live Prismatic pipeline ran in
this pass; no Able.cz records exist in Prismatic's database. The remaining work
to make it live is: a serializer over the `dd_*` Ecto schemas emitting these same
JSON shapes, fed by the ARES/justice/ISIR adapters against IČO 24278815.
