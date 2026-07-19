# Semantic diff engine (PROMPT-09 §9)

`scripts/dossier/temporal/diff.mjs::diffFields/diffSnapshots`.

Normalization happens at extraction time (lib.mjs): object keys canonically sorted, id-lists (sources, evidence, claims, supersededBy…) sorted, string entries of older schema shapes normalized into the current payload shape. Consequences, both tested:
- a reordered source list can never appear as a change (reorder-only collections are dropped);
- a content-hash difference caused purely by normalization drift is re-checked field-by-field and discarded if semantically empty.

Field diff output: `{field, kind:"value", previous, current}` or `{field, kind:"collection", added, removed}`. Values may be nested objects (rendered as pretty JSON on the change page). Numeric fields in this dossier are display strings sourced from filings; they are compared verbatim (no unit re-derivation — the finance layer, not the diff, owns numeric semantics; a display change classifies as FINANCIAL_VALUE_CORRECTED at HIGH).

diffSnapshots returns added/removed/changed/unchangedCount and is the single reconciliation authority: the validator recomputes it for every adjacent pair and fails on any disagreement with the stored manifests (see 20).
