# 05 — Claim classification

Every factual statement is assigned exactly one status. They are **never**
collapsed into a single score.

| Status | Definition | Example in this dossier |
|---|---|---|
| `VERIFIED_PRIMARY` | Directly supported by a primary/authoritative source. | IČO, seat, incorporation, court file C 85425 (ARES). |
| `CORROBORATED` | Two or more independent sources agree. | 2025 Blackfish acquisition (CzechCrunch + Forbes). |
| `SELF_REPORTED` | Asserted by the company/affiliate; not independently verified. | 300% ROI, 150+ AI agents, named client results. |
| `ASSESSED` | Analytical reading of cited evidence; never a bare fact. | The court-file discrepancy is "most plausibly a transcription error." |
| `CONTRADICTED` | Credible sources materially disagree. | Court file: C 85424 (company) vs C 85425 (register). |
| `NOT_FOUND` | Searched in public sources; unresolved in this pass. | Filed revenue/result/assets/headcount; insolvency. |
| `UNKNOWN` | Public evidence does not resolve the question. | (reserved) |

## What a reader must be able to answer per claim
- Where did it come from? → `sources[]` → source ledger.
- How current is it? → source `retrievedAt` / evidence cutoff.
- Is it confirmed? → status.
- Is there contradiction? → `contradictions[]`.
- Which entity? → `subject` / graph.
- What would falsify it? → for SELF_REPORTED, an independent primary source; for
  CONTRADICTED, reconciliation of the two values.

## Distinctions kept explicit
Failure to find evidence ≠ evidence of absence ≠ allegation ≠ confirmed event ≠
opinion ≠ inference. The dossier's disclaimer states this directly.
