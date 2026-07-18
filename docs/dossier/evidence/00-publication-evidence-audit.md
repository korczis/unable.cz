# 00 — Publication evidence audit (rendered dossier vs. canonical data)

Audited 2026-07-18 against `data/dossier/able/dossier.json` (27 claims, 19
sources, 33 graph nodes, 48 edges, 2 contradictions, 10 open questions), the
rendered prose in `content/dossier.md`, and the physical case store
`cases/DD-Able-CZ-2026-07-17/`.

Method: every canonical record that the page renders (identity fields,
governance rows, financial metrics, claims table, relationship edges, timeline,
gaps) was checked for the full target chain
`claim → assertion → evidence span → artifact → source → provider run → hash`.
The current model implements only the first and the last-but-two links
(`claim → source`), so most defects below are *structural* (the chain type
doesn't exist yet), and the rest are *record-level* (a specific row is wrong,
stale, overloaded, or mislabelled).

## A. Structural defects (affect every record)

| # | Defect | Scope | Evidence |
|---|--------|-------|----------|
| A1 | `MISSING_ASSERTION` | all 27 claims, all 48 edges | No SourceAssertion / EvidenceSpan records exist anywhere in the repo. Claims cite whole sources (`SRC-xx`), never a passage, page, table, or field. |
| A2 | `MISSING_EXACT_CITATION` | all 8 VERIFIED_PRIMARY financial metrics | `financials.verified[*]` cite `SRC-15/18/19` with no page/line/row. The filed PDFs exist locally, so exact rows are extractable. |
| A3 | `ARTIFACT_HASH_MISSING` | all 8 preserved files | `cases/DD-Able-CZ-2026-07-17/sbirka-listin/` holds 5 PDFs + 3 text extractions; no manifest records their SHA-256, size, MIME, retrieval URL, or provider run. Hashes were computed for the first time during this audit. |
| A4 | `MISSING_ARTIFACT` | 13 of 19 sources | Only SRC-15..19 have preserved artifacts. SRC-01/02 (able.cz pages), SRC-04/05/13 (media), SRC-06 (LinkedIn), SRC-07 (DNS), SRC-08 (VIES), SRC-09 (crt.sh), SRC-10/11/14 (mirrors), SRC-12 (ARES) have none — the ARES fetch in the collection log (item 1) preserved nothing. |
| A5 | `SOURCE_FAILURE_MISCLASSIFIED` risk | ISIR | Collection log item 8: ISIR returned HTTP 5xx and was "recorded as NOT_FOUND". The log itself says "absence is not proof of absence", but NOT_FOUND is the wrong class for a provider failure — the correct state is BLOCKED. |
| A6 | No provider runs | all sources | No retrieval is recorded as a structured run (timestamp, HTTP status, bytes, outcome). The prose collection log is the only record. |

## B. Source-registry defects

| ID | Defect | Detail | Required fix |
|----|--------|--------|--------------|
| SRC-03 | `AGGREGATOR_ONLY` mislabelled as primary | Titled "Czech public register / ARES", tier 1, URL points at or.justice.cz — but its own `kind` admits the data came "via justice.cz-sourced mirrors: kurzy.cz, penize.cz, podnikatel.cz". Every `VERIFIED_PRIMARY` resting on SRC-03 (9 identity fields, both statutory officers, signing rule, edges e1/e2/e3/e13/e14/e15, timeline rows 1 & 3) is really mirror-backed → `INVALID_STATUS` on ~20 records. | Replace with a real primary fetch (ARES VR REST returns the full register record incl. officers/shareholders as official JSON — verified working 2026-07-18); reclassify SRC-03 as a mirror-family source. |
| SRC-10 + SRC-11 | `DUPLICATE_SOURCE` counted independently | kurzy.cz and Hlídač státu both republish or.justice.cz data — one upstream family. Claims marked CORROBORATED on SRC-10+SRC-11 alone (CLM-16, CLM-19, CLM-22, CLM-23; edges e22, e23, e40–e42, e44, e46, e47) have **one** independent family, not two. | Introduce source families; recount independence; upgrade via ARES VR primary instead. |
| SRC-10 only | `INVALID_STATUS` | Edges e24–e33, e37, e38, e43, e45 cite **only** SRC-10 yet carry status CORROBORATED — a single mirror source cannot corroborate. | Same as above. |
| SRC-06 | Source/usage mismatch | Edge e16 (Point FM ~5% investment) and node `zenx`'s Sluka attribution cite SRC-06 (Faraga's LinkedIn), but the `why` text attributes the facts to a CzechCrunch 2023-12-20 article that is **not in the source registry** → `MISSING_SOURCE`. | Register the actual article as its own source; relink e16/zenx. |
| SRC-12 | Unused registered source | ARES is registered (tier 1) but **zero** records cite it; identity cites the mirror-backed SRC-03 instead. | After the ARES VR fetch, identity/governance should cite ARES artifacts directly. |
| all | `PUBLICATION_RESTRICTION_UNKNOWN` | No source carries licensing/publication fields. Sbírka listin documents are public official records; media/LinkedIn HTML is copyrighted (metadata + short quotes only). Nothing records this distinction. | Add licensing/publication classification per source. |

