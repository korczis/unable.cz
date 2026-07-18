# 09 — Relationship relinking

Graph edges now carry a legal `predicate` (STATUTORY_REPRESENTATIVE_OF,
SHAREHOLDER_OF, SUPERVISORY_BOARD_MEMBER_OF, BOARD_MEMBER_OF,
REPORTED_INVESTOR_IN) — multi-predicate edges were split (e1→e1+e49,
e2→e2+e50). 12 new edges (e49–e60) cover the newly primary-verified relations
(Able→Mindee 95 %, Able→Verzuz 100 %, Juren, Sluka→ZenX, O. Kaman→Able,
Melichárek's Mindee/ERA25/Verzuz roles, P. Faraga's historical officer edge).

Status recalculation: 28 edges upgraded from mirror-based CORROBORATED (some
of which were single-source and thus mislabelled) to VERIFIED_PRIMARY on
SRC-12; e34–e36 (one label, CONTRADICTED) resolved to VERIFIED_PRIMARY;
e31/e32 (FaMe trade) corrected; e39 (VERASTO) upgraded from SELF_REPORTED;
e16's missing media source registered (SRC-22). Edges resolve to claims and
claims to exact evidence; edge tables and the graph read the same records.
