# 04 — Artifact storage

Content-addressed, append-only, inside the case bundle:

    cases/DD-Able-CZ-2026-07-17/
      artifacts/sha256/<first2>/<full-sha256>   raw bytes, canonical identity = hash
      artifacts/manifest.ndjson                 one JSON row per artifact version
      provider-runs.ndjson                      every fetch event, incl. failures
      sbirka-listin/                            legacy 2026-07-17 files (human names);
                                                registered in the same manifest flow by
                                                evidence.mjs with build-time hashing

Rules: an artifact file is never overwritten (writes are skipped if the hash
path exists); a changed remote yields a NEW manifest row (new version) for the
same URL; manifest append is deduped on (sha256, originalUrl); metadata lives
in the manifest, never in the blob. 54 content-addressed files + 8 legacy files
are registered as of 2026-07-18; `npm test` re-hashes all of them.

Restricted artifacts (execution filings with personal data) stay in the case
store and are excluded from the published files/ directory by publication
class. Known pre-existing limitation: those PDFs are tracked in this public
repository since commit 8004298 (before this phase); see 16-adversarial audit.