## C. Claim-level defects

| Claim | Defects | Detail |
|-------|---------|--------|
| CLM-14 vs CLM-21 | `DUPLICATE_CLAIM` | CLM-21 restates CLM-14's acquisition with register corroboration. Keep both only with an explicit supersedes/strengthens link (present in a note today, not structured). |
| CLM-16 | `OVERLOADED_CLAIM` | Five distinct company roles (Mindee, Blackfish, ERA25, Verzuz, FaMe logistics) + an address-cluster observation in one claim. Split per company; keep the cluster reading as ASSESSED. |
| CLM-17 | `OVERLOADED_CLAIM` | M&M plan ownership + FaMe logistics co-role + a closed personal exekuce in one claim. |
| CLM-18 | `OVERLOADED_CLAIM` + inference embedded | Shareholding fact (~0.5%, 29 Jul 2025) + same-date-as-Blackfish observation + family-relationship inference. The note disclaims the inference, but it lives inside a CORROBORATED fact claim. |
| CLM-19 | Depends on CON-02 | Correct as stated (holdings confirmed, split disputed) — but resolvable to primary via ARES VR for IČO 02474727. |
| CLM-20 | `OVERLOADED_CLAIM` | Three companies + a negative-search conclusion ("reinforcing that his CTO title is a marketing role") — observation + assessment mixed. |
| CLM-23 | Fact + editorial judgment | Ventoux shareholding (fact) + "undisclosed … not mentioned in any coverage" (a negative-evidence assessment). Split. |
| CLM-24 | `OVERLOADED_CLAIM` | Blackfish exit + Artstay/Lovs link + absence-of-explanation, three propositions. |
| CLM-25 | Metric conflation (`UNSUPPORTED_INTERPRETATION`) | Text says "revenue … down from 43.1M CZK in FY2023"; the filed statement shows **revenue** FY2023 = 42,642 tis. and **net turnover** FY2023 = 43,079 tis. The claim mixes the two metrics. Also bundles the media-target comparison (assessment). |
| CLM-26 | `UNSUPPORTED_INTERPRETATION` + `OVERLOADED_CLAIM` | "consistent with an unpaid public-transport fine" — the filed execution order states creditor and amount, **not the cause**. Cause must move to an ASSESSED claim. Also bundles observed order + observed closure + materiality assessment. |
| CLM-27 | Fact + assessment | Filed Blackfish figures (fact) + "most of the scale evidently comes from Able" (assessment). Split. |
| financials.verified | Assessment embedded in VERIFIED_PRIMARY | Notes on revenue ("well below … target"), net result ("margin is thin and shrinking"), personnel costs ("consistent with a contractor-heavy delivery model") are analytical readings inside primary-verified metric records. |

## D. Relationship (graph) defects

| Edge(s) | Defects | Detail |
|---------|---------|--------|
| e1, e2 | Multi-predicate label | "statutory officer + shareholder" — two legal predicates (STATUTORY_REPRESENTATIVE_OF, SHAREHOLDER_OF) with different evidence and temporal state in one edge. |
| e24–e33, e37–e39, e43, e45 | `INVALID_STATUS` | CORROBORATED with a single mirror source (see B). |
| e16 | `MISSING_SOURCE` | See SRC-06 row above. |
| most edges | `MISSING_CLAIM_LINK` | Edges cite sources directly; only some carry `claims`. The chain edge→claim→evidence is not resolvable for e3, e13–e21, e24–e39, e43–e45. |
| e5 vs e40/e41 | Temporal imprecision | e5 "acquired 100%" firstObserved "2025"; register dates (28/29 Jul 2025) are known and should drive the transaction record. |

