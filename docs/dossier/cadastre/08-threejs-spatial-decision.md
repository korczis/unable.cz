# 08 — Three.js spatial view decision

**Decision: REJECTED for this pass.**

A 3D spatial view (X/Y = geography, Z = time/hierarchy) is only justified when
there is real geometry and multi-point/temporal spatial data to render. There is
not: exactly **one** address is in scope (the corporate registered office), with
**no** collected coordinates, parcels, or building footprints (see
[00](00-current-capability-audit.md), [01](01-source-and-access-matrix.md)).

Building a 3D scene for a single un-geocoded point would be decorative — a
"pseudo-photorealistic spectacle" the brief explicitly forbids, and it would
manufacture the appearance of spatial certainty the evidence does not support.

**Revisit when:** RÚIAN address points + ČÚZK parcel geometry for multiple
in-scope corporate locations have been lawfully collected, with a documented
coordinate system (EPSG:5514 S-JTSK or EPSG:4326 WGS84) and per-feature
provenance. Until then, the 2D tables and the existing Cytoscape graph are the
authoritative spatial-context surfaces.
