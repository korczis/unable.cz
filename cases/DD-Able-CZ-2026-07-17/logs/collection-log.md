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

## Not performed in this pass
- Collection of Deeds (Sbírka listin) financial statements — not retrieved; filed
  revenue/result/assets/headcount left NOT_FOUND rather than estimated.
- EU/CZ sanctions & PEP screening — not systematically run; flagged as an open
  question, not asserted as clear.
