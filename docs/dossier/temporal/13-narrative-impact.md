# Narrative impact (PROMPT-09 §17) — PARTIAL

The narrative (`content/dossier.md`) cites claims inline (CLM-nn anchors become links via claims-link.js); claims-gen counts narrative mentions per claim (backlinks.narrativeMentions). That gives dependency *detection* (which paragraphs mention a changed claim can be located by anchor), and the claim pages' history sections expose when a cited claim changed.

Not implemented (honest): first-class narrative_section objects with dependency ids, dirty-marking and deterministic regeneration producing NARRATIVE_CHANGED records. The narrative is hand-authored Czech prose, not generated — deterministic regeneration is not currently possible by construction. Guardrail in place: claims-validate fails when narrative claim references break, so stale prose citing a superseded claim is caught at build time.
