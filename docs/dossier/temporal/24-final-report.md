# PROMPT-09 final report — temporal intelligence, snapshots, change detection

Delivered 2026-07-19. Statuses use only: IMPLEMENTED / VALIDATED / PARTIAL / BLOCKED / REJECTED / NOT IMPLEMENTED.

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Temporal defects found | VALIDATED | 11 defects D1–D11, docs 00 §3 |
| 2 | Destructive updates found | VALIDATED | every `static/data` generator overwrote in place; claims-gen rm-without-tombstone; stale case-dir copies (00 §3) |
| 3 | Temporal model | IMPLEMENTED | valid vs system time end-to-end; 7 timestamp kinds mapped (01); precision enum with no fabricated precision (unit-tested) |
| 4 | Revision ledger | IMPLEMENTED | immutable snapshot object layers + `history/objects.json` chains + change records (02); per-record reviewer identity honestly absent (limitation) |
| 5 | Snapshots created | VALIDATED | r01–r07 from the real deployed git history incl. withdrawal/republication events; refuse-on-divergence write; validator re-derives all hashes |
| 6 | Semantic hashing | VALIDATED | SHA-256 over canonical JSON, sorted id-lists; snapshot hash = Merkle-flat digest; reorder immunity unit-tested |
| 7 | No-op behavior | VALIDATED | HEAD == r07 proven (build exits without writing); temporal:build twice → zero git diff; r06→r07 cutoff move = INFORMATIONAL only |
| 8 | Change model | IMPLEMENTED | 362 CHG objects, 6 pairs, stable deterministic ids (validator-enforced), category WORLD/KNOWLEDGE/CORRECTION/PUBLICATION |
| 9 | Diff engine | VALIDATED | field-level, normalized, collection set-diffs; 1:1 semantic⇄recorded reconciliation enforced per pair |
| 10 | Materiality rules | IMPLEMENTED | explicit table (05/08); 28 HIGH / 96 MEDIUM / 222 LOW / 16 INFORMATIONAL |
| 11 | Epistemic-impact rules | IMPLEMENTED | status ladder + availability≠invalidation rule (unit-tested) |
| 12 | Freshness policies | IMPLEMENTED | 8 policies; deterministic as-of evaluation; states FRESH/DUE_SOON/DUE/STALE/BLOCKED/NOT_APPLICABLE; 104 monitored records |
| 13 | Revalidation planner | IMPLEMENTED | scored queue with provider, gain, dependents, stop condition; current top: ISIR (BLOCKED) |
| 14 | Provider-state history | IMPLEMENTED | from append-only provider-runs.ndjson, most-recent-outcome-wins; run-pair semantic comparison NOT IMPLEMENTED (11) |
| 15 | Document change detection | PARTIAL | exact-hash comparison inherent to the content-addressed store; normalized/structural diff not built — no re-fetched pair exists yet (12) |
| 16 | Narrative dependency tracking | PARTIAL | claim-anchor backlinks + build-failing reference validation; no first-class narrative_section objects (hand-authored prose, 13) |
| 17 | Routes created | VALIDATED | /dossier/changes/ (+124 change pages), /dossier/snapshots/ (+7), /dossier/history/, /dossier/revalidation/, /dossier/monitoring/ — all Czech, no-JS readable |
| 18 | Claim-history integration | IMPLEMENTED | "Historie ve snapshotech" on all 58 claim pages: revision chain, change links, frozen-state guarantee |
| 19 | Relationship-history integration | PARTIAL | chains in history/objects.json + currentness model + graph compare; no per-relationship page (relationships have no standalone routes in this dossier) |
| 20 | Entity-history integration | PARTIAL | same mechanism/limitation as 19; no ownership interpolation anywhere |
| 21 | Financial-history integration | IMPLEMENTED | FINANCIAL_PERIOD_ADDED / FINANCIAL_VALUE_CORRECTED types; NOT_FOUND→verified resolutions linked (e.g. CHG for FIN-NOTFOUND-equity → FIN-VERIFIED-equity); dedicated /dossier/finance/changes/ route REJECTED in favor of typed filter on /dossier/changes/ |
| 22 | Graph comparison | IMPLEMENTED | ?mode=changes&from&to: visual overlay only when target = rendered snapshot (honest refusal otherwise), always with table alternative; point-in-time snapshot rendering NOT IMPLEMENTED |
| 23 | Timeline lanes | IMPLEMENTED | realita / zdroje / publikace lanes, per-event text tags, ?lane= deep link (Playwright-proven) |
| 24 | Gap lifecycle | IMPLEMENTED | GAP_OPENED/GAP_RESOLVED with resolution links; 8 historical silent removals surfaced as MEDIUM review flags (audit 25 #10) — the defect class is now impossible to hide |
| 25 | Contradiction lifecycle | IMPLEMENTED | CONTRADICTION_OPENED/RESOLVED classification; real history shows only additions (1→3), none removed |
| 26 | Mobile | VALIDATED | 12 routes × 7 viewports (320–2560), hard no-overflow assertion — green locally AND against production |
| 27 | Accessibility | PARTIAL | text-labelled diffs (never color-only), table alternatives, native controls, aria-live, sr-only arrow semantics; no dedicated screen-reader e2e pass (19) |
| 28 | Validation results | VALIDATED | temporal:validate: 7 snapshots, 362 changes reconciled, 0 errors, 0 warnings; wired into npm run verify |
| 29 | Browser tests | VALIDATED | 92/92 locally and 92/92 against https://unable.cz (incl. comparison-URL cold load + Back/Forward, §52 journey items) |
| 30 | Snapshot proof | VALIDATED | reports/dossier-snapshot-proof.json: **PROVEN** — id `able-cz-public-2026-07-18-r07`, sha256 `5a2646a179cbc66f…8cad4292` identical across canonical/generated/built/deployed/page; object counts match |
| 31 | Git commits | VALIDATED | `068d761` (352 files) + this report commit |
| 32 | Push result | VALIDATED | main → origin, fast-forward |
| 33 | GitHub Actions | VALIDATED | run 29682123930 success (Build and Deploy), pages deployment 29682136606 success |
| 34 | Production snapshot ID | VALIDATED | able-cz-public-2026-07-18-r07 |
| 35 | Production URL | VALIDATED | https://unable.cz/dossier/ (+ /changes/, /snapshots/, /history/, /revalidation/, /monitoring/) |
| 36 | Known limitations | VALIDATED | provider-run pair diff (11), document structural diff (12), narrative section objects (13), non-adjacent N×N comparisons, per-entity history pages, screen-reader pass, historical gap-resolution records pending canonical authorship (25 #10) |
| 37 | Reproduction | VALIDATED | `npm run verify` (all gates); `npm run temporal:build` (no-op aware); `npm run temporal:bootstrap`; `node scripts/dossier/temporal/freshness.mjs --as-of=…`; `npm run test:responsive` (PW_BASE_URL=https://unable.cz for prod); `node scripts/dossier/temporal/production-proof.mjs` |

The system can now prove what the dossier said (frozen objects.json per snapshot), what changed (reconciled change ledger), why (field diffs + causing sources + category), which evidence caused it (source/evidence ids into the hashed artifact layer), and what production currently publishes (five-layer hash proof).
