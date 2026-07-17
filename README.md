# unable.cz

Minimalist static site built with **[Zola](https://www.getzola.org/)**, styled with **Tailwind CSS**, **[Flowbite](https://flowbite.com/)** + **Flowbite Typography**, and **[Alpine.js](https://alpinejs.dev/)**.

## Stack

- **[Zola](https://www.getzola.org/)** — static site generator (single Rust binary)
- **[Tailwind CSS](https://tailwindcss.com/)** — utility-first CSS, compiled locally / in CI
- **[Flowbite](https://flowbite.com/)** + **Flowbite Typography** — component/typography plugins for Tailwind
- **[Alpine.js](https://alpinejs.dev/)** — lightweight JS runtime

## Project layout

```
config.toml              # Zola configuration + [extra] SEO defaults
content/_index.md        # Homepage content (front matter)
content/dossier.md       # /dossier/ — self-assessment page, linked from the hero
templates/
  base.html              # Base layout + all SEO metadata (title/OG/JSON-LD) — the only place it's rendered
  index.html             # Homepage
  dossier.html           # /dossier/ page (Flowbite Typography for the body copy)
  404.html               # Not-found page
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
to `content/dossier.md` — a short, self-referential "due-diligence" style
write-up about the site itself. It's styled as a subtle color/emphasis
variant of the existing poster typography (no underline, no button styling),
reusing the site's existing gold accent family so it reads as part of the
design rather than a bolted-on link. It's a real, indexable, canonical page
(included in `sitemap.xml`, `200` on direct visit) — not hidden from crawlers,
just not in any navigation menu (there isn't one).

## Local development

Prerequisites: [Zola](https://www.getzola.org/documentation/getting-started/installation/) and Node.js 24+.

```bash
npm install          # install Tailwind, Flowbite, Alpine.js

npm run build        # compile CSS/JS then run `zola build` -> ./public
npm run dev           # compile CSS/JS then run `zola serve`
```

## Deployment

The built `./public` directory is published to the `gh-pages` branch, which GitHub Pages serves under the custom domain configured in `static/CNAME`.
