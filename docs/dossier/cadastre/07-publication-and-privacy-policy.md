# 07 — Cadastral publication & privacy policy

The spatial layer carries elevated privacy risk: property data can expose where
private individuals live. This policy governs what may be published, and it is
**enforced by machine**, not just stated.

## Classification (every address/property record)

| Class | Meaning | Published? |
|---|---|---|
| `public` | Public infrastructure identifier (e.g. a municipality) | yes |
| `public_with_context` | Public business identifier (legal-entity registered office / corporate operating site) | yes, with the "registered office ≠ ownership ≠ operations" caveat |
| `analyst_only` | Investigation-relevant but privacy-sensitive (e.g. natural-person ownership record) | **no** |
| `private` | Personal data with no publication justification | **no** |
| `prohibited` | Must never appear in any export (birth number, private residence coordinates, unrelated co-owner) | **no** |

## Hard rules

Never publish, regardless of availability in an official source:
- a natural person's residential address or its coordinates;
- birth numbers (rodné číslo) or birth dates;
- ownership/title records naming natural persons;
- unrelated co-owners;
- inferred occupancy, wealth, or personal habits from property.

A corporate **registered office** may be published **with context** because it is
a public business identifier — but it must be labelled accurately as a registered
office, never asserted as ownership or as an operational HQ without evidence.

## Enforcement (validate.mjs, GATE 8)

The public export (`static/data/able-cz/cadastre/`) is machine-checked. The build
**fails** if any of these hold:

- an address has a class outside {`public`, `public_with_context`};
- an address has `ownerType` other than `legal_entity`;
- a published address lacks a source or cites an unknown source;
- an ambiguous match is published as a resolved address;
- a RÚIAN id / coordinates / parcel / ownership is present while its
  `collected.*` flag is false (i.e. an **invented** spatial field);
- the manifest reports any natural-person address published;
- a rodné-číslo-shaped token appears in any cadastre file.

Two tests plant a natural-person address and invented coordinates and assert the
gate fails, proving it is non-vacuous
(`scripts/dossier-cadastre.test.mjs`).

## What is withheld in this pass

No natural-person addresses were collected or published (the Znojmo natural-person
cluster referenced in the dossier's notes has **no concrete address string** in
the data and none was added). Parcel/building/ownership/coordinates are BLOCKED
(see [01](01-source-and-access-matrix.md)). The only published spatial record is
Able.cz s.r.o.'s registered office.
