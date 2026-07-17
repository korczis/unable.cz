# 11 — Open questions

Unresolved after the public-source pass of 2026-07-17. Each is a lead, not a
finding.

1. **Filed financial statements** — revenue, result, assets, equity, headcount.
   In the Collection of Deeds (Sbírka listin) at justice.cz; not retrieved. Left
   `NOT_FOUND`, not estimated.
2. **Marketing vs. statutory roles** — do the marketed CTO (Lukáš Grolig) and CSO
   (Radek Juhaňák) map to any current statutory/contractual function? Juhaňák is
   a register shareholder; Grolig was not found in the register in this pass.
3. **Independent client confirmation** — the quantified client results (AAA Auto,
   Aures Holdings, Arkadia Labs) are the company's own statements.
4. **Insolvency screen** — ISIR direct query failed (HTTP 500); hlídač insolvency
   detail is login-gated. No public insolvency was found; this is a gap, **not**
   an adverse finding. Absence is not proof of absence.
5. **Sanctions / PEP** — not systematically screened against EU/CZ lists.
6. **Current cap table (2026)** — changes since the 2023 media reports and the
   2025 Blackfish acquisition; the published shareholder set here is a subset.
7. **Court-file discrepancy** — whether the company will reconcile C 85424 (its
   GDPR page) with the register's C 85425.

## How to close them
Most require authenticated register access or the company's own documents:
Sbírka listin filings, an authenticated ISIR + sanctions screen, and a current
shareholder register. Corrections and new evidence: `corrections@unable.cz`.
