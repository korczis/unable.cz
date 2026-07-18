/*
 * Address-first spatial layer for the Able.cz dossier.
 *
 * This derives a normalized ADDRESS layer from the dossier's existing sourced
 * records — it collects NO new data and invents nothing. Specifically it does
 * NOT fabricate RÚIAN identifiers, coordinates, buildings, parcels, ownership,
 * or title records: those require live ČÚZK/RÚIAN access that was not performed
 * this pass, so every such field is emitted as null with a `collected: false`
 * marker and turned into an explicit gap + frontier task instead of a guess.
 *
 * What it DOES do, honestly and deterministically:
 *   - extract address-shaped strings already present in dossier.json
 *     (legal-entity registered office, VAT/VIES address),
 *   - parse Czech address components (ulice, číslo popisné/orientační,
 *     část obce, PSČ, obec) without external calls,
 *   - classify each address's publication status and location role,
 *   - emit ONLY publication-safe records to static/data/able-cz/cadastre/.
 *
 * Privacy rule (docs/dossier/cadastre/07): a corporate registered office is a
 * public business identifier (public_with_context). Natural-person residential
 * addresses are prohibited and are neither collected nor published — none are
 * present in dossier.json, and none are added here.
 *
 * Usage:  node scripts/dossier/cadastre.mjs   (run after export.mjs/derive.mjs)
 * Output: static/data/able-cz/cadastre/{addresses,coverage,gaps,manifest}.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SRC = join(ROOT, "data/dossier/able/dossier.json");
const OUT = join(ROOT, "static/data/able-cz/cadastre");
const SCHEMA_VERSION = "1.0.0";

const d = JSON.parse(readFileSync(SRC, "utf8"));
const meta = d.meta || {};
const cutoff = meta.evidenceCutoff || null;
mkdirSync(OUT, { recursive: true });

// ---- deterministic Czech address parser -----------------------------------
// Fold diacritics for a match key only; the display form is preserved verbatim.
function foldKey(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a Czech address string into components. Returns a resolution state:
 *   exact    — street + number + obec all parsed
 *   partial  — obec parsed but some components missing
 *   ambiguous— multiple plausible parses (not merged)
 *   unresolved — could not parse an obec
 * Numbers: "526/5" = číslo popisné (descriptive) / číslo orientační (orientation).
 */
