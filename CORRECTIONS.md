# Corrections

The `/dossier/` review of Able.cz s.r.o. reflects **public evidence available at
a stated cutoff** (currently 2026-07-17). Sources can be incomplete or wrong, and
findings may change. Affected parties and readers may submit corrections.

## How to submit
**Email:** corrections@unable.cz

Please include, where possible:
- the claim or evidence ID (e.g. `C-14`, `CON-01`, `S-03`, or an identity field);
- the correction and why it is correct;
- a citable public source.

## How corrections are handled
1. The submission is acknowledged and dated.
2. The cited sources are re-checked against the primary record.
3. If upheld, `data/dossier/able/dossier.json` is updated and `reviewed_at` is
   bumped — **only after** the sources are actually re-verified, never
   mechanically (see [AGENTS.md](AGENTS.md), rule 5).
4. Material corrections are noted below and in the case log
   (`cases/DD-Able-CZ-2026-07-17/corrections/`).

## Editorial stance
No inference in the dossier should be read as a judicial finding. Analytical
readings are labelled `ASSESSED` and kept separate from fact. The dossier makes
no assertion of insolvency, wrongdoing, or inability to pay.

## Log

### 2026-07-18 — primary-source evidence pass (self-initiated)

The evidence-completion pass replaced register mirrors with preserved primary
ARES/VR records for all 19 in-scope entities and corrected the following
earlier records (each traceable to a hashed artifact; see
`docs/dossier/evidence/02-primary-source-replacement-report.md`):

1. **FaMe trade s.r.o. wrongly recorded as dissolved/exited.** The mirror-based
   record said both Faragas exited by end-2020 and the company was dissolved.
   The primary record shows it ACTIVE with Václav Faraga holding 50 % since
   14 Dec 2020 and a continuing jednatel role (CLM-32; old e31/e32 corrected).
2. **Ondřej Kaman "no direct Able.cz tie"** — the primary cap table shows a
   direct 1.50 % stake since 29 Jul 2025 (CLM-36).
3. **Artstay/Lovs renaming direction reversed.** Lovs & Co. s.r.o. was renamed
   TO Artstay s.r.o. on 13 Feb 2024, not the other way round (CLM-42).
4. **CLM-25 conflated revenue with net turnover.** Filed FY2023 revenue is
   42,642 tis. CZK; 43,079 tis. is net turnover. Split into CLM-44/45 with
   per-row citations.
5. **CLM-26 embedded an unsourced cause** ("consistent with an unpaid
   public-transport fine") inside a VERIFIED_PRIMARY claim, and implied an
   insolvency search that was actually BLOCKED (ISIR HTTP 500). Split into
   CLM-46 (facts, exact passages), CLM-47 (register footprint), CLM-48
   (assessment) and CLM-58 (BLOCKED).
6. **Blackfish "100 % owned by founder until the sale"** — the primary history
   shows co-owners in 2018–2020 (Caldr, Veteška) and 2022–2024 (Oslzla), plus
   the earlier name Black Fish Digital s.r.o. (CLM-21 rewritten).
7. **Usporix misreported as a 25 % minority stake** — Grolig holds all four
   25 % units (100 %) of a company founded 26 Jun 2026; **VERASTO** upgraded
   from "role unconfirmed" to sole owner + jednatel (CLM-37).
8. **mySASY board dates corrected** (19 Aug 2022 – 22 May 2023, was
   "May 2022–Mar 2023").
9. **Material omissions repaired, not corrections of record but of scope:**
   previous company name BIT CONSULTING s.r.o. (2012–2016), original Prague
   registration (C 200323/MSPH), ZenX Capital's 45.8–50 % ownership since
   Oct 2020, Petr Faraga's 2012 co-founder + 2012–2020 officer history, and
   Able.cz's ownership of Mindee app (95 %) and Verzuz.com (100 %).
10. **Stale gap removed**: "filed financial statements not retrieved" remained
    listed as an open question after the statements had been retrieved and
    parsed — moved to resolvedQuestions (RQ-01) with resolving evidence.
