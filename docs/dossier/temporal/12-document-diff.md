# Document change detection (PROMPT-09 §16) — PARTIAL

Implemented: exact-hash comparison is inherent (content-addressed artifact store; a re-fetch of a changed page yields a new sha256 and a new manifest row; identical bytes are never duplicated — enforced by fetch-evidence.mjs and the evidence-chain tests).

Not implemented (honest): normalized-text/structural/table-level diffs of two artifact versions of the same source, and HTML noise-stripping comparison. No mutable source has yet been re-fetched twice in this case, so there is no real pair to diff; building the comparator without data would be speculative. The freshness layer schedules the re-fetches that will create such pairs.
