# 16 — Adversarial evidence audit

Performed 2026-07-18 after implementation, before final sign-off. Method:
attack the finished state with the checklist below; every check ran against
the real data (scripted where possible), not against documentation.

## Checks that PASSED (verified, not assumed)

| Attack | Result |
|--------|--------|
| Claims without exact evidence | 47/49 COMPLETE; the 2 non-complete are honest: CLM-57 (a zero-result page cannot quote its own emptiness — PARTIAL with preserved result pages) and CLM-58 (BLOCKED by definition). |
| Relationships without claim lineage | zero graph nodes/edges reference superseded claims; edges resolve predicates + sources; scripted sweep found NONE. |
| Financial values without row references | all 11 verified metrics carry statement-row citations verified at build. |
| Hashes without physical files / files without manifest | 54 content-addressed files ↔ manifest: zero orphans in either direction; every hash re-computed in tests. |
| Source records without retrieval runs | 107 provider-run rows cover every fetched source; SRC-22 explicitly carries "URL lost, no artifact" rather than a fabricated run. |
| Aggregator labelled primary | SRC-03's tier-1 mislabel fixed; planner SOURCE_MODEL SRC-12 corrected to primary; signing rule downgraded with caveat. |
| Duplicate sources counted independently | families enforced; zero CORROBORATED-monoculture claims remain; gate non-vacuity covered by a synthesized-defect test. |
| Assessments inside verified claims | the 9 offenders were split; remaining VERIFIED claims carry analysis only in labelled notes referencing ASSESSED claims. |
| Legal interpretation as observed fact | the fare-origin hypothesis moved to CLM-48 (ASSESSED); CLM-46 quotes the order verbatim; the six-instrument detail (accounts/income/movables/real-estate/podíly) was ADDED because the filed notice states it — the earlier "execution against his stake" was itself an undersimplification. |
| Stale gaps / completed tasks still open | four resolved questions moved to resolvedQuestions with resolving evidence; the export-level risk R-02 ("statements not retrieved") — a stale risk the audit found in the risk register itself — replaced. |
| Dead links without fallback | availability export + UI section; every register fact has a preserved artifact fallback; null-URL source renders unlinked. |
| Public artifact leaks | RESTRICTED artifacts have no download path (gate + test); published files re-hashed at validate; snapshots ship as .html.txt so they cannot render as site pages (this defect WAS found — by the SEO gate — and fixed). |
| UI controls opening nothing | every flow browser-driven (14-browser-validation.md); one real DOM bug found and fixed during that pass. |
| Docs claiming retrieval without artifacts | SRC-12 "40 artifacts" cross-checked against the manifest (exactly 40); Point FM corroboration attempt is documented as FAILED, and the invented-URL misstep for SRC-22 was caught in-session and replaced with an honest null-URL record. |

## Defects found by this audit and their disposition

1. **FIXED** — preserved able.cz snapshots initially published as `.html`,
   carrying able.cz canonicals into this site's SEO surface (caught by
   seo-validate; now `.html.txt`).
2. **FIXED** — claim inspector DOM crash (insertBefore) found in browser
   validation.
3. **FIXED** — planner tests pinned to superseded claim IDs and to a
   defect-class (CORROBORATED monoculture) that no longer exists in real data;
   re-pointed and made synthetic where needed.
4. **FIXED** — invented CzechCrunch URL briefly written to SRC-22; replaced
   with an explicit URL-lost record before it ever shipped. The audit then
   went one better: the real URL had been sitting in DATA_PROVENANCE.md
   (S-06) since the first pass — recovered, re-fetched, hash-preserved
   (149,040 B, sha256 c8e1f887…), and SRC-22 restored to a fully linked
   source. The "URL lost" claim itself was therefore a defect of this phase's
   own making — the earlier pass HAD recorded it, just not in dossier.json.
5. **ACCEPTED, DOCUMENTED** — SL69/SL70 PDFs (containing a birth ID) are
   tracked in this public repository since commit 8004298, predating this
   phase. This phase stopped the leak from widening (never published via
   exports, RESTRICTED class, PII gates) but did not rewrite git history.
   Recommendation: move raw restricted artifacts to private storage and purge
   history if the owner wants the stricter posture.
6. **ACCEPTED, DOCUMENTED** — the signing rule remains mirror-backed (ARES VR
   does not expose způsob jednání); labelled in-data, listed as an open
   question (justice.cz výpis PDF would resolve it).
7. **OPEN** — relationship rows in the edges table do not yet each carry their
   own inspector button (edge evidence is reachable via claims and the graph
   workspace); cell-level financial-table buttons are rendered via the
   evidence layer but the static financial table itself links per-claim, not
   per-cell. Logged as future UI work, not misrepresented as done.

## Verdict

No unresolved material defect: nothing in the published dossier asserts more
than its preserved evidence supports, failures are labelled as failures, and
the two accepted limitations are visible in-data rather than smoothed over.
