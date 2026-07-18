# 01 — Epistemic derivation layer

**Status: IMPLEMENTED & VALIDATED.** This is the concrete deepening built in this
pass. It takes the existing sourced dossier one epistemic level down — from
`source → entity → relationship → graph` to a model that separates what a source
*states* from what the case *claims*, measures how well each investigation
dimension is covered, names what is missing, records the propositions the
evidence speaks to but does not settle, and prioritizes what to do next.

**It invents no facts.** Every derived record carries a `derivedFrom` array of
the dossier record IDs (`CLM-*`, `CON-*`, `OQ-*`, `SRC-*`, `financials.notFound`)
it is computed from. A test and the integrity gate both enforce that every such
reference resolves to a real record. The derivations are `ASSESSED` analytical
readings on ordinal scales only — never invented magnitudes, never a numeric
probability.

## Pipeline

```
data/dossier/able/dossier.json          ← single source of truth (sourced, status-labelled)
  │
  ├─ scripts/dossier/export.mjs          → base public exports (lossless reshape)
  │     static/data/able-cz/{case,metadata,entities,relationships,claims,
  │                          evidence,timeline,financials,risks,sources}.json
  │
  ├─ scripts/dossier/derive.mjs          → epistemic projections (this layer)
  │     static/data/able-cz/{coverage,gaps,hypotheses,frontier,lineage}.json
  │
  └─ scripts/dossier/validate.mjs        → evidence-integrity gate (fails the build)

templates/dossier.html consumes ONLY the public exports for the epistemic
sections (Pokrytí šetření, Mezery v evidenci, Hypotézy, Fronta šetření).
```

`npm run data:build` runs export + derive; `npm run verify` runs
build → `data:validate` → `seo:validate` → tests.

## The five projections

### coverage.json — investigation coverage matrix
Ten dimensions (identity, ownership, management, financials, transactions, legal,
technical, commercial, media, procurement). For each: the sources checked, the
evidence-status distribution of the records touching it, and an `ASSESSED`
ordinal coverage state by a written rule:

- **strong** — a primary filed source + `VERIFIED_PRIMARY`, no contradiction.
- **adequate** — verified primarily or by ≥2 corroborating sources; minor gaps.
- **partial** — mostly `CORROBORATED` via aggregators/media, or a notable gap.
- **weak** — only `SELF_REPORTED`.
- **absent** — the dimension was not queried this pass (always paired with a gap).

The rule deliberately surfaces disputes: *legal* reads `adequate`, not `strong`,
because it contains the C 85424/85425 contradiction. *procurement* reads `absent`
because Hlídač státu / registr smluv were not queried (GAP-04).

### gaps.json — gap analysis
Every open question and every `financials.notFound` line becomes a structured gap
with an `ASSESSED` materiality and the recommended public source to close it
(taken from the dossier's own methodology notes where it names one). Absence of
evidence is modelled as a gap, never as a finding.

### hypotheses.json — hypothesis layer
The dossier already isolates its inferences and labels the "why" `NOT_FOUND`.
Each such inference is a hypothesis: a proposition the evidence speaks to but does
not settle. Ordinal state only (`proposed`, `plausible`, `supported`,
`strongly_supported`, `contradicted`, `rejected`, `unresolved`) — the gate
forbids a fact state (`VERIFIED_PRIMARY`/`CORROBORATED`) here. Each carries
supporting/contradicting record IDs, alternatives, a **falsification condition**,
and the next best evidence. Four are emitted (family relationship of the two
Faragas, Ventoux operational bearing, Grolig/Juhaňák statutory function,
Oslzla's Blackfish departure) — all already flagged in the dossier's notes.

### frontier.json — prioritized investigation frontier
One task per unresolved lead (each contradiction, each gap, each unresolved/
plausible hypothesis). Priority is an `ASSESSED` ordinal from a written rule
combining **materiality + resolvability (is a concrete public source known?) +
weakness of current confidence** — explicitly *not* graph degree. Every
contradiction produces a task (gate-enforced), so nothing is silently dropped.

### lineage.json — provenance index
One row per claim: `claim → source assertions → source records → retrieval
metadata` (title, tier, `retrievedAt`, whether the source is a primary filed
registry document). This is the chain the graph inspector's provenance view walks.

## Evidence-integrity gate (`validate.mjs`)

Seven gates, run against the source of truth **and** the shipped export bytes.
Any ERROR fails `npm run verify`:

1. every claim / identity field carries a resolvable source;
2. every relationship edge has a source **and** a stated reason (`why`);
3. a `CONTRADICTED` record references two real compared values;
4. **privacy** — no rodné-číslo-shaped token (`\d{6}/\d{3,4}`) in any public
   export (a test plants one and asserts the gate fails — the gate is not vacuous);
5. every derived record traces to a real record; no hypothesis wears a fact state;
   every hypothesis has a falsification condition;
6. an `absent` coverage dimension is always backed by an explicit gap (a
   failed/unqueried source may never be reported as "nothing there");
7. every contradiction has a frontier task; gaps reference known dimensions.

## What this is not

It is not new evidence. No provider ran in this pass; the underlying facts were
collected earlier and are unchanged. This layer re-expresses the *epistemics* of
that evidence — coverage, gaps, doubt, and next actions — with full provenance,
so the page can answer "what's solid, what's missing, and what to check next"
without asserting anything the sources do not support.
