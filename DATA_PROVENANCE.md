# Data provenance

Every source consulted for the Able.cz s.r.o. dossier, what it supports, and —
importantly — what could **not** be retrieved. All retrievals on **2026-07-17**,
passive reads only (no authentication, no active scanning, no intrusion).

## Sources consulted

| ID | Source | Tier | What it supports | Status |
|----|--------|------|------------------|--------|
| S-01 | [ARES register — IČO 24278815](https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/24278815) | Official registry | Legal name, IČO, DIČ, legal form, incorporation 2012-10-03, seat, court file **C 85425**, financial office | VERIFIED_PRIMARY |
| S-02 | [able.cz](https://able.cz) | Company-controlled | Services, leadership titles, named clients, performance claims | primary (self-reported claims) |
| S-03 | [able.cz/legal/gdpr](https://able.cz/legal/gdpr) | Company-controlled | Company cites court file **C 85424** (contradicts register) | primary |
| S-04 | [Kurzy.cz register mirror](https://rejstrik-firem.kurzy.cz/24278815/able-cz-sro/) | Registry mirror | Registered capital 243,715 CZK; shareholders (ZenX Capital a.s., 5326G s.r.o.); supervisory board (Libor Polanský) | corroborating |
| S-05 | [Hlídač státu — 24278815](https://www.hlidacstatu.cz/subjekt/24278815) | Independent aggregator | Corroborates identity; no unreliable-VAT-payer flag | corroborating (insolvency login-gated) |
| S-06 | [CzechCrunch (2023-12-20)](https://cc.cz/od-hrani-her-pres-slevove-portaly-k-vyvojarske-agenture-s-valuaci-80-milionu-able-ma-ted-noveho-investora/) | Independent media | 80M CZK valuation; Point FM ~5% for 4M; revenue/EBITDA targets | media (self-reported figures) |
| S-07 | [CzechCrunch — Able buys Blackfish](https://cc.cz/desetimilionove-presuny-na-trhu-agentur-able-kupuje-blackfish-chteji-slapat-na-paty-strv/) | Independent media | 2025 acquisition of 100% of Blackfish from Vít Schlesinger | CORROBORATED (with S-08) |
| S-08 | [Forbes — Able acquires Blackfish](https://forbes.cz/vyvojar-able-ziskava-studio-blackfish-firmam-planuji-radit-jak-vyuzit-umelou-inteligenci-v-byznysu/) | Independent media | Confirms the Blackfish acquisition (second outlet) | CORROBORATED (with S-07) |

> Note: the published source ledger in `dossier.json` (`S-01`…`S-06`) is a
> curated subset; this file lists every retrieval, including the two media
> outlets that jointly corroborate the Blackfish event and the ISIR failure.

## Retrieved but gated / failed

| Source | Method | Outcome |
|--------|--------|---------|
| **ISIR insolvency registry** (`isir.justice.cz`) | HTTP GET | **FAILED — HTTP 500.** Insolvency status not retrieved → `NOT_FOUND`. Absence is not proof of absence. |
| Hlídač státu — insolvency detail | HTTP GET | **Login-gated** — not resolvable from the public view. |
| able.cz `/gdpr`, `/zasady-ochrany-osobnich-udaju` | HTTP GET | **404** — wrong paths; correct legal page (`/legal/gdpr`) found via the footer. |

## Digital / technical footprint (measured 2026-07-17)
Passive, public measurements — no scanning, no authentication.

| Source | Method | Finding |
|--------|--------|---------|
| `SRC-07` Google Public DNS | HTTPS `dns.google/resolve` | A `31.43.160.6`, `31.43.161.6`; NS `ns1/ns2.websupport.cz`, `ns3.websupport.eu` (Websupport); MX `smtp.google.com` (Google Workspace) |
| `SRC-08` EU VIES | HTTPS REST | VAT `CZ24278815` **valid** — "Able.cz s.r.o.", Vlněna 526/5, Brno (EU-level identity corroboration) |
| `SRC-09` crt.sh (certificate transparency) | HTTPS JSON | Current TLS certs issued by **Let's Encrypt**; an Amazon-issued cert also present in CT logs |

These are `VERIFIED_PRIMARY` technical observations, surfaced in the graph's
Technical mode (`domain → hosting / email / TLS`) and the identity table.

## 2026-07-18 — evidence-completion pass (preserved, hashed, verified)

The retrieval surface above was superseded by a preserved-artifact layer; this
file's earlier "not performed" note about Sbírka listin was itself stale (the
statements were retrieved later on 2026-07-17) — see CORRECTIONS.md.

- **ARES basic + full-register (VR) JSON for all 19 in-scope entities** —
  official REST API; 40 artifacts + 4 IČO-search results preserved
  content-addressed (SHA-256) under
  `cases/DD-Able-CZ-2026-07-17/artifacts/`, machine-extracted into 453
  assertions. This replaced every mirror-backed register fact with primary
  evidence and surfaced material corrections (see CORRECTIONS.md).
- **Sbírka listin** — Able.cz FY2024 statement + two execution filings + two
  Blackfish statements preserved with text extractions; every financial metric
  now cites its exact statement row.
- **Registr smluv** — party search for both IČOs executed and preserved: zero
  published contracts (a true NOT_FOUND).
- **able.cz snapshots** (home, /en/, /legal/gdpr) preserved with hashes;
  marketing claims cite verbatim passages in the snapshots.
- **Media** (Forbes, CzechCrunch ×3) — SHA-256 + HTTP metadata preserved as
  retrieval proof; bodies not stored (copyright; public repo).
- **ISIR** — retried, HTTP 500 again → status **BLOCKED** (the earlier
  NOT_FOUND classification was wrong and is corrected).
- **LinkedIn** — not fetched (terms prohibit automated retrieval); recorded
  as a blocked run.

Every retrieval — success or failure — is in
`cases/DD-Able-CZ-2026-07-17/provider-runs.ndjson`; the public projections
live under `static/data/able-cz/evidence/` and are verified at build time
(hashes, exact citations, publication classes). See
`docs/dossier/evidence/` for the full documentation set.

## Not performed (still)
- **EU/CZ sanctions & PEP screening** — not systematically run; flagged as an
  open question rather than asserted as clear.
- **Grant/subsidy registers and Hlídač státu API** — not queried.

## The one contradiction
`CON-01` — court file: **C 85424** (company GDPR page, S-03) vs **C 85425**
(register, S-01). The register is authoritative; the discrepancy is recorded, not
silently normalized.

## Snapshot provenance (added 2026-07-19)

Every published dossier state is provenance-tracked: snapshot manifests carry
the publishing git commit, evidence cutoff, generator version and SHA-256
semantic content hash; the bootstrapped history (r01–r07) reconstructs the
actually-deployed states from git, including the 2026-07-17 withdrawal and
re-publication (recorded as publication events, not smoothed over). The
`current.json` pointer plus the snapshot id/hash rendered on /dossier/ let
anyone verify what production publishes against the canonical data.
