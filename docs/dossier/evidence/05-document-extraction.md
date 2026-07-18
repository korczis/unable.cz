# 05 — Document extraction

Two extraction pipelines, both deterministic and parser-versioned:

1. **Structured registers** — `scripts/dossier/parse-ares.mjs` (v1.0.0) walks
   preserved ARES JSON artifacts and emits normalized assertions
   (`extraction/ares-assertions.json`): entity, predicate, who (name + birth
   year in public projections), value/stake/role, validFrom/validTo, plus a
   JSON pointer + artifact hash. IDs are content-derived (sha1 of
   artifact-hash|pointer|predicate) so re-runs are stable. 453 assertions from
   38 artifacts.
2. **Filed PDFs** — text extracted with pypdf (extractions preserved next to
   each PDF and hashed). Exact citations are authored as documentSpans with
   page + statement row + extraction line + verbatim text; `evidence.mjs`
   re-verifies each span against the extraction at build time, so a citation
   whose text is missing fails the build. Table values cite the filed line
   labels (e.g. "I. Tržby z prodeje výrobků a služeb", "A.V Výsledek…").

No OCR was needed (all PDFs carry text layers). Table-structure extraction
beyond row-level citation was not required for these filings.
