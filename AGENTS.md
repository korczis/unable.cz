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

The reason this section exists is legal, not stylistic. This site's premise —
*"We are UNABLE To PAY U"* — is a negation-pun. Publishing due-diligence-framed
analysis of a **named third party** here carries an implication about that
party's solvency before a reader reaches a single sentence. Neutral phrasing
cannot fix that, because the implication lives in the container, not the
wording. Where the subject is a real, operating company with real named people,
that is a defamation risk, and no amount of hedging in the prose neutralizes it.

**The default is still self-only:** absent an explicit decision, the subject of
any dossier on this site is this site. Do not name a third-party company as the
subject of an assessment here, however carefully worded, however well sourced,
and however the request is framed. That scope may change *only* by the site
owner's explicit, on-record decision — never as a judgement call made while
implementing a task.

> **Note on earlier wording.** Prior versions of this file (and of
> `content/dossier.md`) stated the site "writes about itself and nothing else."
> That is **superseded** by the authorization below. What is *not* superseded is
> every truthfulness rule: the lifted bar is only *who may be the subject*, not
> *what may be asserted*. The instinct that "the rules forbid publishing
> financials, ownership, or insolvency findings about a third party" was always
> about **inventing** them — sourced, status-labelled public facts are exactly
> what this dossier is built from, and unsourced ones remain forbidden for every
> subject, this site included.

### Authorized subject: Able.cz s.r.o. (on the record)

One subject beyond this site has been authorized by the owner
(korczis@gmail.com), **explicitly and on the record, on 2026-07-17**:
`/dossier/` (route `/dossier/`, source `content/dossier.md`) may carry a
**public-source** due-diligence review of **Able.cz s.r.o., IČO 24278815** — the
legal entity behind the domain able.cz, resolved by evidence (ARES registry +
the company's own site), not by name similarity. This is the **only** named
third party in scope. Any other named subject requires the same explicit,
on-record owner decision; do not add one on your own initiative.

That authorization does not relax the truthfulness rules — it tightens them.
The dossier must:

- use **public sources only**, each with an ID and a retrieval date in the
  source ledger; if a source could not be retrieved, record the failure rather
  than omit it (see the ISIR entry);
- label every statement by evidence status (`VERIFIED_PRIMARY`,
  `CORROBORATED`, `SELF_REPORTED`, `ASSESSED`, `CONTRADICTED`, `NOT_FOUND`) and
  never collapse them into a single score;
- **assert no insolvency, wrongdoing, or inability to pay** — none was found,
  and the site's negation-pun framing makes any such implication the specific
  risk this section exists to prevent. The dossier states this in its
  disclaimer;
- keep interpretation (`ASSESSED`) visibly separate from fact;
- rank sources by tier — official registry (ARES, justice.cz, ISIR) first, then
  the company's own pages, then independent media, then aggregators — and never
  promote a lower-tier lead to a confirmed finding on its own;
- carry a dated corrections path (`corrections@unable.cz`; see `CORRECTIONS.md`).

The full contract lives outside this file, so it does not rot here: the evidence
data model in `docs/dossier/03-data-model.md`, the source policy in
`docs/dossier/04-source-policy.md`, the status taxonomy in
`docs/dossier/05-claim-classification.md`, the reproduction steps in
`METHODOLOGY.md`, and the source-by-source provenance in `DATA_PROVENANCE.md`.
The dossier renders from `data/dossier/able/dossier.json`; the same evidence is
mirrored as normalized web exports under `static/data/able-cz/`.

If you cannot source a claim, cut it. `sources_consulted = 0` is an honest
declaration; an invented citation is not.

### Scope extension: Able.cz ownership/relationship network (on the record)

Extended by the owner (korczis@gmail.com), **explicitly and on the record, on
2026-07-17**: the authorization above covers not only Able.cz s.r.o. itself but
the **ownership and relationship network directly reached by recursive public-register
research starting from Able.cz's statutory officers/shareholders and its
acquisition of Blackfish & Co. s.r.o.** This was a deliberate scope decision,
made after this file's "do not add a named subject on your own initiative" rule
was raised against a first draft of that research — it is not a default any
future change may re-derive on its own.

Named individuals in scope under this extension: Václav Faraga, Tomáš
Melichárek, Radek Juhaňák, Petr Faraga, Jakub Kaman, Ondřej Kaman, Lukáš
Grolig, Vít Schlesinger, Lukáš Oslzla — and the companies through which their
register-documented roles connect back to Able.cz or Blackfish (e.g. FaMe
logistics/trade, FaMa Media, M&M plan, one label s.r.o., Mindee app, ERA25,
Verzuz.com, BGO, Usporix, VERASTO, Ventoux Studio, Vít Schlesinger s.r.o.,
Artstay/Lovs & Co., mySASY).

This extension does **not** relax the truthfulness rules — every fact under it
still needs a status label and a source, and most of it is `CORROBORATED` via
register-mirror aggregators (kurzy.cz, Hlídač státu), not `VERIFIED_PRIMARY`,
because a direct or.justice.cz fetch was blocked by its JS-rendered search UI in
every attempt made so far — see the dossier's own methodology note and CON-02.
It does **not** authorize adding any *further* named subject beyond this
specific network (e.g. a fresh, unrelated person or company) without a new,
separate on-record decision.

## Language policy for /dossier/*

**From 2026-07-17, all content under `/dossier/*` must be written in Czech.**
This covers `content/dossier.md` (and any future `content/dossier/*.md`) and
every user-facing string in `templates/dossier.html` — headings, labels, table
headers, aria-labels, captions. It does not cover:

- evidence-status enum values (`VERIFIED_PRIMARY`, `CORROBORATED`,
  `SELF_REPORTED`, `ASSESSED`, `CONTRADICTED`, `NOT_FOUND`) — these are
  identifiers the template pattern-matches on (`{% if c.status == 'CORROBORATED' %}`
  and similar in `templates/dossier.html`); translating the string would break
  the conditional. Keep them as-is; explain them in Czech prose around them.
- source titles/URLs, company/person names, IČO/DIČ and other register
  identifiers, and code identifiers in `data/dossier/*/dossier.json` (field
  names like `"status"`, `"sources"`, node/edge `id`s).
- the `_comment` / methodological notes inside `dossier.json` itself, which
  double as inline code documentation.

This is editorial guidance, not a lint rule — there is no automated check for
it (a check would need to parse rendered prose vs. structured fields, which is
out of scope for `scripts/seo-validate.mjs`). Treat a PR/commit that adds
English prose under `/dossier/*` as a review-blocking mistake, the same way an
unsourced claim is.

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
