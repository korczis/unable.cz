# 00 — Financial content audit (before the finance layer)

**Date:** 2026-07-18.

The dossier already held filed financial figures for Able.cz, sourced to the
filed FY2024 statement (Sbírka listin, SRC-15), inside `data/dossier/able/dossier.json`
`financials`: **11 VERIFIED_PRIMARY** metrics (registered capital + revenue, net
turnover, net result, total assets, equity, liabilities, personnel costs,
purchased services, stakes in controlled entities, liabilities to shareholders —
each FY2024/FY2023), **4 SELF_REPORTED** (combined ~100M target, ~60 headcount,
4 tenders, >20M contract value) and **4 NOT_FOUND** (employee count, auditor
report, going-concern, consolidated group accounts).

**Defects the finance layer fixes:** the figures were prose+table only — no
first-class fact objects, no stable route, no derived-metric formulas, and the
~100M combined *target* sat next to the 36.3M *filed* result without an explicit
"forward-looking, different perimeter" reconciliation. Filed fact, calculated
metric and company claim were visually mixed.
