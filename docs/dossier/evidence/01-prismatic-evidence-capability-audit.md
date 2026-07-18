# 01 — Prismatic evidence-capability audit

Audited 2026-07-18 against the actual code in `~/dev/prismatic-platform`
(~100 umbrella apps). Ratings distinguish implemented+tested / implemented /
partial / schema-only / docs-only / absent — nothing is rated on the strength
of a moduledoc or TODO.

## Summary

Prismatic has three real, overlapping evidence pipelines, none of which is
currently wired to the Able.cz case:

1. **DD fetch→hash→persist** (`apps/prismatic_dd`) — the closest match to this
   phase's needs: `schemas/fetch_record.ex` computes SHA-256 over canonical
   raw data with a unique `(source_group, source_id, fetch_version)` index;
   `client.ex` runs adapter fetches under a `LoadRun` ledger
   (`schemas/load_run.ex`); `repo.ex` diffs fetch records into
   new/changed/unchanged by content hash. Implemented + tested.
2. **Evidence Vault/Graph** (`apps/prismatic/lib/prismatic/evidence/`) —
   node/relation/graph records with event sourcing and replay, SHA3-512
   hash-chained vault (`vault.ex`), Merkle snapshots (`snapshot.ex`),
   chain validation, court-proof generation; 16 test files. Implemented +
   tested, but vault content lives in GenServer/ETS state — durability only
   via snapshots.
3. **Czech-source HTTP clients** — `registries/{ares_client,justice_client,
   cuzk_client,czech_registry_client}.ex` (tested) plus ~36 adapters in
   `apps/prismatic_osint_sources/.../adapters/czech/` (ares, registr_smluv,
   isir, executors, or_registry, cuzk, rzp, res, cedr, uohs, verejne_zakazky…)
   with 113 test files. The richest reusable asset.

Supporting capabilities: PDF text extraction via `pdftotext`
(`apps/prismatic_czech_courts/.../extraction/pdf_extractor.ex`, requires
poppler) plus NER/LLM extractors; Oban-based download jobs with retries and
token-bucket rate limiting; content-addressed web page store
(`web_crawl/web_document.ex`, unique `sha256:` index); LiveView evidence and
DD-dataroom viewers (`prismatic_web/live/evidence_live.ex`, `live/dd/dataroom/*`);
CLI/mix tasks (`czech_registry_cli.ex`, `mix dd.*`, `mix infodeska.*`,
`mix evidence.add`).

## Honest gaps (as of this audit)

- **`cases/` holds no artifacts**: every existing Prismatic case folder is a
  Markdown/JSON/HTML deliverable; `find cases/ -type f` shows zero PDFs, zero
  hashes, no chain-of-custody records. The "Fetched" column in
  `_assets/sources.md` is a hand-entered date. The unable.cz case store
  (`cases/DD-Able-CZ-2026-07-17/` in this repo) is therefore *ahead* of
  Prismatic's own cases on artifact preservation, and is the right place to
  extend.
- No unified content-addressable blob store (PDF bytes on filesystem, hashes
  in Postgres, vault content in ETS — three disjoint stores).
- No source-freshness / broken-link monitor for registry URLs.
- No tiered public/analyst/forensic export separation — only a `redact_pii`
  boolean in `investigations/report_exporter.ex`.
- No table-structure extraction from PDFs (text only).
- The REST evidence API in `prismatic_web/router.ex` is commented out.
- ISDS SOAP client exists but has minimal test coverage (5 tests) — do not
  rely on it unverified.

## Reuse decisions for this phase

| Need | Decision |
|------|----------|
| Retrieval + hashing + run ledger | Reimplemented minimally in this repo (`scripts/dossier/fetch-evidence.mjs`) because the dossier build must stay a dependency-free Node pipeline (CI runs `npm ci` + zola only; no Elixir runtime on GitHub Pages CI). The design copies Prismatic's shape: provider runs ≙ `LoadRun`, artifact manifest ≙ `FetchRecord` with SHA-256, content-addressed store ≙ `web_document` semantics. |
| ARES access | Same official endpoints Prismatic's `ares_client.ex` uses (`ares.gov.cz/ekonomicke-subjekty-v-be/rest/…`), including the `-vr` full-register variant. |
| PDF text | Existing `pypdf` extractions preserved in the case store; page/line-referenced spans generated in this repo (`extract-spans.mjs`). Prismatic's `pdf_extractor.ex` is the platform-side equivalent when this case is ingested there. |
| Chain of custody | Content hash + provider-run ledger in the case store now; Prismatic's Vault/snapshot chain is the eventual home when the case is loaded into the platform (bridge: `prismatic_dd/canonical_case.ex#from_manifest`). |
| Viewer | Built in this repo's dossier UI (static, lazy-loaded shards) — Prismatic's LiveView evidence UI needs the platform running and cannot serve a static GitHub Pages site. |

The case remains Prismatic-canonical in shape: `case.yaml`, `provider-runs.ndjson`,
`artifacts/manifest.ndjson` + `artifacts/sha256/`, `extraction/` are all
ingestible by `CanonicalCase.from_manifest/2`-style loaders, and nothing here
forks the record vocabulary (Source/Artifact/Assertion/Claim/Run).
