# 02 — Address model & normalization

**Status: IMPLEMENTED & VALIDATED** (deterministic, no external calls) for the
address strings present in the sourced dossier.

An address is an investigative object, not a formatted string. `cadastre.mjs`
extracts address candidates from the dossier's sourced records, parses Czech
components deterministically, resolves duplicates on an exact canonical key, and
classifies each for publication.

## Extraction

Only address-bearing, register-grade fields are trusted: the legal-entity
**registered office** (`identity` field) and the **VIES** status line (which
embeds an address). The bare DIČ value (`CZ24278815`) is explicitly excluded — it
is not an address. Each candidate carries its originating record and evidence
sources.

## Parse (Czech)

`parseCzAddress` splits on commas and resolves:
- `street` (ulice), `cisloPopisne` (číslo popisné / descriptive) and
  `cisloOrientacni` (číslo orientační / orientation) from a `526/5`-style token;
- `castObce` (municipality part), `psc` (PSČ), `obec` (municipality);
- `country` (CZ).

Resolution state: `exact` (street+číslo+obec parsed), `partial`, `ambiguous`
(never merged), `unresolved`. Diacritics are folded **only** for the match key;
the display form is preserved verbatim.

## Resolution (entity resolution for addresses)

Candidates merge **only** on an identical canonical key
(`fold(street)|čp|čo|fold(obec)`) — never on fuzzy text similarity. On merge,
missing components are upgraded from a richer corroborating parse (e.g. the
registered-office string supplies `Trnitá` + `602 00` that the shorter VIES
string omits), and sources are unioned. Result for able.cz: one address,
`exact`, corroborated by SRC-01/02/03/08.

## Not collected (never invented)

`ruianAddressPointId`, `coordinates`, `building`, `parcels`, `ownership`, `title`
are emitted as `null`/`[]` with a `collected.*: false` flag. The validator forbids
any of these from being non-null while its `collected` flag is false, so an
invented RÚIAN id or coordinate cannot ship. Each is turned into a BLOCKED gap and
a frontier task instead (see [15](15-open-questions.md)).

## Output

`static/data/able-cz/cadastre/{addresses,coverage,gaps,manifest}.json`, consumed
by the "Adresy a prostorový kontext" section of `/dossier/`.
