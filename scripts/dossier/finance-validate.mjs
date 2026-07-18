/*
 * Financial-intelligence validator. Fails the build if a financial fact lacks a
 * source, a metric lacks a formula or references a missing fact, a public claim
 * is compared to a filed result without period+perimeter mismatch flags, or a
 * public shard leaks an internal path / rodné číslo.
 *
 * Usage: node scripts/dossier/finance-validate.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DIR = join(ROOT, "static/data/dossier/finance");
const errors = [];
const err = (c, m) => errors.push(`[${c}] ${m}`);
const load = (n) => (existsSync(join(DIR, n)) ? JSON.parse(readFileSync(join(DIR, n), "utf8")) : null);

const facts = load("facts.json");
const metrics = load("metrics.json");
const cvf = load("claims-vs-filed.json");
const gaps = load("gaps.json");
const recon = load("reconciliation.json");
if (!facts) err("NO_FACTS", "facts.json not generated — run finance-gen.mjs");

const factIds = new Set((facts?.facts || []).map((f) => f.id));

// facts: sourced, real values, no internal path / PII
for (const f of facts?.facts || []) {
  if (!f.sources || !f.sources.length) err("FACT_NO_SOURCE", `${f.id} has no source`);
  if (f.value == null || Number.isNaN(f.value)) err("FACT_BAD_VALUE", `${f.id} has no numeric value`);
  if (!f.unit) err("FACT_NO_UNIT", `${f.id} has no unit`);
  if (f.status !== "FILED_FACT") err("FACT_BAD_STATUS", `${f.id} status ${f.status} (expected FILED_FACT)`);
}

// metrics: formula + resolvable numerator/denominator facts
for (const m of metrics?.metrics || []) {
  if (!m.formula) err("MET_NO_FORMULA", `${m.id} has no formula`);
  if (!m.numeratorFacts?.length) err("MET_NO_NUM", `${m.id} has no numerator facts`);
  if (!m.denominatorFacts?.length) err("MET_NO_DEN", `${m.id} has no denominator facts`);
  for (const id of [...(m.numeratorFacts || []), ...(m.denominatorFacts || [])]) {
    if (!factIds.has(id)) err("MET_ORPHAN_FACT", `${m.id} references missing fact ${id}`);
  }
  if (m.value == null) err("MET_NO_VALUE", `${m.id} has no value`);
  if (!m.caveats) err("MET_NO_CAVEAT", `${m.id} has no caveat`);
}

// claim-vs-filed: a filed comparator implies explicit period + perimeter mismatch
for (const c of cvf?.comparisons || []) {
  if (c.filedComparator) {
    if (!c.periodMismatch) err("CVF_NO_PERIOD_FLAG", `${c.claim} compared to filed data without periodMismatch`);
    if (!c.perimeterMismatch) err("CVF_NO_PERIMETER_FLAG", `${c.claim} compared to filed data without perimeterMismatch`);
    if (!factIds.has(c.filedComparator.factId)) err("CVF_ORPHAN_FACT", `${c.claim} filed comparator references missing fact`);
  }
  if (/target/i.test(c.claim) && !/TARGET|forward/i.test(c.classification || "")) err("CVF_TARGET_AS_FACT", `${c.claim} target not classified as forward-looking`);
}

// gaps: never rendered as zero
for (const g of gaps?.gaps || []) {
  if (g.value === 0 || g.state === "ZERO") err("GAP_AS_ZERO", `${g.id} rendered as zero`);
  const OK = new Set(["NOT_COLLECTED", "NOT_FOUND", "BLOCKED", "NOT_PUBLIC", "REQUIRES_DATAROOM", "REQUIRES_MANAGEMENT_CONFIRMATION"]);
  if (!OK.has(g.state)) err("GAP_BAD_STATE", `${g.id} state ${g.state}`);
}

if (!recon?.reconciliation) err("NO_RECON", "reconciliation.json missing");

// scale comparison: sourced, clickable, non-consolidated, resolvable fact IDs
const scale = load("scale-comparison.json");
if (scale?.scaleComparison) {
  const sc = scale.scaleComparison;
  if (!/NON-CONSOLIDATED/i.test(sc.perimeter || "")) err("CMP_NOT_LABELLED", "scale comparison not labelled non-consolidated");
  if (!sc.caveats || !sc.caveats.length) err("CMP_NO_CAVEATS", "scale comparison has no caveats");
  for (const r of sc.rows || []) {
    if (!factIds.has(r.able.factId)) err("CMP_ORPHAN_ABLE", `${sc.id} row ${r.concept} → missing Able fact`);
    if (!factIds.has(r.blackfish.factId)) err("CMP_ORPHAN_BLF", `${sc.id} row ${r.concept} → missing Blackfish fact`);
    // Different-period comparison must be visible (Able vs Blackfish periods differ here)
    if (!r.able.period || !r.blackfish.period) err("CMP_NO_PERIOD", `${sc.id} row ${r.concept} lacks a period on a side`);
  }
  for (const s of sc.sourceLinks || []) if (!s.url) err("CMP_SOURCE_NO_URL", `${sc.id} source ${s.id} has no url`);
  if (!sc.derivedFromLinks?.length) err("CMP_NO_DERIVED", `${sc.id} has no derivedFrom links`);
}

// privacy sweep across all finance shards
for (const n of ["facts.json", "metrics.json", "claims-vs-filed.json", "reconciliation.json", "gaps.json", "scale-comparison.json", "manifest.json"]) {
  const p = join(DIR, n);
  if (existsSync(p)) {
    const raw = readFileSync(p, "utf8");
    if (/cases\/DD-Able-CZ|\/Users\/|artifacts\/sha256/.test(raw)) err("FIN_INTERNAL_PATH", `${n} leaks an internal path`);
    if (/\b\d{6}\/\d{3,4}\b/.test(raw)) err("FIN_PII", `${n} contains a rodné-číslo-shaped token`);
  }
}

console.log("Financial-intelligence validator");
console.log(`  facts ${facts?.facts.length || 0} · metrics ${metrics?.metrics.length || 0} · gaps ${gaps?.gaps.length || 0}`);
if (errors.length) {
  console.log(`\n  ${errors.length} ERROR(S):`);
  for (const e of errors) console.log("    ✖ " + e);
  console.log("\n✖ Financial validation FAILED.");
  process.exit(1);
}
console.log("\n✓ Financial layer: facts sourced, metrics carry formulas + resolvable facts, targets flagged, gaps never zero.");
