# 01 — Cadastral source & access matrix

**Date:** 2026-07-18. What lawful spatial sources exist, and — honestly —
whether this pass may use them for automated collection and republication. The
default is caution: a publicly *viewable* screen does not grant bulk automated
collection or redistribution rights.

| Source ID | Authority | Data | Access | Automation / bulk | Redistribution | Personal data | Status here |
|---|---|---|---|---|---|---|---|
| CAD-RUIAN-VDP | ČÚZK | RÚIAN address points, obce/část obce/ORP/kraj hierarchy | VDP (`vdp.cuzk.cz`) + open data exports (CSV/GML atom feeds) | Open data bulk download **permitted**; per-address VDP UI is not a bulk API | Open-data licence, attribution to ČÚZK | Address points are public infrastructure (low personal-data risk) | **NOT INTEGRATED** (no loader built; see 00). Bulk ingest is the correct future path. |
| CAD-KN-NAHLIZENI | ČÚZK | Parcels, buildings, list vlastnictví (ownership/title) | `nahlizenidokn.cuzk.cz` — session/form-driven web UI | **Restricted**: session + form; not a documented bulk API; heavy automated use discouraged | LV output has usage limits; ownership data is personal-data-sensitive | **High** (natural-person owners) | **BLOCKED** — not scraped. Ownership/title requires lawful, rate-respecting, per-record access + editorial/legal review before any publication. |
| CAD-KN-WMS/WFS | ČÚZK | Cadastral map geometry (parcels) | Public WMS/WFS services | Service use permitted within terms; not embedded here | Attribution required | Low (geometry) | **NOT INTEGRATED** (no map/geometry built this pass; see 08/09). |
| CAD-ARES-ADDR | Ministry of Finance | Registered-office address (structured) | ARES REST (`ares.gov.cz/.../rest`) | Documented REST; permitted | Public register | Low (corporate seat) | **REUSED (indirectly)**: the registered-office address in the dossier traces to ARES-sourced register data (SRC-03) and VIES (SRC-08). |
| CAD-VIES | EU / Czech Fin. Admin. | VAT-registered name + address | VIES web service | Permitted (validation) | Public | Low | **USED** (SRC-08) — corroborates the registered office. |

## Access principles applied this pass

1. **Prefer official open datasets** (RÚIAN open data) over fragile UI scraping.
   None were ingested this pass because no loader exists (00) and doing it
   properly is a bounded future task, not a same-session guess.
2. **Never scrape a restricted, session-driven interface** (`nahlizenidokn`).
   Parcel/building/LV data is therefore BLOCKED, not faked.
3. **Attribution:** any future RÚIAN/ČÚZK-derived record must carry a ČÚZK
   attribution string and the dataset version in its provenance.
4. **Personal data:** ownership/LV records name natural persons and are
   `analyst_only`/`prohibited` by default (see [07](07-publication-and-privacy-policy.md)).

## What this pass actually consumed

Only address **strings already in the sourced dossier** — the corporate
registered office (`Vlněna 526/5, Trnitá, 602 00 Brno`), traceable to ARES-grade
register data (SRC-03), the company's own legal page (SRC-01/02), and VIES
(SRC-08). No new network collection was performed; the address layer is a
deterministic normalization of existing sourced text.
