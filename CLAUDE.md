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
- Run `npm run verify` (build + evidence-integrity gate + SEO validate + test)
  before committing. The dossier data pipeline is
  `dossier.json → export.mjs → derive.mjs → cadastre.mjs → planner.mjs → validate.mjs`; the epistemic
  projections (coverage/gaps/hypotheses/frontier) are **derived, never
  hand-authored**, and each row must trace back via `derivedFrom`. See
  `docs/dossier/depth/`.
- Never bump `reviewed_at` without actually re-checking the sources.
- `/dossier/` is a **public-source due diligence of Able.cz s.r.o. (IČO
  24278815)** — authorized by the owner on the record (2026-07-17). That scope
  is fixed: any *other* named third party needs the owner's explicit sign-off.
  See "Content about real parties" in AGENTS.md.
- Authorized subject does not mean invented facts. Every statement in the
  dossier is public-sourced and status-labelled (`VERIFIED_PRIMARY`,
  `CORROBORATED`, `SELF_REPORTED`, `CONTRADICTED`, `NOT_FOUND`); it asserts no
  insolvency or wrongdoing. If you cannot source it, cut it.
- From 2026-07-17, all `/dossier/*` content must be in Czech (prose only —
  evidence-status enum values, register IDs, and source titles stay as-is).
  See "Language policy for /dossier/*" in AGENTS.md.