## E. Stale gaps and tasks

| Record | Defect | Detail |
|--------|--------|--------|
| openQuestions[0] | `GAP_ALREADY_RESOLVED` | "Filed financial statements … not retrieved in this pass" — contradicted by `financials.verified` (SRC-15 parsed) and the preserved SL68 PDF. Must be marked resolved with resolving evidence. |
| openQuestions[4] | Partially resolved | Combined headcount still open, but Able's own filed side is resolved; text half-updated. |
| openQuestions[5] (CON-02) | Resolvable | ARES VR for IČO 02474727 returns the primary shareholder record — retrieval task, not an open question. |
| openQuestions[9] | Stale premise | Claims all SRC-10/11 facts are blocked from primary because "the search UI is JS-rendered" — the **ARES VR REST endpoint** (official, structured, includes officers + shareholders + history) makes that premise obsolete. |
| timeline[1] | Imprecise | "2025" for the acquisition; register effective dates are known. |

## F. Identity/prose omissions surfaced during this audit (from the first
primary ARES VR fetch, 2026-07-18)

These are **new material facts** the mirror-based pass missed; they must enter
the dossier with primary evidence:

1. **Previous business name**: the company was registered 2012-10-03 as
   **"BIT CONSULTING s.r.o."** and renamed **Able.cz s.r.o. on 2016-11-14**
   (ARES VR `obchodniJmeno` history). The dossier nowhere mentions the former
   name.
2. **Court-file history**: originally registered at the **Municipal Court in
   Prague (MSPH C 200323)**; moved to **KSBR C 85425 on 2014-11-13**. The
   dossier's single "Court" value hides this, and it reframes CON-01: C 85424
   is wrong under either court's numbering, but the historical file adds
   context worth recording.
3. **Officer history is dated and interrupted** in the primary record (e.g.
   membership rows with `datumVymazu` in 2014/2017 for re-registrations); the
   dossier's flat "since 3 October 2012" rows are simplifications to re-derive
   from the primary record, not hand-kept.

## G. What is already sound

- The five Sbírka listin artifacts are real, lawfully obtained public filings,
  tracked in git; their text extractions match the PDFs.
- The claims table, statuses, and contradiction records render faithfully from
  `dossier.json` — no drift between page and canonical data was found (the
  page is generated, which is why every defect above is a data defect, not a
  template defect).
- The collection log honestly records failures (ISIR 5xx, blocked search UI).
- Personal-data minimization (rodné číslo redaction) is applied and documented.

## Defect totals

| Class | Count (records affected) |
|-------|--------------------------|
| MISSING_ASSERTION / no evidence-span layer | 27 claims + 48 edges (structural) |
| MISSING_ARTIFACT | 13 sources |
| ARTIFACT_HASH_MISSING | 8 files |
| MISSING_EXACT_CITATION | 8 financial metrics + all document-backed claims |
| AGGREGATOR_ONLY / INVALID_STATUS | ~20 records via SRC-03; ~18 edges via SRC-10/11 |
| DUPLICATE_SOURCE (family) | SRC-03/10/11/14 (one justice.cz family), media mirrors TBD |
| OVERLOADED_CLAIM | CLM-16, 17, 18, 20, 23, 24, 25, 26, 27 |
| UNSUPPORTED_INTERPRETATION | CLM-25 (metric mix), CLM-26 (cause), financial notes |
| DUPLICATE_CLAIM | CLM-14/21 |
| MISSING_SOURCE | CzechCrunch 2023 investment article (used, unregistered) |
| GAP_ALREADY_RESOLVED / stale | openQuestions 0, 4, 5, 9; timeline[1] |
| PUBLICATION_RESTRICTION_UNKNOWN | all 19 sources |
| SOURCE_FAILURE_MISCLASSIFIED | ISIR (NOT_FOUND vs BLOCKED) |

Fix strategy, in order: (1) retrieve primary ARES VR + registry artifacts for
all in-scope entities with hashed, manifested provider runs; (2) build the
evidence-span/assertion layer over the preserved artifacts; (3) split and
relink claims; (4) recalculate statuses under source-family rules; (5) project
into public exports and UI. See 02-primary-source-replacement-report.md and
03-evidence-data-model.md.
