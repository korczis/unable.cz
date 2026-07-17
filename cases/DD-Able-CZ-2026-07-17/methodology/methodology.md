# Methodology — DD-Able-CZ-2026-07-17

## Approach
Public-source (OSINT) due diligence. No data room, management interviews,
contracts, bank records, tax files, or source-code access were available; public
evidence does not substitute for them.

## Evidence status taxonomy
- **VERIFIED_PRIMARY** — a primary/authoritative source (e.g. ARES register).
- **CORROBORATED** — two or more independent sources agree.
- **SELF_REPORTED** — the company's own statement, not independently verified.
- **ASSESSED** — an analytical reading of cited evidence (never a bare fact).
- **CONTRADICTED** — credible sources materially disagree.
- **NOT_FOUND** — searched in public sources, unresolved in this pass.

These are never collapsed into a single "score." Severity of a risk is kept
separate from confidence in the evidence.

## Source tiers (priority order)
1. Official registries — ARES, justice.cz, ISIR.
2. The company's own pages (able.cz, /legal/gdpr).
3. Independent media (CzechCrunch, Forbes).
4. Registry aggregators/mirrors (kurzy.cz, hlídač státu).

A lower-tier lead is never promoted to a confirmed finding on its own.

## Identity resolution
able.cz → Able.cz s.r.o. (IČO 24278815) was fixed by matching the company's own
site details to the ARES register, not by the name pun. The link is asserted
only where the register and the site agree.

## Reproduction
```
node scripts/dossier/export.mjs   # regenerate exports from the dossier data
npm run build                     # css + js + data + zola
npm run seo:validate && npm test  # gates
```
Canonical data: `data/dossier/able/dossier.json`. Every claim carries source IDs
resolving to the source ledger. Re-verify against the live primary registers
before relying on any time-sensitive fact.

## Limitations
See `../unresolved/open-questions.md` and `../logs/collection-log.md` (which
records the failed ISIR retrieval and the login-gated insolvency detail).
