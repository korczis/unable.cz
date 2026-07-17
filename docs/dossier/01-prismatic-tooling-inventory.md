# 01 — Prismatic tooling inventory

`~/dev/prismatic-platform` is a large Elixir/OTP umbrella intelligence platform
(OSINT, due diligence, decision engine). It is the **investigation layer**;
unable.cz is the **publication layer**. This file records what was inspected and
what was reused.

## What Prismatic provides (observed)
- A monorepo of OTP applications for OSINT and DD, with source adapters for
  Czech registers (ARES, ČÚZK, ISIR, Sbírka listin, justice.cz) and
  international sources (sanctions, corporate registries).
- Existing DD **cases** under `cases/` (e.g. `DD-MA-CEZ-GasNet-2026-05-14`,
  `DD-AK-Prochazka-Brno-2026-05-03`), a `CASE_GENERATOR.md`, and an `index.yaml`
  — a case-bundle convention this dossier mirrors.
- A doctrine/governance system (24 pillars) enforcing quality and language.

## Integration decision
Per the brief, unable.cz must **not** duplicate Prismatic, and Prismatic must not
absorb the site. They integrate through **reproducible generated artifacts**:

```
Prismatic-style case bundle  ──►  normalized JSON  ──►  static dossier build
(cases/DD-Able-CZ-2026-07-17)     (static/data/able-cz)   (unable.cz /dossier/)
```

## What was reused vs. built here
- **Reused (convention):** the case-bundle layout (`entities/`,
  `relationships/`, `evidence/`, `claims/`, `sources/`, `timelines/`,
  `reports/`, `methodology/`, `unresolved/`, `corrections/`, `logs/`,
  `exports/`), and the evidence-status discipline.
- **Built here (this repo):** the actual evidence collection for Able.cz was
  performed with public web retrieval (ARES REST, company site, register
  mirrors, media), because this pass runs inside the static-site repo without
  live Prismatic DB/credentials. The dossier is therefore reproducible from a
  fresh checkout without a running database — a hard requirement of the brief.

## What was NOT used
- Prismatic's live PostgreSQL/Timescale/Meilisearch/graph databases and its
  paid/authenticated adapters were **not** invoked in this pass. Anything they
  would have supplied (filed financials, authenticated ISIR, sanctions screen)
  is marked `NOT_FOUND` here, not estimated.
