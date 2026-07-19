# Revision ledger (PROMPT-09 §4)

The append-only revision ledger is realized as the ordered set of immutable snapshot object layers plus the derived chain in `static/data/dossier/history/objects.json`: for each stable id, the list of distinct revisions (`revision_id`, `content_hash`, first/last snapshot) and every change id that touched it. Prior public states are never destroyed — the validator fails if any existing snapshot's bytes change.

Revision kinds are expressed through the change objects attached to the chain (addition, correction, enrichment, status change, evidence addition, supersession, removal-from-publication), each explaining what changed (field_changes), why (public_summary/reason), which sources caused it (source_ids), and whether the world or only our knowledge changed (category — see 05).

A: real-world change → category WORLD_CHANGE (e.g. an ownership transfer effective between two cutoffs).
B: knowledge change → KNOWLEDGE_CHANGE (e.g. the 2020 ZenX stake discovered 2026-07-17 — CHG-01xx records carry effective 2020-10-14, observed 2026-07-17).
C: correction → CORRECTION (e.g. mirror-derived values replaced after the primary ARES fetch, r04→r05 status upgrades).

Limitation (documented, deliberate): the canonical dossier.json carries no reviewer identity per edit; "who approved" is the signed git commit that published the snapshot (`unable_commit`), not a per-record field.
