# 16 — Cadastral final implementation report

**Pass:** address-first spatial layer · **Date:** 2026-07-18 · **Branch:**
`feat/dossier-epistemic-depth`. Status labels: **IMPLEMENTED / VALIDATED /
PARTIAL / BLOCKED / REJECTED / NOT IMPLEMENTED**. No planned work is reported as
done.

1. **Prismatic spatial capabilities reused** — ARES structured address
   extraction (indirectly, via the register-sourced address already in the
   dossier). Everything else spatial in Prismatic is ABSENT/STUB ([00](00-current-capability-audit.md)).
2. **New Prismatic components added** — NONE (no code written into the platform).
3. **Official sources integrated** — none newly called; the address traces to
   existing SRC-01/02/03/08. RÚIAN/ČÚZK integration NOT IMPLEMENTED.
4. **Source restrictions/licences** — documented in [01](01-source-and-access-matrix.md);
   `nahlizenidokn` (parcels/LV) BLOCKED as session-restricted + privacy-sensitive.
5. **Addresses extracted** — 1 (corporate registered office).
6. **Addresses resolved** — 1, `exact` (Vlněna 526/5, Trnitá, 602 00 Brno).
7. **Ambiguous addresses** — 0.
8. **Buildings resolved** — 0 (BLOCKED).
9. **Parcels resolved** — 0 (BLOCKED).
10. **Ownership records** — 0 (BLOCKED).
11. **Records excluded for privacy** — the Znojmo natural-person cluster (no
    concrete address in data; would be `prohibited`); 0 natural-person addresses
    published.
12. **Address-history events** — 0 (former offices BLOCKED, GAP-CAD-06).
13. **Contradictions** — 0 spatial contradictions (single corroborated address).
14. **Coverage gaps** — 6 BLOCKED cadastral gaps.
15. **Frontier tasks** — the 6 gaps are the cadastral frontier (all BLOCKED,
    each naming its ČÚZK/RÚIAN source).
16. **Public exports** — `static/data/able-cz/cadastre/{addresses,coverage,gaps,manifest}.json`.
17. **Analyst exports** — none separate this pass (nothing analyst-only was
    collected).
18. **Graph modes implemented** — NONE this pass (address section is a table;
    cadastral Cytoscape modes NOT IMPLEMENTED — no parcel/building data to layer).
19. **Map features** — NOT IMPLEMENTED ([09](09-map-architecture.md)).
20. **Chart.js analytics** — NOT IMPLEMENTED for cadastre (one address is not a
    defensible chart).
21. **Three.js** — REJECTED ([08](08-threejs-spatial-decision.md)).
22. **p5.js** — NOT IMPLEMENTED (no address-sharing topology with one address).
23. **Validation results** — VALIDATED: GATE 8 (cadastral publication) passes;
    2 planted-violation tests fail the gate as required.
24. **Privacy-validation results** — VALIDATED: 0 natural-person addresses, 0
    private coordinates, PII sweep over all cadastre files.
25. **Browser-test results** — the "Adresy a prostorový kontext" section renders
    (see final report in `depth/`), no console errors.
26. **Performance** — 4 small JSON files (< 5 KB total); no map/geometry load.
27. **Files changed** — added `scripts/dossier/cadastre.mjs`,
    `scripts/dossier-cadastre.test.mjs`,
    `static/data/able-cz/cadastre/*.json`, `docs/dossier/cadastre/*`; modified
    `scripts/dossier/validate.mjs` (GATE 8), `package.json` (data:build),
    `templates/dossier.html` (address section).
28. **Commits** — see git log on the branch.
29. **URLs** — local `http://127.0.0.1:1111/dossier/`; prod `https://unable.cz/dossier/`.
30. **Known limitations** — published spatial content is one corporate address;
    all parcel/building/RÚIAN/ownership/geometry/map/3D work is BLOCKED or
    REJECTED pending lawful ČÚZK/RÚIAN collection (greenfield in Prismatic).
31. **Reproduction** —
    ```bash
    npm run data:build      # export + derive + cadastre
    npm run data:validate   # includes GATE 8 (cadastral publication safety)
    npm test                # includes 5 cadastre tests
    npm run dev             # /dossier/ → "Adresy a prostorový kontext"
    ```

**Bottom line.** IMPLEMENTED & VALIDATED: an address-first model, deterministic
Czech normalization, publication/privacy classification, and a machine-enforced
publication gate. BLOCKED (not faked): all live cadastral collection. This is the
honest floor — a rigorous spatial *frame* with exactly the evidence that can be
lawfully published, and explicit, tested refusal to invent the rest.
