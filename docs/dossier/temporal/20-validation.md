# Validation (PROMPT-09 §41–§43)

`npm run temporal:validate` (wired into `data:validate` → `npm run verify`). Failure classes actually enforced:

Snapshot integrity: sequence gaps, broken previous links, missing files, duplicate object ids, per-object content-hash mismatch, malformed revision ids, valid_to<valid_from, manifest/index hash disagreement, object_manifest_hash mismatch, static-vs-generated mirror divergence, current.json pointer drift, **canonical drift** (committed dossier.json ≠ latest snapshot → forces snapshot+changes regeneration before commit), local-path/PII leak in frozen payloads.

Diff reconciliation: recomputed diff must equal stored reconciliation for every pair; unchanged+changed+added = to-count and unchanged+changed+removed = from-count; exact 1:1 between semantic differences and change records (both directions); change revision ids must exist in their snapshots; GAP_RESOLVED must reference an existing resolution record; effective_at with UNKNOWN precision is an error; material changes must have shard+page+route, non-material must not; deterministic CHG numbering.

Staleness (§43): BLOCKED records missing from the plan = error; tasks without provider/stop condition = error; HIGH-materiality overdue records = warning (never blocks unrelated deploys — the page announces its own staleness, consistent with the repo's SEO-validate philosophy).
