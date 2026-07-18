# 17 — Cadastral adversarial audit

**Date:** 2026-07-18. Assume the cadastral layer cheats; try to catch it.

| Adversarial probe | Finding | Evidence |
|---|---|---|
| Hardcoded / invented addresses? | **No.** The one published address is normalized from sourced dossier text (registered office). | `cadastre.mjs` reads `data/dossier/able/dossier.json` only; test asserts components + sources. |
| Invented coordinates? | **No.** `coordinates: null`, `collected.geometry: false`. Gate `CAD_INVENTED_GEOMETRY` + a planted-coordinate test fail the build if present. | `dossier-cadastre.test.mjs` |
| Synthetic parcels? | **No.** `parcels: []`, `collected.parcel: false`; gate `CAD_INVENTED_PARCEL`. | manifest `parcelsResolved: 0` |
| Invented RÚIAN ids? | **No.** `ruianAddressPointId: null`; gate `CAD_INVENTED_RUIAN`. | manifest `ruianResolved: 0` |
| Unverified ownership? | **No.** `ownership: null`; gate `CAD_INVENTED_OWNERSHIP`. No LV was fetched. | manifest `ownershipRecords: 0` |
| Registered-office / ownership conflation? | **No.** Role is `registered_office`; the UI states "sídlo není vlastnictví ani provozovna". | `07`, template |
| Private-residence leakage? | **No.** Only `legal_entity`, `public_with_context`. Gates `CAD_NATURAL_PERSON`, `CAD_PUB_CLASS`; PII sweep over all cadastre files. | manifest `naturalPersonAddressesPublished: 0` |
| Unsupported "headquarters" label? | **No.** Labelled `registered_office`, never "headquarters/HQ". | `cadastre.mjs` role field |
| Ambiguous match shown as exact? | **No.** Gate `CAD_AMBIGUOUS_PUBLISHED`; the single address resolves `exact` on a real canonical-key merge. | `02` |
| Missing source attribution? | **No.** Every published address carries `sources` (SRC-01/02/03/08); gate `CAD_NO_SOURCE`. | `addresses.json` |
| Map layer without provenance? | **N/A.** No map/geometry shipped ([09](09-map-architecture.md)). | — |
| Inert UI controls? | **No.** The "Adresy" section is a static table + a "not collected" note; no controls without data behind them. | template |
| Frontend-derived facts? | **No.** The UI reads the validated public export; it computes no cadastral facts. | template `load_data` |
| Docs overstate reality? | **Corrected.** `00` flags Prismatic's overstated spatial moduledocs and the stub ČÚZK adapter; nothing here claims collected data that wasn't. | `00`, `depth/19` |

**Material defects found & removed:** two extraction bugs during development — the
DIČ value was mis-read as an address, and a richer parse was discarded on merge —
both fixed before commit (the address now parses fully and excludes the DIČ). No
residual fabricated or privacy-leaking record.

**Residual honest limitation:** the layer's *published* content is a single
corporate address. That is not a shortfall to hide — it is the true extent of what
can be published without collecting new (restricted) cadastral data or exposing
private individuals. Everything further is BLOCKED and labelled.
