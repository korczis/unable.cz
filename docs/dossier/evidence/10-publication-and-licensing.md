# 10 — Publication and licensing

Per-source licensing + publication classes live in evidence.json `sourceMeta`;
per-artifact `pubClass` gates what ships.

- **Published bytes**: official open data (ARES JSON, Registr smluv result
  pages, DNS/CT/VIES responses), public official filings (Sbírka listin
  financial statements), and able.cz snapshots (subject authorized the DD on
  record 2026-07-17; served as .html.txt with attribution via source records).
- **Hash-only**: media articles (Forbes, CzechCrunch) — copyrighted; the repo
  is public, so storing bodies would republish them. SHA-256 + HTTP metadata
  are the retrieval proof; quotation stays within short-extract bounds.
- **Never published**: execution filings (SL69/SL70) — public documents that
  nevertheless carry personal data (birth ID redacted from all derived text);
  published surface is metadata + hash + short factual extracts.
- **Never fetched**: LinkedIn (terms prohibit automated retrieval) — recorded
  as a blocked run; facts sourced there remain self/affiliated-reported.

Analyst/forensic tier = the case store (`cases/DD-Able-CZ-2026-07-17/`):
full manifests, run ledger, extraction outputs, raw artifacts. Public tier =
`static/data/able-cz/**` only, which is all Zola serves; GATE 10 + tests
prove the public tier carries no restricted bytes, PII, or local paths.