function parseCzAddress(raw) {
  const parts = String(raw || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const out = {
    raw,
    street: null,
    cisloPopisne: null,
    cisloOrientacni: null,
    castObce: null,
    psc: null,
    obec: null,
    country: "CZ",
    resolution: "unresolved",
  };
  if (!parts.length) return out;

  // Last part usually holds "PSČ obec" or just "obec".
  const last = parts[parts.length - 1];
  const pscM = last.match(/(\d{3}\s?\d{2})\s+(.+)$/);
  if (pscM) {
    out.psc = pscM[1].replace(/\s+/g, " ").trim();
    out.obec = pscM[2].trim();
  } else {
    out.obec = last;
  }

  // First part usually holds "ulice číslo".
  const first = parts[0];
  const numM = first.match(/^(.+?)\s+(\d+[a-z]?)(?:\/(\d+[a-z]?))?$/i);
  if (numM) {
    out.street = numM[1].trim();
    out.cisloPopisne = numM[2];
    out.cisloOrientacni = numM[3] || null;
  } else {
    out.street = first;
  }

  // Middle part(s), if any and not equal to obec, are the municipality part.
  if (parts.length >= 3) {
    const mid = parts[parts.length - 2];
    if (foldKey(mid) !== foldKey(out.obec)) out.castObce = mid;
  }

  if (out.street && out.cisloPopisne && out.obec) out.resolution = "exact";
  else if (out.obec) out.resolution = "partial";
  return out;
}

function canonicalKey(a) {
  return [foldKey(a.street), a.cisloPopisne, a.cisloOrientacni, foldKey(a.obec)]
    .filter(Boolean)
    .join("|");
}

// ---- extract address candidates from the sourced case ----------------------
// We only trust structured, register-grade address strings. Each candidate
// carries the record it came from and its evidence sources — full provenance.
const candidates = [];

// (1) legal-entity registered office + VIES address, from identity[].
// Only address-bearing fields: the registered office, or the VIES status line
// (which embeds an address). The bare DIČ value "CZ24278815" is NOT an address
// and is excluded by requiring a comma-separated address shape.
for (const f of d.identity || []) {
  const isRegOffice = /registered office|sídlo/i.test(f.field);
  const isVies = /VIES|VAT status/i.test(f.field);
  if (isRegOffice || isVies) {
    // VIES value is prefixed "Valid — Able.cz s.r.o., <addr>"; strip the lead-in.
    const val = String(f.value).replace(/^.*?—\s*/, "").replace(/^Able\.cz s\.r\.o\.,\s*/i, "");
    // Require an address shape: a street token followed by a number, comma-separated.
    if (/\d/.test(val) && /[A-Za-zÁ-ž].*\s+\d/.test(val) && val.includes(",")) {
      candidates.push({
        raw: val,
        subject: "able",
        subjectName: meta.subject,
        role: /VAT|VIES/i.test(f.field) ? "registered_office" : "registered_office",
        discoveredFrom: "identity:" + f.field,
        status: f.status,
        sources: f.sources || [],
      });
    }
  }
}

// (2) subject node `seat`, as corroboration of the same registered office.
for (const n of (d.graph?.nodes || []).map((x) => x.data)) {
  const seat = n.ident && n.ident.seat;
  if (seat && n.group === "subject") {
    candidates.push({
      raw: seat,
      subject: n.id,
      subjectName: n.label,
      role: "registered_office",
      discoveredFrom: "node:" + n.id + ".seat",
      status: "CORROBORATED",
      sources: n.sources || [],
    });
  }
}

// ---- resolve candidates into distinct addresses (deterministic ER) ---------
// Merge only on an identical canonical key (street+čp+čo+obec). No fuzzy merge.
const byKey = new Map();
for (const c of candidates) {
  const parsed = parseCzAddress(c.raw);
  const key = canonicalKey(parsed) || foldKey(c.raw);
  if (!byKey.has(key)) {
    byKey.set(key, {
      id: "address:able:" + (byKey.size === 0 ? "reg-office" : "addr-" + byKey.size),
      canonicalKey: key,
      ...parsed,
      role: c.role,
      // Publication classification (docs/dossier/cadastre/07):
      // a legal entity's registered office is a public business identifier.
      publication: "public_with_context",
      ownerType: "legal_entity",
      linkedEntities: [],
      rawObservations: [],
      // Explicitly NOT collected this pass — never invented:
      ruianAddressPointId: null,
      coordinates: null,
      building: null,
      parcels: [],
      ownership: null,
      title: null,
      collected: {
        components: true,
        ruian: false,
        geometry: false,
        building: false,
        parcel: false,
        ownership: false,
        title: false,
      },
      note:
        "Sídlo zapsané v rejstříku — veřejný firemní identifikátor. RÚIAN ID, " +
        "souřadnice, budova, parcela a vlastnictví NEBYLY v tomto průchodu " +
        "sbírány (vyžadují přímý přístup k ČÚZK/RÚIAN) a nejsou zde dopočítány.",
    });
  }
  const a = byKey.get(key);
  // Upgrade: fill any component this address is still missing from a richer parse
  // of a corroborating observation (e.g. registered-office string carries část
  // obce + PSČ that the VIES string omits). Never overwrite a non-null value.
  for (const comp of ["street", "cisloPopisne", "cisloOrientacni", "castObce", "psc", "obec"]) {
    if (a[comp] == null && parsed[comp] != null) a[comp] = parsed[comp];
  }
  if (a.street && a.cisloPopisne && a.obec) a.resolution = "exact";
  if (!a.linkedEntities.some((e) => e.entity === c.subject && e.role === c.role)) {
    a.linkedEntities.push({
      entity: c.subject,
      name: c.subjectName,
      role: c.role,
      status: c.status,
      sources: c.sources,
      discoveredFrom: c.discoveredFrom,
    });
  }
  a.rawObservations.push({ raw: c.raw, from: c.discoveredFrom, status: c.status, sources: c.sources });
  // Merge sources across corroborating observations.
  a.sources = [...new Set([...(a.sources || []), ...c.sources])];
}
const addresses = [...byKey.values()];

// ---- coverage (cadastral dimensions) ---------------------------------------
// Ordinal ASSESSED state, same vocabulary as the epistemic coverage layer.
const anyExact = addresses.some((a) => a.resolution === "exact");
const coverage = [
  {
    dimension: "address_identity",
    label: "Identita adresy",
    coverage: anyExact ? "adequate" : "partial",
    note: "Adresa sídla je doložena rejstříkem (SRC-03) a VIES (SRC-08); komponenty rozparsovány.",
    collected: true,
  },
  { dimension: "ruian_resolution", label: "RÚIAN adresní bod", coverage: "absent", note: "Nevyžádáno u RÚIAN/ČÚZK v tomto průchodu.", collected: false },
  { dimension: "building_resolution", label: "Budova", coverage: "absent", note: "Nevyžádáno u ČÚZK.", collected: false },
  { dimension: "parcel_resolution", label: "Parcely", coverage: "absent", note: "Nevyžádáno u ČÚZK katastru.", collected: false },
  { dimension: "property_ownership", label: "Vlastnictví nemovitosti", coverage: "absent", note: "List vlastnictví nevyžádán; sídlo ≠ vlastnictví.", collected: false },
  { dimension: "geometry", label: "Geometrie / souřadnice", coverage: "absent", note: "Žádné souřadnice nebyly sbírány ani dopočítány.", collected: false },
  { dimension: "address_history", label: "Historie adres", coverage: "partial", note: "Rejstřík eviduje jen aktuální sídlo v tomto datasetu; dřívější sídla nevyžádána.", collected: false },
];

// ---- gaps + frontier tasks (each absent dimension → an explicit gap) --------
const gaps = coverage
  .filter((c) => !c.collected)
  .map((c, i) => ({
    id: "GAP-CAD-" + String(i + 1).padStart(2, "0"),
    category: "cadastral",
    affectedDimension: c.dimension,
    expectedDatum: c.label,
    materiality: c.dimension === "property_ownership" ? "moderate" : "low",
    recommendedSource:
      c.dimension === "property_ownership"
        ? "ČÚZK — nahlížení do katastru / list vlastnictví (parcela pod Vlněna 526/5)"
        : c.dimension === "ruian_resolution"
        ? "RÚIAN VDP (vdp.cuzk.cz) — adresní místo"
        : "ČÚZK katastr / RÚIAN dataset",
    status: "blocked",
    blockedReason: "Vyžaduje přímý přístup k ČÚZK/RÚIAN; v tomto průchodu neproveden. Data se nedopočítávají.",
    derivedFrom: ["identity:Registered office"],
  }));

// ---- write publication-safe exports ----------------------------------------
function withHeader(kind, payload, extra = {}) {
  return {
    _export: {
      schemaVersion: SCHEMA_VERSION,
      kind,
      subject: meta.subject,
      ico: meta.ico,
      evidenceCutoff: cutoff,
      generatedAt: cutoff,
      publicationProfile: "public",
      coordinateSystem: null,
      source: "data/dossier/able/dossier.json",
      privacyNote:
        "Obsahuje pouze sídlo právnické osoby (veřejný firemní identifikátor). " +
        "Žádné adresy fyzických osob, žádné souřadnice soukromých míst, žádné " +
        "vlastnické záznamy fyzických osob. RÚIAN/parcely/vlastnictví nebyly sbírány.",
      ...extra,
    },
    ...payload,
  };
}
function write(name, kind, payload, extra) {
  writeFileSync(join(OUT, name), JSON.stringify(withHeader(kind, payload, extra), null, 2) + "\n");
  return "cadastre/" + name;
}

const written = [];
written.push(write("addresses.json", "cadastre-addresses", { addresses }, { count: addresses.length }));
written.push(write("coverage.json", "cadastre-coverage", { dimensions: coverage }, { count: coverage.length }));
written.push(write("gaps.json", "cadastre-gaps", { gaps }, { count: gaps.length }));
written.push(
  write("manifest.json", "cadastre-manifest", {
    files: ["addresses.json", "coverage.json", "gaps.json"],
    addressesPublished: addresses.length,
    naturalPersonAddressesPublished: 0,
    ruianResolved: 0,
    parcelsResolved: 0,
    ownershipRecords: 0,
    coordinatesPublished: 0,
    blockedDimensions: coverage.filter((c) => !c.collected).map((c) => c.dimension),
  })
);

console.log("Cadastre: derived " + addresses.length + " publication-safe address(es):");
for (const a of addresses) console.log("  - " + a.id + " [" + a.resolution + ", " + a.publication + "] " + a.raw);
console.log("  wrote: " + written.join(", "));
console.log("  BLOCKED (needs live ČÚZK/RÚIAN, not fabricated): ruian, building, parcel, ownership, geometry.");
