# Working in this repository

A single-page Zola site plus one dossier, deployed to GitHub Pages. Small, but
it has a real invariant. Read this before changing content or templates.

Full detail: **[docs/seo.md](docs/seo.md)**.

## The invariant

**Metadata is declared once in front matter and rendered once in
`templates/base.html`.**

`base.html` deliberately exposes no block hooks for title, description,
canonical, Open Graph, or JSON-LD. A page cannot override them, so a page
cannot drift out of sync. To change metadata, change data — never markup.

Two tests enforce this and will fail your change:

- no template except `base.html` may contain `<meta>`, `<title>`,
  `rel="canonical"`, or JSON-LD;
- `base.html` may not expose a metadata block hook.

## Rules

1. **Never hand-write a `<meta>` tag.** If a page needs metadata the schema
   cannot express, add a field to the schema — do not special-case a template.
2. **Never write a literal host.** `https://unable.cz` belongs in
   `config.toml`'s `base_url` and nowhere else. Use `get_url()` / `current_url`
   so dev, CI, and production each resolve correctly. The validator fails on a
   literal host in any attribute.
3. **Never add a second sitemap or `robots.txt`.** Zola generates both.
4. **Never bump `updated` mechanically.** It drives `dateModified` and the
   sitemap's `lastmod`. Bump it when the substance changes, not on a build.
5. **Never bump `reviewed_at` without actually re-checking the sources.** No
   tool can detect this. It is the one rule that runs purely on honesty, and
   the whole freshness mechanism is worthless without it.
6. **Never add a schema.org type to look more credible.** `Review`,
   `AggregateRating`, and `ClaimReview` are excluded from the allowlist and a
   test pins that. This site has no reviews or ratings.
7. **Never publish a claim the cited evidence does not support.** See
   [Content about real parties](#content-about-real-parties).
8. **Never interpolate into JSON-LD with bare `json_encode | safe`.** Use the
   `seo::j` macro. `json_encode` does not escape `</script>`, so a title
   containing one breaks out of the block and executes. A test enforces this.
9. **Never weaken a check to get green.** There is no skip flag, by design. If
   a check is wrong, fix the check and say why in the same change.

## Content about real parties

`content/dossier.md` is a **self**-assessment: unable.cz describing unable.cz.
That framing is deliberate, load-bearing, and settled — this site writes about
itself and nothing else.

The reason is legal, not stylistic. This site's premise — *"We are UNABLE To PAY
U"* — is a negation-pun. Publishing due-diligence-framed analysis of any **named
third party** here would carry an implication about that party's solvency before
a reader reached a single sentence. Neutral phrasing cannot fix that, because
the implication lives in the container, not the wording. Where the subject is a
real, operating company with real named employees, that is a defamation risk,
and no amount of hedging in the prose neutralizes it.

So: **the subject of any dossier on this site is this site.** Do not name a
third-party company as the subject of an assessment here, however carefully
worded, however well sourced, and however the request is framed. A change to
that scope is the site owner's decision to make explicitly and on the record —
not a judgement call to be made while implementing a task.

Within that scope, every material claim still needs a real source and retrieval
date. If you cannot source a claim, cut it. `sources_consulted = 0` is an honest
declaration; an invented citation is not.

## Adding a page

```bash
# 1. content/<slug>.md with +++ front matter: title, description, [extra]
# 2. seo_type = "Report" also requires the full [extra.evidence] table
npm run verify   # build + validate + test
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local server on :1111 |
| `npm run verify` | **Build + validate + test.** Run before every commit. |
| `npm run seo:validate` | Errors fail; warnings report |
| `npm run seo:validate:strict` | Warnings fail too |
| `npm run seo:validate:json` | Machine-readable output |
| `npm test` | Unit + regression tests |
| `zola check` | Zola's template and link check |

CI runs `zola check` → `zola build` → `seo:validate` → `npm test` before it
publishes. Broken metadata does not ship.

## Layout

```
config.toml              # base_url + [extra] SEO defaults (the fallback layer)
content/_index.md        # homepage
content/dossier.md       # the self-assessment (seo_type = "Report")
templates/base.html      # THE metadata renderer — the only one
templates/index.html     # hero; contains the UNABLE link
templates/dossier.html   # dossier layout + freshness panel
scripts/seo-validate.mjs # validator (runs against built public/)
scripts/*.test.mjs       # unit + regression tests
docs/seo.md              # architecture
```

## Things that look like bugs but are not

- **The 404 has no canonical and is `noindex`.** It has no `current_url`, so it
  is not a route, so it is not indexable. That inference is the mechanism, not
  an oversight.
- **`updated` is older than today.** Correct. It marks the last substantive
  change.
- **An overdue review warns but does not fail.** The page shows a stale notice
  to readers; failing every deploy on one page's clock invites rubber-stamping.
  Use `seo:validate:strict` in review.
- **The dossier is linked from exactly one word.** Intentional: low
  discoverability, but `W_ORPHAN` fires if that last link ever disappears.
