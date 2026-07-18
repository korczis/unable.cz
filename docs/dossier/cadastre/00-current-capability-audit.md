# 00 — Cadastral / spatial capability audit

**Date:** 2026-07-18 · **Repo audited:** `~/dev/prismatic-platform` @ `8ffcc2ed57`
· **Method:** grep + open modules/migrations/tests; verify DB reality, not
moduledocs. Adversarial: assume nothing works until a migration/test proves it.

**Headline:** Prismatic has **no deployed spatial stack**. PostGIS is a
dependency but **never enabled** (no `CREATE EXTENSION postgis` in any
migration, no geometry/geography column anywhere). The cadastre clients return
**stub data**. So a real cadastral pipeline for able.cz is **greenfield**, and
this pass deliberately collects **no** cadastral data rather than fabricate it.

## Findings by area

| # | Area | Maturity | Most relevant file | Note |
|---|------|----------|--------------------|------|
| 1 | Address extraction (ARES) | **WORKING** | `apps/prismatic_osint_sources/.../adapters/czech/ares.ex` (`format_address/1`) | Returns structured `street`/`house_number`(čp)/`orientation_number`(čo)/`city`/`postal_code`/`district`/`region`. Tested. |
| 1b | Canonical Address schema + normalizer | **ABSENT** | — | No Ecto `addresses` schema, no parser, no `část obce` handling; persisted addresses are plain strings. |
| 2 | RÚIAN integration | **ABSENT** | `apps/prismatic/lib/prismatic/czech_crawler/sources.ex:79` | Only a VDP URL + a `# Placeholder for ČÚZK RUIAN API` comment. No dataset loader. |
| 3 | ČÚZK / katastr (parcels/buildings/LV) | **PROTOTYPE→STUB** | `apps/prismatic_osint_sources/.../adapters/czech/cuzk.ex` | Detail fetches return empty stub data (`note: "…requires HTML parsing and session management"`). `PersonPropertyOwnership` schema exists but **has no migration** — table never created. |
| 4 | Geocoding / reverse geocoding | **PROTOTYPE (dead)** | `apps/prismatic/lib/prismatic/geo_names/enrichment.ex` | Name-search only; no external geocoder; backing table not migrated. |
| 5 | PostGIS / geometry storage | **ABSENT in DB** | `apps/prismatic/lib/prismatic/geo_names/query.ex` | `geo_postgis` in mix only; **no `CREATE EXTENSION postgis`, no geometry column**. Only real geo data: plain `:float` lat/lon in `re_project_locations` (non-spatial B-tree index). |
| 6 | GeoJSON export | **ABSENT** | — | No `to_geojson`/FeatureCollection builder in Elixir. |
| 7 | Map UI (MapLibre/Leaflet) | **ABSENT** | — | No map library in any web app. |
| 8 | able.cz spatial data | **ABSENT** | — | No `24278815`/`Vlněna`/`Znojmo` records; `able.cz` appears only as the author's contact email. |

## Honesty flags

- Several moduledocs **overstate** ("PostGIS spatial indexing", "PostgreSQL
  persistent storage via Ecto") while the code uses ETS or an unmigrated table.
  Do not trust the docstrings for the spatial/cadastral DB layer.
- This directly corrects an earlier repo doc
  (`docs/dossier/01-prismatic-tooling-inventory.md`) that listed **ČÚZK** among
  working Czech-register adapters alongside ARES/ISIR. The ČÚZK adapter exists
  but is a **stub**; ARES/ISIR are real. See `docs/dossier/depth/19`.

## Reuse vs greenfield decision

- **Reusable:** ARES structured address extraction (area 1).
- **Greenfield (net-new before anything works):** RÚIAN ingestion, a real Czech
  geocoder, ČÚZK cadastre/LV parsing, PostGIS enablement, GeoJSON export, map UI.

**Consequence for this pass.** Because RÚIAN/ČÚZK/geocoding/PostGIS are absent or
stubbed, and because ČÚZK's public interface (`nahlizenidokn.cuzk.cz`) is
session/form-driven and its automated bulk use is restricted (see
[01](01-source-and-access-matrix.md)), **no parcel, building, RÚIAN id,
coordinate, or ownership record was collected.** The address layer built here
(`scripts/dossier/cadastre.mjs`) normalizes only address strings **already
present in the sourced dossier** and marks every un-collected spatial field
`null` with `collected:false`, turned into a BLOCKED gap — never a guess.
