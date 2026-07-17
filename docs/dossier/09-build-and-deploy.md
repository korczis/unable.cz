# 09 — Build & deploy

## Commands
| Command | Does |
|---|---|
| `npm run css:build` | Tailwind → `static/css/main.css` |
| `npm run js:build` | Copies Alpine, Flowbite, Chart.js, Cytoscape, **p5**, and `client.js` → `static/js/` |
| `npm run data:build` | `node scripts/dossier/export.mjs` → `static/data/able-cz/*.json` |
| `npm run build` | css + js + data + `zola build` → `./public` |
| `npm run seo:validate` | Validates built `public/` (errors fail) |
| `npm test` | Unit + regression tests |
| `npm run verify` | build + validate + test — run before committing |

## Data flow
`data/dossier/able/dossier.json` is the source of truth. `zola build` renders
`/dossier/` from it via `load_data`; `export.mjs` derives the downloadable
exports. Both run inside `npm run build`, so a fresh checkout reproduces the site
without any database.

## Fresh-checkout reproduction
```
npm install
npm run build
npm run seo:validate && npm test
```
Prerequisites: Zola 0.22.x and Node 24+.

## Deploy
Built `./public` is published to `gh-pages`, served by GitHub Pages under the
`static/CNAME` custom domain (unable.cz) behind Fastly. Static only — no server,
no secrets, no runtime data dependency. CI runs the same `verify` gate before
publishing.

## Indexing policy
`/dossier/` is indexable and canonical. The downloadable JSON under
`static/data/able-cz/` is data, not routes. The 404 is `noindex` by design.
