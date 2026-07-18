# 14 — Browser validation (2026-07-18, Chrome via MCP, local build)

Build under test: `zola build --base-url http://localhost:8899` (the
production build embeds absolute unable.cz script URLs, so a plain static
serve of `public/` runs the *deployed* JS — a pitfall worth recording).

| Flow | Result |
|------|--------|
| Open /dossier/; sections render (evidence layer, resolved questions, upgraded source registry) | PASS |
| 50 inline [CLM-xx]/[SRC-xx] prose markers become citation buttons | PASS |
| Click claim CLM-44 → inspector shows exact VZZ rows ("36319 42642", turnover 43079) | PASS |
| "Open original (PDF)" link → content-addressed SL68 PDF; SHA-256 re-computed in-browser matches manifest | PASS |
| Deep link #evd=CLM-44 survives reload and reopens the inspector | PASS |
| Esc closes; focus moves to the close button on open | PASS |
| Source SRC-12 → family, artifacts with hashes, retrieval history | PASS |
| CLM-01 → verbatim marketing quote + snapshot hash | PASS |
| SRC-16 (restricted) → metadata + hash only, no download link | PASS |
| SRC-21 (ISIR) → BLOCKED with HTTP-500 run history | PASS |
| Superseded claims absent from the claims table | PASS |
| Console errors after full interaction pass | none |

Fixed during validation: a DOM bug (insertBefore on an unattached node) that
broke the claim renderer — caught precisely because flows were driven in a
real browser. Mobile layout uses the same bottom-sheet dialog (max-h 85vh,
overflow scroll); not separately device-tested this pass.
