# CLAUDE.md

The working rules for this repository live in **[AGENTS.md](AGENTS.md)**; the
architecture behind them lives in **[docs/seo.md](docs/seo.md)**. Read AGENTS.md
before changing content or templates.

They are not duplicated here on purpose. Two copies of one rule set is the same
drift problem this repo's SEO design exists to prevent — a rule would be updated
in one file and quietly rot in the other.

The short version, if you read nothing else:

- Metadata is declared in front matter and rendered **only** in
  `templates/base.html`. Never hand-write a `<meta>` tag.
- Never write a literal `unable.cz`. Use `get_url()` / `current_url`;
  `config.toml`'s `base_url` is the only place the host is named.
- Run `npm run verify` (build + validate + test) before committing.
- Never bump `reviewed_at` without actually re-checking the sources.
- A dossier about anyone other than this site itself needs the owner's explicit
  sign-off. See "Content about real parties" in AGENTS.md.
