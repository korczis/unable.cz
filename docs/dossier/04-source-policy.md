# 04 — Source policy

## Tier order (highest first)
1. **Official registries** — ARES, justice.cz, ISIR, Sbírka listin.
2. **Company-controlled** — able.cz, `/legal/gdpr`.
3. **Independent media** — CzechCrunch, Forbes.
4. **Registry mirrors / aggregators** — kurzy.cz, hlídač státu.

A lower-tier lead is never promoted to a confirmed finding on its own. Two
independent tier-3 outlets that agree earn `CORROBORATED` (e.g. the Blackfish
acquisition); a single outlet stays `SELF_REPORTED`.

## Retrieval rules
- Passive reads only: no authentication, no active scanning, no intrusion.
- Record a **retrieval date** for every source.
- Record **failures** (unavailable/blocked/gated), never omit them. The ISIR
  HTTP 500 and the login-gated hlídač insolvency view are logged in
  `DATA_PROVENANCE.md` and the case `logs/`.

## Promotion / demotion
- Company self-statement about itself → `SELF_REPORTED`, even if plausible.
- A named client is evidence of a *stated* relationship, not of a quantified
  result.
- Register value overrides a company page on a factual conflict (see the court
  file: register C 85425 is authoritative over the page's C 85424).

## Personal data
Mask/omit private phone numbers, residential addresses, birth numbers, private
emails, and unrelated family data. Only legally relevant, publicly necessary
identity data is published (names of statutory officers are public register
facts).
