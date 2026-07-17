# unable.cz

Minimalist static site built with **[Zola](https://www.getzola.org/)**, styled with **Tailwind CSS**, **[Flowbite](https://flowbite.com/)** + **Flowbite Typography**, and **[Alpine.js](https://alpinejs.dev/)**.

## Stack

- **[Zola](https://www.getzola.org/)** — static site generator (single Rust binary)
- **[Tailwind CSS](https://tailwindcss.com/)** — utility-first CSS, compiled locally / in CI
- **[Flowbite](https://flowbite.com/)** + **Flowbite Typography** — component/typography plugins for Tailwind
- **[Alpine.js](https://alpinejs.dev/)** — lightweight JS runtime
- **[Chart.js](https://www.chartjs.org/)**, **[Cytoscape.js](https://js.cytoscape.org/)**, **[p5.js](https://p5js.org/)** — dossier figures only, loaded on `/dossier/` and nowhere else

## Project layout

```
config.toml              # Zola configuration + [extra] SEO defaults
content/_index.md        # Homepage content (front matter)
content/dossier.md       # /dossier/ — public-source DD of Able.cz s.r.o., linked from the hero
templates/
  base.html              # Base layout + all SEO metadata (title/OG/JSON-LD) — the only place it's rendered
  index.html             # Homepage (the hero UNABLE link)
  dossier.html           # /dossier/ layout: prose + tables + Chart.js/Cytoscape/p5 figures
  404.html               # Not-found page
data/dossier/able/
  dossier.json           # The dossier's evidence: identity, claims, graph, financials, sources
scripts/dossier/
  client.js              # Figure renderers (copied to static/js/dossier.js by js:build)
  export.mjs             # Derives the static/data/able-cz/ web exports from dossier.json
static/data/able-cz/      # Normalized, downloadable exports (generated)
cases/DD-Able-CZ-2026-07-17/  # Reproducible case artifacts (Prismatic-style layout)
docs/dossier/             # Audit, tooling inventory, data model, source policy, guardrails
tailwind/input.css        # Tailwind entry + typographic scale
tailwind.config.js        # Tailwind + Flowbite + Flowbite Typography config
scripts/
  seo-validate.mjs       # Validates ./public: titles, canonicals, OG, JSON-LD, sitemap, no hardcoded hosts
  seo-validate.test.mjs  # Unit tests for the validator + regression tests for the UNABLE link
static/                   # Copied verbatim (CNAME, generated css/, js/)
```

Metadata (title, description, canonical, Open Graph, JSON-LD) is rendered
exclusively in `templates/base.html`, sourced from each page's front matter
with fallbacks in `config.toml`'s `[extra]` table. Child templates carry no
metadata blocks, so there's nothing to duplicate or drift.

Pages that assert evidence (`seo_type = "Report"`) must also declare where that
evidence came from, when a human last checked it, and how long the check is
good for; an overdue page renders a stale notice to its readers.

Run `npm run verify` (build + validate + test) before shipping. CI runs the same
gate and will not publish a build with broken metadata.

| Command | Purpose |
|---|---|
| `npm run verify` | Build + validate + test — the one to run |
| `npm run seo:validate` | Errors fail, warnings report |
| `npm run seo:validate:strict` | Warnings fail too |
| `npm run seo:validate:json` | Machine-readable, for CI |
| `npm test` | Unit + regression tests |

See **[docs/seo.md](docs/seo.md)** for the architecture and the front-matter
schema, and **[AGENTS.md](AGENTS.md)** for the rules when editing.

## The `/dossier/` page

The word **UNABLE** in the hero is an internal link (`get_url(path='@/dossier.md')`)
to `content/dossier.md` — a **public-source due-diligence review of Able.cz
s.r.o. (IČO 24278815)**, the company behind the domain able.cz. The link is
styled as a subtle color/emphasis variant of the poster typography (no
underline, no button styling), so it reads as part of the design rather than a
bolted-on link. It's a real, indexable, canonical page (in `sitemap.xml`, `200`
on direct visit), just not in any navigation menu (there isn't one).

**Scope and honesty.** The dossier is authorized by the site owner on the record
(see [AGENTS.md](AGENTS.md) → *Content about real parties*). It reviews **public
sources only**. Every statement carries an evidence status — `VERIFIED_PRIMARY`,
`CORROBORATED`, `SELF_REPORTED`, `ASSESSED`, `CONTRADICTED`, or `NOT_FOUND` — and
those are never collapsed into a single "score." Company identity is verified
against the ARES register; most marketing/performance claims are the company's
own and are labelled as such; filed financials were not retrieved and are marked
`NOT_FOUND` rather than estimated. The page **asserts no insolvency or
wrongdoing** — none was found — and says so in its disclaimer. Corrections go to
`corrections@unable.cz` (see [CORRECTIONS.md](CORRECTIONS.md)).

**How it's built.** The page renders from `data/dossier/able/dossier.json` via
Zola's `load_data`. Every figure (Chart.js status doughnut, Cytoscape
relationship graph, p5 evidence field) is a progressive enhancement over an
always-present data table, so the page is fully usable with JavaScript off.
`scripts/dossier/export.mjs` derives the normalized web exports under
`static/data/able-cz/`. Methodology and provenance:
[docs/dossier/](docs/dossier/), [METHODOLOGY.md](METHODOLOGY.md),
[DATA_PROVENANCE.md](DATA_PROVENANCE.md).

## Local development

Prerequisites: [Zola](https://www.getzola.org/documentation/getting-started/installation/) and Node.js 24+.

```bash
npm install          # install Tailwind, Flowbite, Alpine.js

npm run build        # compile CSS/JS then run `zola build` -> ./public
npm run dev           # compile CSS/JS then run `zola serve`
```

## Deployment

The built `./public` directory is published to the `gh-pages` branch, which GitHub Pages serves under the custom domain configured in `static/CNAME`.
