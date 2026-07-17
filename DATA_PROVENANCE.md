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

## Not performed in this pass
- **Collection of Deeds (Sbírka listin)** — filed financial statements not
  retrieved; revenue/result/assets/headcount left `NOT_FOUND` (not estimated).
- **EU/CZ sanctions & PEP screening** — not systematically run; flagged as an
  open question rather than asserted as clear.

## The one contradiction
`CON-01` — court file: **C 85424** (company GDPR page, S-03) vs **C 85425**
(register, S-01). The register is authoritative; the discrepancy is recorded, not
silently normalized.
