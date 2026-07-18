# 11 — Source availability report (2026-07-18)

Latest check per URL (static/data/able-cz/evidence/availability.json):
53 AVAILABLE · 2 BLOCKED · 2 INVALID · 1 UNKNOWN.

- BLOCKED: ISIR lustrace (HTTP 500 on 2026-07-17 and 2026-07-18) — surfaced
  as CLM-58 and in the UI's "Nedostupné zdroje"; LinkedIn (terms — not
  fetched by policy).
- INVALID: the smlouvy.gov.cz `/api/v2` endpoints (404) — superseded by the
  working server-rendered search, which is AVAILABLE and preserved.
- UNKNOWN: crt.sh (flaky; the second batch attempt failed) — a successful
  artifact from the first batch IS preserved, so evidence is intact; only the
  latest liveness probe is inconclusive.
- SRC-22 (2023 CzechCrunch article): initially recorded as URL-lost, then
  recovered from DATA_PROVENANCE.md during the adversarial audit; live
  (HTTP 200), re-fetched and hash-preserved 2026-07-18.

Fallbacks: every register/filing fact carries a preserved artifact, so a dead
upstream link never leaves a claim unverifiable; the UI's inspector links the
preserved copy alongside the source URL.
