# 09 — Map architecture

**Status: NOT IMPLEMENTED this pass (deliberate).**

## Why no map yet

A map view visualizes spatial evidence. This pass has **no lawfully-collected
spatial geometry** to visualize: no coordinates, no RÚIAN address point, no parcel
footprint (see [00](00-current-capability-audit.md)). Rendering a single
un-geocoded corporate address as a pin would require **inventing a coordinate** —
which the integrity gate forbids (`CAD_INVENTED_GEOMETRY`) and which the brief
prohibits ("must not manufacture certainty from coordinates"). A map with one
fabricated point is worse than no map.

## Intended architecture (when geometry exists)

- **Library:** MapLibre GL JS or Leaflet, **deferred-loaded** only in a
  dedicated "Mapa" mode (never on initial `/dossier/` load).
- **Base map:** an appropriately-licensed source with visible attribution;
  ČÚZK WMS/WFS for cadastral overlays (per [01](01-source-and-access-matrix.md)).
- **Data:** `static/data/able-cz/cadastre/map-points.json` (address points) and
  lazily-loaded `parcel-geometries.json`, both **publication-safe** — corporate
  locations only, no private-residence geometry, geometry simplified for web.
- **Coordinate system:** stored/declared explicitly (EPSG:4326 for web display;
  EPSG:5514 S-JTSK if sourced from ČÚZK, reprojected on export).
- **Sync:** click map feature → select Cytoscape node and open inspector; select
  graph node → centre map; timeline event → update visible locations.
- **Privacy:** map export runs through the same GATE 8; no `analyst_only`/
  `prohibited` record is ever emitted to a map shard.

## Prerequisite

Implement the RÚIAN/ČÚZK collection layer (greenfield in Prismatic, see
[00](00-current-capability-audit.md)) first. The map is a projection of that
data, not a substitute for collecting it.
