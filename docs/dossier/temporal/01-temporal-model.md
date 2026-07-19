# Temporal model (PROMPT-09 §0, §3)

## Two axes, never collapsed

| Axis | Meaning | Where it lives |
|---|---|---|
| **valid time** | when a fact applied in the represented world | `valid_from`/`valid_to` on object revisions; `effective_at` on changes |
| **system time** | when this repository knew/published it | snapshot `generated_at`, change `observed_at`/`observed_no_later_than`/`published_at` |

Seven distinguished timestamps (§0) and where each is implemented:

1. **Real-world effective time** — `valid_from`/`valid_to` extracted from canonical fields that genuinely carry it (`timeline.date`, `transactions.effectiveInRegister`, `graph.node.validFrom`, `governance.*.since/until`, `graph.edge.firstObserved` — the last with an explicit defect note, see audit D4). Every value carries `valid_time_source` naming the canonical field.
2. **Source publication time** — not systematically present in canonical data; never fabricated. Where absent it is absent.
3. **Observation time** — `source.retrievedAt` (real) and provider-run `startedAt`/`finishedAt` (real, append-only). On non-source changes `observed_at` is the retrievedAt of the oldest cited source, explicitly labelled an upper-bound estimate in `observed_at_basis`, or null.
4. **Verification time** — `last_successful_verification` in freshness records (derived from cited sources' retrievals; falls back to the evidence cutoff).
5. **Publication time** — snapshot `generated_at` (real commit timestamps for the bootstrapped history; the evidence cutoff for build-generated snapshots, per repo determinism convention) and change `published_at`.
6. **Supersession time** — bounded by the snapshot pair in which the supersession appeared (`from_snapshot_id`→`to_snapshot_id`); the canonical model carries no finer timestamp and none is invented.
7. **Validity interval** — `valid_from`/`valid_to`; an open interval is `valid_to: null` with the object living in the current snapshot — explicitly *open*, never "forever".

## Time precision

`parseValidTime` returns `EXACT_DATE | MONTH | YEAR | UNKNOWN` and never upgrades precision: `"2025 (Forbes coverage…)"` → YEAR `2025`; free text → UNKNOWN with the raw string preserved. The validator fails any change carrying `effective_at` with UNKNOWN precision.

## Object revision identity

- `stable_id`: canonical IDs where they exist (CLM-*, SRC-*, CON-*, RQ-*, graph ids); content-derived ids elsewhere (`OQ-<fnv>`, `TLE-<fnv>`, `FIN-<bucket>-<metric-slug>`, `ID-<field-slug>`, `SHARE-/ROLE-<name-slug>`). Documented consequence: editing the text of a content-keyed record is represented as remove+add; the succession matcher (05-change-model) re-links those pairs.
- `revision_id` = `<stable_id>@<contentHash16>`; `content_hash` = SHA-256 over canonical JSON (sorted keys; id-lists sorted at extraction so ordering can never fabricate a revision).
- `revision_number` = position of the distinct hash in the snapshot sequence (see `history/objects.json`).

## What is deliberately NOT claimed

- No per-field bitemporal table exists in Prismatic to reuse (00-audit §1); the bitemporal distinction is carried at revision/change level, not per field.
- `system_from`/`system_to` are represented by snapshot membership intervals, not stored per record.
