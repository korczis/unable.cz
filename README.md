# unable.cz

Minimalist static site built with **[Zola](https://www.getzola.org/)**, styled with **Tailwind CSS**, **[Flowbite](https://flowbite.com/)** + **Flowbite Typography**, and **[Alpine.js](https://alpinejs.dev/)**.

## Stack

- **[Zola](https://www.getzola.org/)** — static site generator (single Rust binary)
- **[Tailwind CSS](https://tailwindcss.com/)** — utility-first CSS, compiled locally / in CI
- **[Flowbite](https://flowbite.com/)** + **Flowbite Typography** — component/typography plugins for Tailwind
- **[Alpine.js](https://alpinejs.dev/)** — lightweight JS runtime

## Project layout

```
config.toml              # Zola configuration
content/_index.md        # Homepage content (front matter)
templates/
  base.html              # Base layout (head, styles, scripts)
  index.html             # Homepage
  404.html               # Not-found page
tailwind/input.css        # Tailwind entry + typographic scale
tailwind.config.js        # Tailwind + Flowbite + Flowbite Typography config
static/                   # Copied verbatim (CNAME, generated css/, js/)
```

## Local development

Prerequisites: [Zola](https://www.getzola.org/documentation/getting-started/installation/) and Node.js 24+.

```bash
npm install          # install Tailwind, Flowbite, Alpine.js

npm run build        # compile CSS/JS then run `zola build` -> ./public
npm run dev           # compile CSS/JS then run `zola serve`
```

## Deployment

The built `./public` directory is published to the `gh-pages` branch, which GitHub Pages serves under the custom domain configured in `static/CNAME`.
