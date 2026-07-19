# Snapshot model (PROMPT-09 §5–§7, §19)

A snapshot = one immutable published state of the dossier:

```
static/data/dossier/snapshots/<id>/manifest.json   (public copy — served)
static/data/dossier/snapshots/<id>/objects.json    (full frozen object revisions)
generated/dossier/snapshots/<id>/…                 (byte-identical pipeline mirror)
static/data/dossier/snapshots/index.json           (ordered registry + publication events)
static/data/dossier/snapshots/current.json         (pointer: id, sequence, cutoff, content hash)
```

**ID**: `able-cz-public-<evidence-cutoff>-rNN` — deterministic and readable; NN is the global publication sequence.

**Semantic content hash**: SHA-256 over the sorted list of `type:id@objectHash` lines — a Merkle-flat digest; two builds of the same canonical state agree byte-for-byte.

**Immutability**: `snapshots.mjs` refuses to overwrite an existing snapshot whose content hash differs; the validator additionally re-derives every hash and fails on any drift, and on any divergence between `static/` and `generated/` mirrors. Retention: all previously published snapshots are kept forever (`retention_policy` in the index).

**Bootstrapped history**: r01–r07 are the *real* deployed states recovered from git (audit §4), with real commit timestamps as `generated_at` and the commit hash as `canonical_case_revision`/`unable_commit`. The 2026-07-17 withdrawal and re-publication are preserved as `publication_events` — history is not smoothed over.

**Honest route-layer limitation** (§19): bootstrapped snapshots preserve the complete *object layer*; the derived route manifests of that era were not preserved, so `route_manifest_hash`/`finance_manifest_hash` are `null` there with an explanatory `route_layer_note`, and the snapshot detail page offers the frozen `objects.json` as "Otevřít dossier v tomto snapshotu" instead of pretending a full historical render exists. The current snapshot carries real route-layer hashes.

**Semantic no-op** (§7): the build-time mode extracts the current canonical state and exits without writing when its hash equals the latest snapshot — rebuilds never mint snapshots. Semantic snapshots, deployment builds and production releases are thus distinct: deployments of an unchanged state reuse the snapshot id.

**Generation sequence**: extract → sort → hash → counts/distributions → manifest → persist (refuse on conflict) → index/current update. Prismatic has no dossier-snapshot command (00-audit §1); the canonical case lives in this repository, and `prismatic_commit` is honestly `null` with a note.
