# 19 — Claim Object System: adversarial audit

**Date:** 2026-07-18. Assume the implementation lies; try to catch it.

| Probe | Finding | Evidence |
|---|---|---|
| CLM rendered as text, not a link? | **Narrative fixed** (49 real `<a href>`); index + claim-page links server-rendered. In-table cells still JS-inspector (labelled PARTIAL). | browser: 49 `a.claim-ref` |
| `href="#"` / `javascript:void(0)` / click-only span? | **No.** Anchors point at real routes; middle-click/copy/keyboard work. | `claims-link.js`, claim template |
| Broken base-path links (GitHub Pages)? | **No.** All routes via `get_url`; narrative base via `window.__CLAIMS_BASE__` from `get_url`. | injected base = correct on serve + prod |
| Claim page requires JavaScript? | **No.** Pages are static Zola output; JS only auto-links prose. | `public/dossier/claims/clm-*/index.html` |
| Truncated proposition? | **No.** Full text, byte-identical to canonical — a test fails on drift/truncation. | `dossier-claims.test.mjs` |
| Superseded claim → 404? | **No.** All 9 render, show status + reason + successor links. | clm-16 → clm-28…32 |
| Dangling supersession link? | **No.** Validator + test reject unknown successors. | `claims-validate.mjs` |
| Counts inconsistent / silent gaps? | **No.** One manifest; validator fails on any mismatch; 58 = 49 + 9 stated. | manifest, tests |
| NOT_FOUND / BLOCKED false negatives? | **No.** Explicit non-inference wording ("z absence NELZE vyvodit"). | clm-57, clm-58 |
| Internal filesystem path in public output? | **Caught & fixed.** SRC-12 title leaked `cases/DD-Able-CZ-…/artifacts/`; stripped in the public claim JSON; validator + test guard it. | `safeTitle()`, `JSON_INTERNAL_PATH` |
| Private data / PII in JSON? | **No.** rodné-číslo scan over every shard passes. | validator gate 4 |
| Unknown CLM linked? | **No.** Only IDs in canonical data are linked; validator flags unknown narrative refs. | `claims-link.js`, `NARRATIVE_UNKNOWN_CLM` |
| Sitemap/noindex contradiction? | **Fixed.** Claim pages are indexable (consistent with the indexed main dossier); seo:validate 0 errors. | seo:validate |
| Docs overstate completion? | **No.** [18](18-final-report.md) labels context menu, evidence/source routes, graph-select deep link, table-cell navigation as PARTIAL/NOT IMPLEMENTED. | 18 |

## Material defects found & fixed this pass

1. **Internal path leak** in SRC-12's title → sanitized in the public projection.
2. **SEO sitemap/noindex contradiction** on generated pages → made indexable.
3. **Tera parse failure** on filtered string-concat in `get_url` → precomputed
   successor/predecessor link paths in the generator.

## Residual honest limitations

In-table CLM cells open the inspector rather than navigating; per-record
evidence/source/document/artifact routes and a dedicated CLM context menu are not
built yet. All labelled, none faked.
