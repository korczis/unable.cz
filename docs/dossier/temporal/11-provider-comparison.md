# Provider-run comparison (PROMPT-09 §15) — PARTIAL

Implemented: per-source provider state history derived from the append-only `provider-runs.ndjson` (last attempt, last success, failure count, AVAILABLE/BLOCKED/PROVIDER_ERROR with most-recent-outcome-wins semantics), surfaced in freshness/monitoring and in SOURCE_AVAILABILITY_CHANGED change records.

Not implemented (honest): pairwise diffing of two provider runs' artifacts (UPSTREAM_CHANGE vs PARSER_CHANGE vs EXTRACTION_CHANGE classification). The substrate exists — content-addressed artifacts + `extraction/manifest.ndjson` with parserVersion — but no comparison engine was built in this pass. A parser change today would surface as a canonical-data change gated by the drift check, not silently as a company event; still, the dedicated classifier remains future work.
