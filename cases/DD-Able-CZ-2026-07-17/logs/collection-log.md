# Collection log — DD-Able-CZ-2026-07-17

All retrievals on **2026-07-17**, public sources only, passive reads (no
authentication, no active scanning, no intrusion). Failures are recorded here
rather than omitted — an unavailable source is evidence about the source, not a
silent gap.

| # | Source | Method | Outcome |
|---|--------|--------|---------|
| 1 | ARES REST — `ekonomicke-subjekty/24278815` | HTTP GET | **OK** — identity, seat, incorporation, court file C 85425, legal form, financial office |
| 2 | able.cz (homepage, footer) | HTTP GET | **OK** — services, leadership, clients, legal links (`/legal/gdpr`, `/legal/eu`) |
| 3 | able.cz/legal/gdpr | HTTP GET | **OK** — company cites court file **C 85424** (contradicts register) |
| 4 | Kurzy.cz register mirror | HTTP GET | **OK** — corroborates seat/incorporation; registered capital 243,715 CZK; shareholders incl. ZenX Capital a.s., 5326G s.r.o.; supervisory board Libor Polanský |
| 5 | Hlídač státu — subject 24278815 | HTTP GET | **OK** — corroborates identity; no unreliable-VAT-payer flag; **insolvency detail login-gated** (not resolvable here) |
| 6 | CzechCrunch — valuation/investor (2023-12-20) | HTTP GET | **OK** — 80M CZK valuation, Point FM ~5% for 4M, revenue/EBITDA targets |
| 7 | CzechCrunch / Forbes — Blackfish acquisition (2025) | HTTP GET | **OK (two outlets)** — Able acquired 100% of Blackfish from Vít Schlesinger → CORROBORATED |
| 8 | **ISIR insolvency registry** (`isir.justice.cz`) | HTTP GET | **FAILED — HTTP 500/5xx.** Insolvency status not retrieved. Recorded as NOT_FOUND; absence is not proof of absence. |
| 9 | able.cz `/gdpr`, `/zasady-ochrany-osobnich-udaju` | HTTP GET | 404 — wrong paths; correct path (`/legal/gdpr`) found via footer and used. |

## Second pass — 2026-07-17 (later same day): recursive network + Sbírka listin

| # | Source | Method | Outcome |
|---|--------|--------|---------|
| 10 | Recursive register research (kurzy.cz, Hlídač státu, ARES cross-check) on Able.cz's officers/shareholders and the Blackfish acquisition, depth 2 | HTTP GET via multiple independent research passes | **OK** — extended ownership/relationship network (Faraga/Melichárek/Juhaňák/Kaman/Schlesinger/Oslzla + 15 connected companies); one internal contradiction found (CON-02, one label s.r.o. stakes/dates) — none of it reaches VERIFIED_PRIMARY, or.justice.cz's search UI is JS-rendered and did not return document tables via automated fetch |
| 11 | or.justice.cz Sbírka listin — `vypis-sl-firma?subjektId=49914` (document index, 70 filings 2012–2026) | HTTP GET (this endpoint, unlike the firm-search UI, returned server-rendered content) | **OK** — full filing history enumerated: annual financial statements 2012–2024, two 2026 enforcement filings |
| 12 | or.justice.cz Sbírka listin — `content/download?id=...` for C 85425/SL68/KSBR (účetní závěrka 2024) | HTTP GET, saved to `sbirka-listin/2024-ucetni-zaverka-SL68.pdf`, text extracted with `pypdf` | **OK — VERIFIED_PRIMARY.** Real balance sheet + P&L for FY2024 (+ FY2023 comparatives): revenue 36,319 / 42,642 tis. Kč, net result 631 / 844 tis. Kč, total assets 71,880 / 59,386 tis. Kč, equity 26,592 / 25,849 tis. Kč. No employee headcount field in this filing. |
| 13 | or.justice.cz Sbírka listin — C 85425/SL69/KSBR (exekuční příkaz, 21.1.2026) and C 85425/SL70/KSBR (oznámení o skončení exekuce, 8.4.2026), saved to `sbirka-listin/` | HTTP GET + `pypdf` text extraction | **OK — VERIFIED_PRIMARY.** Execution targeted **Tomáš Melichárek's personal ownership stake** in Able.cz over a **9,327.14 CZK** debt to Dopravní podnik hl. m. Prahy, a.s. (public-transport operator) via exekutor Mgr. Jakub Effenberger (Exekutorský úřad Kolín), case 219 EX 00241/26. Ended 24.3.2026 "vymožením" (satisfied by payment) — a personal matter unrelated to Able.cz's own finances, resolved without incident. The debtor's birth-ID number (rodné číslo), present in the source PDF, was redacted from all derived text/dossier content per this site's personal-data-minimization practice — the raw PDFs are kept for provenance but are not further indexed for that field. |

| 14 | or.justice.cz Sbírka listin — Blackfish & Co. s.r.o. (subjektId 991026), full filing index (2017–2026) | HTTP GET | **OK** — 15 annual financial statements enumerated 2017–2025 |
| 15 | or.justice.cz Sbírka listin — Blackfish & Co., účetní závěrka 2024 (C 283664/SL21/MSPH) and 2025 (C 283664/SL23/MSPH), saved to `sbirka-listin/blackfish/` | HTTP GET + `pypdf` text extraction | **OK — VERIFIED_PRIMARY.** Filed as a micro accounting unit (abbreviated, no P&L required): total assets 6.75M CZK (2024) / 8.25M CZK (2025), equity ~2.6–2.7M CZK both years — financially small next to Able.cz's own 71.9M CZK total assets. |

## Not performed in this pass
- EU/CZ sanctions & PEP screening — not systematically run; flagged as an open
  question, not asserted as clear.
- Full or.justice.cz VERIFIED_PRIMARY upgrade for the extended ownership network
  (item 10) — a manual browser session against the JS-rendered search UI would be
  needed; the Sbírka listin document index (items 11, 14) worked via direct fetch,
  but the firm/person *search* UI did not.
- Filed statements for the other network entities (FaMe logistics/trade, M&M plan,
  one label s.r.o., ERA25, etc.) — not retrieved this pass; Able.cz and its direct
  acquisition target (Blackfish) were prioritized as the two entities within the
  dossier's core subject.
