# 02 — Primary-source replacement report

Campaign of 2026-07-18. Objective: replace every material fact supported only
by register mirrors (kurzy.cz, Hlídač státu, Peníze.cz, Podnikatel.cz,
Northdata) with authoritative primary evidence, preserved and hashed.

## Route discovered

The 2026-07-17 pass believed primary register data was unreachable ("the
or.justice.cz search UI is JS-rendered"). That premise was wrong: the official
**ARES REST API** exposes the full veřejný rejstřík record — officers,
shareholders, name/court/capital histories, all with dates — as structured
JSON at `ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/{ico}`,
and resolves unknown IČOs via the official POST search. No scraping, no terms
friction: official open data.

## Execution

- 19 entities (17 IČOs from the dossier + ZenX Capital and 5326G resolved by
  ARES search) × (basic + VR record) fetched by
  `scripts/dossier/fetch-evidence.mjs`; 40 ARES artifacts + 4 search artifacts
  preserved content-addressed with SHA-256; every request logged in
  `provider-runs.ndjson`.
- `scripts/dossier/parse-ares.mjs` deterministically extracted **453
  normalized assertions** (85 officer rows, 156 shareholding rows, name/court/
  capital/board histories), each carrying a JSON pointer into its hashed
  artifact.

## Replacement outcomes

| Fact area | Before | After | Status |
|-----------|--------|-------|--------|
| Able.cz identity fields (9 rows) | VERIFIED_PRIMARY via mislabelled mirror SRC-03 | re-sourced to SRC-12 artifacts | REPLACED_PRIMARY |
| Able.cz officers + supervisory board | mirror | primary incl. full history (P. Faraga 2012–2020 discovered) | REPLACED_PRIMARY |
| Able.cz cap table | partial mirror list | complete 12-holder table, sums to 100.00 % (ZenX 45.80 % discovered) | REPLACED_PRIMARY |
| one label s.r.o. stakes (CON-02) | two conflicting mirror passes | resolved: 36/34/30 with dates | REPLACED_PRIMARY + contradiction RESOLVED |
| Blackfish ownership/officer history | mirror, partly wrong | full dated history incl. former name | REPLACED_PRIMARY (with corrections) |
| Network entities (Mindee, ERA25, Verzuz, FaMe ×2, FaMa, M&M, Ventoux, Artstay, mySASY, BGO, Usporix, VERASTO, Vít Schlesinger s.r.o., ZenX, 5326G) | mirror or absent | primary VR records for all | REPLACED_PRIMARY |
| Signing rule (způsob jednání) | mirror labelled VERIFIED_PRIMARY | ARES VR does not expose it; downgraded to mirror-family CORROBORATED with caveat | AGGREGATOR_RETAINED_WITH_WARNING |
| Point FM ~5 % investment (2023 media) | LinkedIn-summary citation | register shows the Kříž-majority vehicle 5326G at 4.09 % since Aug 2023; identification of the two stays ASSESSED (CLM-56); the article itself (URL recovered from DATA_PROVENANCE.md) re-fetched and hash-preserved as SRC-22; Point FM's own site is JS-rendered — corroboration attempt failed and is logged | PRIMARY_CORROBORATED (partially) |
| Registr smluv (public contracts) | never queried | queried for both IČOs; zero contracts; result pages preserved | NEW PRIMARY, NOT_FOUND result |
| ISIR insolvency | HTTP 5xx (2026-07-17), recorded as NOT_FOUND | retried; HTTP 500 again; reclassified BLOCKED (CLM-58) | PRIMARY_BLOCKED |
| LinkedIn (SRC-06) | cited | not fetched — automated retrieval prohibited by terms; recorded as blocked run | PRIMARY_UNAVAILABLE (lawful constraint) |
| Media articles (Forbes, CzechCrunch ×2) | cited, no artifacts | fetched; SHA-256 + HTTP metadata preserved as retrieval proof; bodies NOT stored (copyright — this repo is public) | RETAINED with hash-level preservation |

## Remaining aggregator-backed facts

Exactly one material item: the **signing rule**, flagged in-data with its
caveat. Everything else that the dossier asserts as register fact now
resolves to a preserved primary artifact.

## Not downloaded on purpose

Sbírka listin PDFs for secondary network entities (their financial statements
are immaterial to the case's questions), and the July 2025 notarial deed
(material — listed as an open question and a retrieval task, not silently
skipped).
