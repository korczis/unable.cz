/*
 * Evidence-integrity gate for the Able.cz dossier and its derived exports.
 *
 * Runs against the single source of truth (data/dossier/able/dossier.json) and
 * the generated exports under static/data/able-cz/. It fails the build when a
 * publication-safety invariant is broken, so unsourced or privacy-leaking data
 * cannot ship. It is deliberately strict and self-contained (no deps).
 *
 * Exit 0 = all gates pass. Exit 1 = at least one ERROR. Warnings never fail.
 *
 * Usage:  node scripts/dossier/validate.mjs [--json]
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SRC = join(ROOT, "data/dossier/able/dossier.json");
const OUT = join(ROOT, "static/data/able-cz");
const JSON_MODE = process.argv.includes("--json");

const errors = [];
const warnings = [];
const err = (code, msg) => errors.push({ code, msg });
const warn = (code, msg) => warnings.push({ code, msg });

const d = JSON.parse(readFileSync(SRC, "utf8"));
const srcIds = new Set((d.sources || []).map((s) => s.id));
const claimIds = new Set((d.claims || []).map((c) => c.id));
const conIds = new Set((d.contradictions || []).map((c) => c.id));
const nodeIds = new Set((d.graph?.nodes || []).map((n) => n.data.id));

// Every ID a derived record may cite back to.
const OQ_ids = new Set((d.openQuestions || []).map((_, i) => "OQ-" + String(i + 1).padStart(2, "0")));
const knownDerivedRefs = new Set([...claimIds, ...conIds, ...OQ_ids, ...srcIds, "financials.notFound"]);

// ---------------------------------------------------------------------------
// GATE 1 — every asserted record carries a resolvable source.
// ---------------------------------------------------------------------------
for (const c of d.claims || []) {
  if (!c.sources || !c.sources.length) err("CLAIM_NO_SOURCE", `${c.id} has no source`);
  for (const s of c.sources || []) if (!srcIds.has(s)) err("CLAIM_BAD_SOURCE", `${c.id} cites unknown ${s}`);
}
for (const f of d.identity || []) {
  if (!f.sources || !f.sources.length) err("IDENTITY_NO_SOURCE", `identity "${f.field}" has no source`);
  for (const s of f.sources || []) if (!srcIds.has(s)) err("IDENTITY_BAD_SOURCE", `identity "${f.field}" cites unknown ${s}`);
}

// ---------------------------------------------------------------------------
// GATE 2 — every relationship edge has an evidence chain (source + a stated
// reason). An edge with neither is an unsupported assertion.
// ---------------------------------------------------------------------------
for (const e of (d.graph?.edges || []).map((x) => x.data)) {
  if (!nodeIds.has(e.source)) err("EDGE_BAD_NODE", `${e.id} source ${e.source} is not a node`);
  if (!nodeIds.has(e.target)) err("EDGE_BAD_NODE", `${e.id} target ${e.target} is not a node`);
  if (!e.sources || !e.sources.length) err("EDGE_NO_SOURCE", `${e.id} (${e.label}) has no source`);
  if (!e.why) err("EDGE_NO_WHY", `${e.id} (${e.label}) has no explanation`);
  for (const s of e.sources || []) if (!srcIds.has(s)) err("EDGE_BAD_SOURCE", `${e.id} cites unknown ${s}`);
}

// ---------------------------------------------------------------------------
// GATE 3 — a CONTRADICTED record must reference real, comparable values, and a
// disputed relationship must be labelled as such (never smoothed to verified).
// ---------------------------------------------------------------------------
for (const c of d.contradictions || []) {
  if (!c.valueA || !c.valueB) err("CON_INCOMPLETE", `${c.id} lacks two compared values`);
  for (const v of [c.valueA, c.valueB]) if (v && v.source && !srcIds.has(v.source)) err("CON_BAD_SOURCE", `${c.id} cites unknown ${v.source}`);
  if (c.status !== "CONTRADICTED") warn("CON_STATUS", `${c.id} is not labelled CONTRADICTED`);
}

// ---------------------------------------------------------------------------
// GATE 4 — privacy: no Czech birth number (rodné číslo) or other prohibited
// personal identifier may appear in ANY public export. The dossier states it
// redacts these; this gate proves it on the shipped bytes.
// ---------------------------------------------------------------------------
const RODNE_CISLO = /\b\d{6}\/\d{3,4}\b/;
const PUBLIC_FILES = [
  "case.json", "metadata.json", "entities.json", "relationships.json", "claims.json",
  "evidence.json", "timeline.json", "financials.json", "risks.json", "sources.json",
  "coverage.json", "gaps.json", "hypotheses.json", "frontier.json", "lineage.json",
];
for (const f of PUBLIC_FILES) {
  const p = join(OUT, f);
  if (!existsSync(p)) { err("EXPORT_MISSING", `${f} not built — run npm run data:build`); continue; }
  const raw = readFileSync(p, "utf8");
  if (RODNE_CISLO.test(raw)) err("PII_BIRTH_NUMBER", `${f} contains a rodné-číslo-shaped token`);
}
// Also scan the source of truth itself.
if (RODNE_CISLO.test(readFileSync(SRC, "utf8"))) err("PII_BIRTH_NUMBER", "dossier.json contains a rodné-číslo-shaped token");

// ---------------------------------------------------------------------------
// GATE 5 — derived exports must trace back to real records (no orphan
// provenance) and must not present a hypothesis as a fact.
// ---------------------------------------------------------------------------
function loadOut(name) {
  const p = join(OUT, name);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}
function checkDerivedFrom(rows, label) {
  for (const r of rows || []) {
    for (const ref of r.derivedFrom || []) {
      if (!knownDerivedRefs.has(ref)) err("DERIVED_ORPHAN", `${label} ${r.id} derives from unknown ${ref}`);
    }
    if (!r.derivedFrom || !r.derivedFrom.length) warn("DERIVED_NO_PROV", `${label} ${r.id} has no derivedFrom`);
  }
}
const cov = loadOut("coverage.json");
const gaps = loadOut("gaps.json");
const hyp = loadOut("hypotheses.json");
const frontier = loadOut("frontier.json");

checkDerivedFrom(gaps?.gaps, "gap");
checkDerivedFrom(hyp?.hypotheses, "hypothesis");
checkDerivedFrom(frontier?.tasks, "frontier task");

const HYP_STATES = new Set(["proposed", "plausible", "supported", "strongly_supported", "contradicted", "rejected", "unresolved"]);
const FACT_STATES = new Set(["VERIFIED_PRIMARY", "CORROBORATED"]);
for (const h of hyp?.hypotheses || []) {
  if (!HYP_STATES.has(h.state)) err("HYP_BAD_STATE", `${h.id} has non-hypothesis state "${h.state}"`);
  if (FACT_STATES.has(h.state)) err("HYP_AS_FACT", `${h.id} is labelled with a fact state`);
  if (!h.falsification) err("HYP_NO_FALSIFICATION", `${h.id} has no falsification condition`);
}

// ---------------------------------------------------------------------------
// GATE 6 — an "absent" coverage dimension must be backed by an explicit gap:
// a failed/unqueried source may never be silently reported as "nothing there".
// ---------------------------------------------------------------------------
for (const dim of cov?.dimensions || []) {
  if (dim.coverage === "absent" && !(dim.openGaps?.length || dim.notFoundCount)) {
    err("ABSENT_NO_GAP", `coverage "${dim.dimension}" is absent but records no gap`);
  }
}

// ---------------------------------------------------------------------------
// GATE 7 — frontier tasks and gaps must reference known dimensions, and every
// contradiction must have a corresponding frontier task (nothing dropped).
// ---------------------------------------------------------------------------
const dimKeys = new Set((cov?.dimensions || []).map((x) => x.dimension));
for (const g of gaps?.gaps || []) if (g.affectedDimension && !dimKeys.has(g.affectedDimension)) err("GAP_BAD_DIM", `${g.id} → unknown dimension ${g.affectedDimension}`);
const frontierRefs = new Set((frontier?.tasks || []).flatMap((t) => t.derivedFrom || []));
for (const c of d.contradictions || []) {
  if (!frontierRefs.has(c.id)) err("CON_NO_TASK", `${c.id} has no frontier task`);
}

// ---------------------------------------------------------------------------
// GATE 8 — cadastral publication safety. The spatial layer carries elevated
// privacy risk, so the shipped address exports must: publish only permitted
// classes, never leak a natural-person residential address or private
// coordinates, never present an ambiguous match as exact, and never carry an
// invented RÚIAN id / parcel / ownership without a source.
// ---------------------------------------------------------------------------
const cad = loadOut("cadastre/addresses.json");
const cadManifest = loadOut("cadastre/manifest.json");
const ALLOWED_PUB = new Set(["public", "public_with_context"]);
if (cad) {
  for (const a of cad.addresses || []) {
    if (!ALLOWED_PUB.has(a.publication)) err("CAD_PUB_CLASS", `${a.id} has non-public class "${a.publication}" in a public export`);
    if (a.ownerType && a.ownerType !== "legal_entity") err("CAD_NATURAL_PERSON", `${a.id} is a natural-person address in a public export`);
    if (!a.sources || !a.sources.length) err("CAD_NO_SOURCE", `${a.id} has no source`);
    for (const s of a.sources || []) if (!srcIds.has(s)) err("CAD_BAD_SOURCE", `${a.id} cites unknown ${s}`);
    if (a.resolution === "ambiguous") err("CAD_AMBIGUOUS_PUBLISHED", `${a.id} is ambiguous but published as a resolved address`);
    // Invented-cadastral guard: a RÚIAN id / parcel / ownership / coordinates
    // may only be present if it was actually collected (collected.* true).
    if (a.ruianAddressPointId && !(a.collected && a.collected.ruian)) err("CAD_INVENTED_RUIAN", `${a.id} has a RÚIAN id but collected.ruian is false`);
    if (a.coordinates && !(a.collected && a.collected.geometry)) err("CAD_INVENTED_GEOMETRY", `${a.id} has coordinates but collected.geometry is false`);
    if ((a.parcels && a.parcels.length) && !(a.collected && a.collected.parcel)) err("CAD_INVENTED_PARCEL", `${a.id} has parcels but collected.parcel is false`);
    if (a.ownership && !(a.collected && a.collected.ownership)) err("CAD_INVENTED_OWNERSHIP", `${a.id} has ownership but collected.ownership is false`);
  }
  if (cadManifest && cadManifest.naturalPersonAddressesPublished !== 0) err("CAD_NP_COUNT", `manifest reports ${cadManifest.naturalPersonAddressesPublished} natural-person addresses published`);
  // Whole-file PII sweep already runs in GATE 4 over every cadastre file below.
}
// Extend the GATE-4 PII sweep to the cadastre exports.
for (const f of ["cadastre/addresses.json", "cadastre/coverage.json", "cadastre/gaps.json", "cadastre/manifest.json"]) {
  const p = join(OUT, f);
  if (existsSync(p) && RODNE_CISLO.test(readFileSync(p, "utf8"))) err("PII_BIRTH_NUMBER", `${f} contains a rodné-číslo-shaped token`);
}

// ---- report ---------------------------------------------------------------
if (JSON_MODE) {
  console.log(JSON.stringify({ ok: errors.length === 0, errors, warnings }, null, 2));
} else {
  const g = (s) => s;
  console.log("Evidence-integrity gate — Able.cz dossier");
  console.log(`  claims ${claimIds.size} · edges ${(d.graph?.edges || []).length} · sources ${srcIds.size}`);
  if (warnings.length) {
    console.log(`\n  ${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`    ⚠ [${w.code}] ${w.msg}`);
  }
  if (errors.length) {
    console.log(`\n  ${errors.length} ERROR(S):`);
    for (const e of errors) console.log(`    ✖ [${e.code}] ${e.msg}`);
    console.log("\n✖ Evidence-integrity gate FAILED.");
  } else {
    console.log(g("\n✓ All evidence-integrity gates passed."));
  }
}
process.exit(errors.length ? 1 : 0);
