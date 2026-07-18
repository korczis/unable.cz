# 12 — Validation report

`npm run verify` = build (css/js/data incl. evidence build-verify) +
`data:validate` + `seo:validate` + `npm test`. State at completion: all green
— 0 validator errors, 0 SEO errors, 61/61 tests (incl. 11 evidence-chain
tests).

Gates added this phase (validate.mjs GATE 10 + evidence.mjs build-fail):
live-claim evidence coverage; artifact-hash equality manifest↔file↔published;
span text-at-location verification; selector non-emptiness; superseded
lifecycle (no live links, valid successors, excluded from projections);
restricted-never-downloadable; site-relative download paths only; no PII /
full birth dates / filesystem paths in evidence exports; RESOLVED
contradictions must carry resolvedBy/resolvedAt; BLOCKED never rendered as
NOT_FOUND. Non-vacuity is tested: tampering with a published artifact, or
counting a mirror as independent, makes the build fail in tests.
