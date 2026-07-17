# 02 — Investigation plan

## Target
Resolve and review the legal entity behind **able.cz** using public evidence.

## Identity resolution (done)
able.cz → **Able.cz s.r.o., IČO 24278815** (Brno), fixed by matching the
company's own site to the ARES register. Not assumed from the name pun.

## Dimensions and outcome in this pass
| Dimension | Plan | Outcome |
|---|---|---|
| Corporate identity | ARES + mirrors | VERIFIED_PRIMARY |
| Governance | Statutory body, shareholders, supervisory board | VERIFIED_PRIMARY (+ marketing vs statutory distinction) |
| Financials | Sbírka listin filings | Only registered capital retrieved; rest NOT_FOUND |
| Insolvency | ISIR | Query failed (HTTP 500); NOT_FOUND |
| Sanctions/PEP | EU/CZ lists | Not screened this pass (open question) |
| Web/technical | able.cz HTTP, legal pages | Retrieved; footer legal links found |
| Reputation/media | CzechCrunch, Forbes | Valuation/investor + Blackfish (CORROBORATED) |
| Commercial claims | able.cz marketing | SELF_REPORTED (14 of 15 claims) |
| Timeline | Corporate + media events | 4 dated events |

## Deliverables
- Canonical evidence: `data/dossier/able/dossier.json`.
- Web exports: `static/data/able-cz/*.json`.
- Case bundle: `cases/DD-Able-CZ-2026-07-17/`.
- Published page: `/dossier/` with status chart, relationship graph, evidence
  field, identity/financials/sources tables.

## Guardrails
Public sources only; status-labelled; no insolvency/wrongdoing asserted;
corrections path published. See `08-legal-editorial-guardrails.md`.
