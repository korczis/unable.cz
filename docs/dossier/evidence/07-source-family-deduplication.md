# 07 — Source families and duplicate detection

Families (evidence.json `sourceFamilies`) group sources by ultimate upstream:

- **cz-state-register** — or.justice.cz/ARES and everything republishing it:
  SRC-03, 10, 11, 14 (mirrors) + SRC-12, 15–19 (authoritative channel). One
  family: a mirror can corroborate nothing the register itself says.
- **company-able** — SRC-01, 02, and SRC-06 (a founder's LinkedIn is
  subject-affiliated, not independent).
- **media-forbes** / **media-czechcrunch** — genuinely independent of each
  other; CzechCrunch pieces (SRC-05, 13, 22) are one family.
- **technical-dns / official-eu-vies / technical-ct / cz-isrs / cz-isir** —
  single-member families.

Per-claim inventory reports raw source count, independent family count and
primary-source count separately. The planner gate (GATE 9) fails the build if
a monoculture CORROBORATED claim drops its caveat, and `independentUpstreams`
can never exceed source records. After the 2026-07-18 upgrade there are zero
CORROBORATED-monoculture claims (the tests synthesize one to keep the gate
non-vacuous).
