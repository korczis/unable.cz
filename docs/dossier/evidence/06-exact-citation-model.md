# 06 — Exact-citation model

Three citation shapes, one guarantee: the cited content is provably where the
citation says, or the build fails.

| Shape | Anchor | Verified how |
|-------|--------|--------------|
| documentSpan | PDF page + statement row + extraction line + exactText | line-window text match against the preserved extraction |
| webSpan | preserved snapshot + `contains[]` verbatim substrings + display quote | byte-level substring check against the snapshot |
| assertion | JSON pointer into a hashed ARES artifact | pointer produced by the deterministic parser from those bytes |

Financial metrics in `financials.verified` carry per-cell `citation` +
`evidence` IDs; the UI opens the exact row and the original filing. Claims
carry citations through `evidence.json` links. Inline prose markers
([CLM-xx]/[SRC-xx]) are converted client-side into buttons that open the same
records — one citation model everywhere.
