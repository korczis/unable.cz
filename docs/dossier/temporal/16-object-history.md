# Object history (PROMPT-09 §21–§24)

- `/dossier/history/` — every object with >1 revision or any change: revision chain (rNN@hash → …), change links, client-side search; stable objects summarized by count and fully available in `history/objects.json`.
- Claim pages (§22): "Historie ve snapshotech" section — revision list with first/last snapshot links, change records, supersession links (already present), and the guarantee text that old wording lives in the frozen snapshot objects.
- Relationships/entities (§23–24): revision chains live in history/objects.json and the graph change mode (17); dedicated per-entity history pages are NOT built (entities have no standalone routes in this dossier — the graph inspector is their surface). Ownership percentage-over-time is intentionally NOT interpolated: the canonical record packs the dated series into a sourced string (audit D5) and the UI shows exactly that with stepped dates in text.
