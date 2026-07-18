# Dossier — cadastral / spatial layer

An **address-first** spatial context layer for the Able.cz dossier, added
2026-07-18. It normalizes and classifies the addresses already present in the
sourced case, and **refuses to fabricate** the cadastral data it did not lawfully
collect. The map, parcels, RÚIAN ids, and ownership are BLOCKED — documented,
tested, and labelled, never guessed.

## Documents

- **[00 — Capability audit](00-current-capability-audit.md)** — Prismatic's
  spatial stack (PostGIS never enabled; RÚIAN absent; ČÚZK stubbed).
- **[01 — Source & access matrix](01-source-and-access-matrix.md)** — lawful
  sources and why parcel/LV data is BLOCKED.
- **[02 — Address model & normalization](02-address-model.md)** — deterministic
  Czech address parsing + resolution.
- **[07 — Publication & privacy policy](07-publication-and-privacy-policy.md)** —
  classification + the machine-enforced GATE 8.
- **[08 — Three.js decision](08-threejs-spatial-decision.md)** — REJECTED.
- **[09 — Map architecture](09-map-architecture.md)** — NOT IMPLEMENTED (no
  lawful geometry); intended design.
- **[15 — Open questions](15-open-questions.md)** — the BLOCKED cadastral frontier.
- **[16 — Final report](16-final-implementation-report.md)** — status-labelled.
- **[17 — Adversarial audit](17-adversarial-audit.md)** — proof nothing is faked.

## Honest scope

Published spatial content = **1** record: Able.cz s.r.o.'s registered office
(`Vlněna 526/5, Trnitá, 602 00 Brno`), classified `public_with_context`,
corroborated by the register (SRC-03) and VIES (SRC-08). **0** natural-person
addresses, **0** coordinates, **0** parcels, **0** ownership records. That is the
full, truthful extent of what can be published without collecting restricted
cadastral data or exposing private individuals.

Status vocabulary: **IMPLEMENTED / VALIDATED / PARTIAL / BLOCKED / REJECTED /
NOT IMPLEMENTED**.
