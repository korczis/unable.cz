# 03 — Data model

Single source of truth: **`data/dossier/able/dossier.json`**. The template reads
it via Zola `load_data`; `scripts/dossier/export.mjs` derives the web exports.

## Top-level keys
| Key | Shape | Used by |
|---|---|---|
| `meta` | `{subject, ico, evidenceCutoff, scope, statusLegend}` | header, provenance |
| `sources` | `[{id, title, url, tier, kind, retrievedAt}]` | source ledger, evidence join |
| `identity` | `[{field, value, status, sources[]}]` | identity table |
| `contradictions` | `[{id, field, valueA{value,where,source}, valueB{…}, status}]` | identity table (highlighted) |
| `governance` | `{statutoryBody[], shareholders[], signingRule, marketingLeadership[]}` | prose + graph |
| `financials` | `{note, verified[], selfReported[], notFound[]}` | financials table |
| `claims` | `[{id, text, status, sources[], note?}]` | claim ledger, status chart, evidence field |
| `timeline` | `[{date, event, status, sources[]}]` | timeline export |
| `openQuestions` | `[string]` | open-questions list |
| `graph` | `{nodes:[{data:{id,label,group}}], edges:[{data:{id,source,target,label,status}}]}` | Cytoscape graph + table |

## Evidence status enum
`VERIFIED_PRIMARY` · `CORROBORATED` · `SELF_REPORTED` · `ASSESSED` ·
`CONTRADICTED` · `NOT_FOUND` · `UNKNOWN`. See `05-claim-classification.md`.

## Web exports (`static/data/able-cz/`)
`case.json`, `metadata.json`, `entities.json`, `relationships.json`,
`claims.json`, `evidence.json`, `timeline.json`, `financials.json`,
`risks.json`, `sources.json`. Each carries an `_export` header:
`{schemaVersion, kind, subject, ico, evidenceCutoff, generatedAt, source, count?}`.

## Integrity rules (see 10 / validation)
- Every graph edge's `source`/`target` must resolve to a node id.
- Every claim/identity `sources[]` id must resolve in `sources[]`.
- `risks.json` is **ASSESSED** and derived; it invents no facts, only reads gaps.
