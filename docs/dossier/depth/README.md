# Dossier — depth layer

This directory documents the **deeper investigation layer** added on 2026-07-18:
the epistemic derivation pipeline (coverage, gaps, hypotheses, frontier),
its integrity gate, and the honest boundary with the Prismatic platform.

It is scoped to what was **actually built and validated**, using explicit status
labels, rather than restating the mission brief as if done. The brief enumerated
a large aspirational document set and feature list; this layer implements a
coherent, fully-honest **vertical slice** of it and labels the rest.

## Documents

- **[00 — Prismatic deep capability audit](00-prismatic-deep-capability-audit.md)**
  — what exists in `~/dev/prismatic-platform`, with maturity labels, honesty
  flags, and the schema-alignment/reuse decision.
- **[01 — Epistemic derivation layer](01-epistemic-derivation-layer.md)** — the
  observation/assertion/claim separation, coverage matrix, gap analysis,
  hypothesis layer, investigation frontier, provenance index, and integrity gate.
- **[02 — Final report](02-final-report.md)** — the §45 report: what was reused,
  built, validated, and explicitly not done, with reproduction commands.

Foundational model docs (data model, source policy, claim classification, UI,
guardrails) remain under [`docs/dossier/`](../) and are unchanged.

## Mission-brief coverage (honest status)

| Brief area | Status | Where |
|---|---|---|
| Deep Prismatic audit | **IMPLEMENTED** | [00](00-prismatic-deep-capability-audit.md) |
| Observation/assertion/claim separation | **IMPLEMENTED** (as derived projection) | [01](01-epistemic-derivation-layer.md), `lineage.json` |
| Source coverage & coverage matrix UI | **IMPLEMENTED & VALIDATED** | `coverage.json`, dossier "Pokrytí šetření" |
| Gap analysis + UI | **IMPLEMENTED & VALIDATED** | `gaps.json`, "Mezery v evidenci" |
| Hypothesis layer + UI | **IMPLEMENTED & VALIDATED** | `hypotheses.json`, "Hypotézy" |
| Investigation frontier + UI | **IMPLEMENTED & VALIDATED** | `frontier.json`, "Fronta šetření" |
| Contradiction preservation | **IMPLEMENTED** (pre-existing CON-01/02, now with tasks) | `case.json`, gate 7 |
| Evidence-integrity gate + privacy filter | **IMPLEMENTED & VALIDATED** | `validate.mjs`, `npm run data:validate` |
| Provenance / lineage | **IMPLEMENTED** | `lineage.json`, graph inspector |
| Temporal model (interactive time machine) | **PARTIAL** (pre-existing `validFrom`/`firstObserved`; no bitemporal store) | `graph.js`, `timeline` |
| Chart.js analytics (coverage) | **IMPLEMENTED** | `client.js` coverage bar |
| Public/analyst/forensic export split | **PARTIAL** (public export is the shipped one; raw case files under `cases/` are the analyst/forensic tier) | `static/data/able-cz/`, `cases/DD-Able-CZ-*` |
| Live Prismatic pipeline / new providers executed | **NOT IMPLEMENTED** (static-publication context; documented boundary) | [00](00-prismatic-deep-capability-audit.md) |
| Meilisearch / Kuzu / Three.js / p5 upgrades | **NOT IMPLEMENTED** (Kuzu is disabled in Prismatic prod; not introduced here) | [00](00-prismatic-deep-capability-audit.md) |
| New facts about Able.cz | **REJECTED by policy** — no new evidence collected; nothing may be invented | `AGENTS.md` |

Status vocabulary: **IMPLEMENTED** (built, runs), **VALIDATED** (built + a test/
gate proves it), **PARTIAL** (a defensible subset), **NOT IMPLEMENTED** (not done,
with the reason), **REJECTED** (deliberately not done on policy grounds).
