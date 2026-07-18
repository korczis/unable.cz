# 03 — Evidence data model

The chain every material claim now resolves through:

```
claim (dossier.json)
  → link (evidence.json claimEvidence: relation SUPPORTS/PARTIALLY_SUPPORTS/
          CONTRADICTS/CONTEXTUALIZES/SOURCE_OF_ASSERTION)
    → exact evidence
        · documentSpan   — page / section / row / extraction line + verbatim text
        · webSpan        — verbatim substrings proven present in a snapshot
        · assertion      — machine-extracted register fact + JSON pointer
    → artifact           — SHA-256, bytes, MIME, retrieval URL + timestamp
    → source             — authority, family, licensing, publication class
    → provider run       — the logged HTTP event that fetched it
```

## Record homes (extend, never fork)

| Record | Canonical home |
|--------|----------------|
| Source, Claim, Contradiction, Transaction, identity/governance/financials, graph | `data/dossier/able/dossier.json` |
| Source families, source meta (authority/licensing/publication), claim→evidence links, document/web spans, assertion selectors | `data/dossier/able/evidence.json` |
| RawArtifact + ArtifactVersion | `cases/DD-Able-CZ-2026-07-17/artifacts/manifest.ndjson` (append-only; same URL + new hash = new version row) + `artifacts/sha256/<p2>/<hash>` |
| ProviderRun | `cases/DD-Able-CZ-2026-07-17/provider-runs.ndjson` (append-only, records failures too) |
| SourceAssertion + ExtractionRun | `cases/DD-Able-CZ-2026-07-17/extraction/` (parser-versioned, deterministic) |
| PublicationDecision | `evidence.json` sourceMeta.publication + per-artifact pubClass |
| Public projections | `static/data/able-cz/evidence/*` built and VERIFIED by `scripts/dossier/evidence.mjs` |

## Key invariants (enforced by `evidence.mjs` at build + `validate.mjs` GATE 10 + tests)

1. A manifest hash that does not match its file bytes fails the build.
2. A cited span whose text is absent at its stated location fails the build.
3. A selector matching zero preserved assertions fails the build.
4. Every live claim has an evidence entry; superseded claims must not.
5. RESTRICTED artifacts never get a public download; published downloads are
   content-addressed and re-hashed at validate time.
6. Public exports carry no rodné číslo, no full birth dates (year only), no
   local filesystem paths.
7. A provider failure is BLOCKED, never NOT_FOUND.
8. Mirrors share a source family and never count as independent corroboration.

## Claim lifecycle

`superseded: true` + `supersededBy: [...]` retires a claim without deleting
it: excluded from every live projection (claims.json live list, figures,
planner, derive) but retained for the audit trail and shipped in the
`superseded` section of claims.json. Split rationale lives in
`supersededReason` and `08-claim-splitting-report.md`.

## Publication classes

| Class | Meaning |
|-------|---------|
| OFFICIAL_PUBLIC | official/open-data record — bytes published content-addressed |
| FIRST_PARTY | able.cz pages (subject authorized the DD) — published; served as `.html.txt` so a snapshot never renders as a page of this site |
| METADATA_ONLY | copyrighted third-party content — SHA-256 + HTTP metadata as retrieval proof, bytes not stored (public repo) |
| RESTRICTED_PERSONAL_DATA | preserved for provenance (execution filings), never published; hash + metadata only |
| BLOCKED | never lawfully/technically fetched |
