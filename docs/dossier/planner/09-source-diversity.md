# 09 — Source diversity & independence

**Status: IMPLEMENTED & VALIDATED.** The core new capability. It answers: *how
many genuinely independent authorities support this claim* — not how many source
records cite it.

## The problem it fixes

The dossier's evidence status `CORROBORATED` means "≥2 sources". But two of this
case's most-used sources — SRC-10 (kurzy.cz / rejstřík-firem) and SRC-11 (Hlídač
státu) — are **both aggregator mirrors of the same Czech commercial register**.
A claim citing both is cited twice but confirmed by **one** authority. Counting
that as independent corroboration overstates confidence. This engine refuses to.

## The rule (deterministic)

Every source is assigned an `upstream` = the ultimate authority it derives from
(`scripts/dossier/planner.mjs`, `SOURCE_MODEL`):

| upstream | sources | meaning |
|---|---|---|
| `able_cz` | SRC-01, SRC-02 | the company's own pages (first-party, controlled) |
| `cz_register` | SRC-03, 10, 11, 12, 14, 15–19 | the Czech commercial register / ARES / or.justice.cz — **one authority**, whether reached direct, via mirror, aggregator, or filed primary document |
| `forbes` | SRC-04 | independent outlet |
| `czechcrunch` | SRC-05, SRC-13 | independent outlet (both records = one outlet) |
| `linkedin` | SRC-06 | self-published profile |
| `dns` / `vies` / `crtsh` | SRC-07 / 08 / 09 | independent technical/official observations |

Per claim, `independentUpstreams` = count of **distinct** upstreams; `monoculture`
= `independentUpstreams ≤ 1`. Separately, `primaryDirectCount` counts direct
primary registry documents (Sbírka listin, SRC-15–19), because a filed primary
document is far stronger evidence than a mirror **even though it shares the
`cz_register` upstream** — independence and strength are tracked separately.

## Result for this case

- 27 claims → **24 monoculture** (single upstream), **14 company-controlled only**.
- The 3 multi-authority claims are the Blackfish acquisition and its
  register-plus-media corroborations (Forbes + CzechCrunch = two upstreams).
- The ownership-network claims (CLM-16…22), labelled `CORROBORATED`, are
  `independentUpstreams = 1 (cz_register)` — flagged with a caveat, never shown
  as independently confirmed. This is exactly the dossier's own methodology note,
  now computed.

## Enforcement (validate.mjs GATE 9)

- `PLAN_DIV_IMPOSSIBLE` — `independentUpstreams` may never exceed `sourceRecords`
  (a copy cannot add an authority).
- `PLAN_MONOCULTURE_UNFLAGGED` — a single-upstream `CORROBORATED` claim must
  carry the independence caveat.

A test asserts SRC-10 + SRC-11 → 1 upstream, and Forbes + CzechCrunch → 2; two
planted-violation tests prove the gate is non-vacuous.

## Limitation

The `upstream` mapping is an explicit, documented editorial judgement, not
auto-discovered. Treating the entire Czech register as one authority is
deliberately conservative: it can understate independence (a direct primary
filing is stronger than a mirror) but it can never overstate corroboration, which
is the failure mode that matters for a due-diligence dossier.
