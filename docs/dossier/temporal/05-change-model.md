# Change model (PROMPT-09 §8, §10, §11)

Every semantic difference between adjacent snapshots becomes a first-class object `CHG-NNNN` (`scripts/dossier/temporal/changes-gen.mjs`), stored in `static/data/dossier/changes/manifest.json`; material changes (MEDIUM+) additionally get a JSON shard and a static route `/dossier/changes/chg-nnnn/`.

## Fields actually carried

`id, case_id, from/to_snapshot_id, change_kind (added|removed|changed), change_type, object_type, object_id, old/new_revision_id, field_changes, effective_at (+precision +source), observed_at (+basis), observed_no_later_than, published_at, materiality, epistemic_impact, category, resolved_by, successor/predecessor_object_id, requires_revalidation, public_summary (cs), technical_summary, source_ids, evidence_ids, affected_claim_ids, affected_routes, public_route`.

IDs are stable: ordering is (snapshot pair, object key), snapshots are immutable, so re-running never renumbers — the validator enforces exact sequential numbering.

## Change categories (§4 of the prompt's example)

| category | meaning | rule |
|---|---|---|
| `WORLD_CHANGE` | the represented world changed | effective_at falls between the pair's cutoffs |
| `KNOWLEDGE_CHANGE` | we discovered something that already was | effective_at ≤ from-cutoff, or no effective date (default for discoveries) |
| `CORRECTION` | our prior record was wrong | correction/supersession change types |
| `PUBLICATION_CHANGE` | only the publication metadata moved | case_meta changes, removals from publication |

The change page explicitly warns on KNOWLEDGE_CHANGE that the discovery date is not the event date.

## Succession matching

Content-keyed records (open questions, timeline events, financial facts) surface rewordings as remove+add. The matcher pairs a removal with an addition of the same type by word-set overlap (Jaccard ≥ 0.35, conservative), and a `notFound` financial fact with the `verified` fact that resolved it (any real word overlap). Result: rewordings are `OBJECT_CORRECTED` with an explicit successor; resolved absences are `GAP_RESOLVED`; the paired addition is downgraded to INFORMATIONAL so a rewording never masquerades as new intelligence. Anything unmatched stays `OBJECT_REMOVED_FROM_PUBLICATION` at MEDIUM — a deliberate review flag, never a silent disappearance.

## Epistemic impact (§10, `diff.mjs`)

Status ladder SELF_REPORTED/ASSESSED(1) < CORROBORATED(2) < VERIFIED_PRIMARY(3); up = STRENGTHENED, down = WEAKENED, → CONTRADICTED = CONTRADICTED, from CONTRADICTED = RESOLVED; entering the ladder from BLOCKED/NOT_FOUND/UNKNOWN = STRENGTHENED (provider recovered), leaving it = WEAKENED, between unranked = UNKNOWN. Source availability changes are `NO_EPISTEMIC_CHANGE` — preserved artifacts stay valid (§10: availability ≠ invalidation).

## Materiality (§11, documented rule table in `classify()`)

- **HIGH**: shareholding/statutory-role/transaction additions & corrections; ownership-predicate VERIFIED_PRIMARY relationships; financial value corrections; relationship endpoint corrections.
- **MEDIUM**: claim supersession/correction/status change; contradiction open/resolve; gap resolved; tier-1 source additions; financial periods; identity-value corrections; unexplained removals.
- **LOW**: other additions/enrichments. **INFORMATIONAL**: publication metadata, rewording successors.
- Not centrality-based; manual override is possible by editing the generated record only through a canonical change + regeneration (no hand-edited outputs).

## Summaries (§33)

Per pair, three deterministic levels are generated: `executive` (top ≤7 material items, Czech, each linked to its change id), `analyst` (grouped by change type with full id lists), `technical` (hashes + normalization note). "The dossier was updated" is structurally impossible — every summary line names its change.
