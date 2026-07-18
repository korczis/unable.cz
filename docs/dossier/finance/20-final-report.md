# 20 — Financial-intelligence layer: final report

**Date:** 2026-07-18. Labels: IMPLEMENTED / VALIDATED / PARTIAL / BLOCKED / NOT IMPLEMENTED.

## Architectural honesty first

Prismatic is **not live-wired** (established across prior audits); the dossier's
financials were hand-collected. So **live document acquisition, OCR and new
provider runs are BLOCKED** this pass. The honest deliverable is a structured,
value-cited financial layer **derived from the already-sourced filed figures** —
it restructures and reconciles, it does not fetch new documents or invent values.

## IMPLEMENTED & VALIDATED

- **Financial facts** (`static/data/dossier/finance/facts.json`) — 21 first-class
  facts parsed from the sourced `financials` block: each `{id, entity, concept,
  originalLabel, period, value, unit, status:FILED_FACT, sources}`. Units correct
  (thousand CZK vs base CZK for registered capital); periods FY2024/FY2023.
- **Derived metrics** (`metrics.json`) — 8, each with an explicit **formula** and
  the **fact IDs** it is computed from: net-turnover growth −15.7 %, net margin
  1.7 %/2.0 %, equity ratio 37 %, leverage 1.70, related-party share 22.2 %,
  **purchased-services share 106.6 %** (contractor-heavy signal, labelled ASSESSED
  in its caveat), personnel share 8.1 %. Metrics compute only from compatible facts.
- **Balance-sheet reconciliation** — `assets ≈ equity + liabilities`:
  PASSED_WITH_ROUNDING (71,880 vs 71,775; diff 105 = accruals, filed values not mutated).
- **Public claim vs filed** — the ~100M figure is classified **TARGET
  (forward-looking)** with **periodMismatch + perimeterMismatch** vs the 36.3M
  Able-only FY2024 filed turnover; never compared as a historical result.
- **Gaps** — the 4 NOT_FOUND lines as explicit gaps (NOT_FOUND / NOT_PUBLIC),
  never zero.
- **Route** `/dossier/finance/` — a complete static page (facts table, metrics
  with formulas, reconciliation, claim-vs-filed, gaps, methodology), linked from
  the dossier's financials section ("Otevřít úplnou finanční analýzu →").
- **Validator** (`finance-validate.mjs`, wired into `data:validate`) + 5 tests
  (`dossier-finance.test.mjs`): facts sourced, metrics resolve, target flagged,
  gaps never zero, PII/internal-path sweep; a planted orphan-fact metric fails
  the gate (non-vacuous). verify green: 0 errors, 83 tests.

## PARTIAL / NOT IMPLEMENTED (labelled)

- Live provider/document acquisition, OCR, artifact preservation for NEW
  documents — **BLOCKED** (no live Prismatic). Blackfish/subsidiary facts,
  `/finance/statements|entities|documents` sub-routes, per-fact routes, charts,
  and graph integration — **NOT IMPLEMENTED** this pass.
