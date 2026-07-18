/*
 * Tests for the financial-intelligence layer (finance-gen.mjs + validator).
 * Run by `npm test`.
 *
 * Prove: filed figures parse to the correct values (unit/period), derived
 * metrics carry formulas and resolve to real facts, the ~100M target is flagged
 * (never compared as a historical result), gaps are never zero, and the gate
 * fails on a planted orphan-fact metric (non-vacuous).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIR = join(ROOT, "static/data/dossier/finance");
const node = process.execPath;
execFileSync(node, ["scripts/dossier/finance-gen.mjs"], { cwd: ROOT });
const load = (n) => JSON.parse(readFileSync(join(DIR, n), "utf8"));

test("filed figures parse to correct values, units and periods", () => {
  const facts = load("facts.json").facts;
  const f = (concept, period) => facts.find((x) => x.concept === concept && x.period === period);
  assert.equal(f("net_turnover", "FY2024").value, 36319);
  assert.equal(f("net_turnover", "FY2023").value, 43079);
  assert.equal(f("net_turnover", "FY2024").unit, "thousand_czk");
  assert.equal(f("net_result", "FY2024").value, 631);
  assert.equal(f("total_assets", "FY2024").value, 71880);
  // registered capital is a point-in-time value in base CZK, not thousands
  assert.equal(f("registered_capital", "as_filed").value, 243715);
  assert.equal(f("registered_capital", "as_filed").unit, "czk");
  for (const x of facts) assert.equal(x.status, "FILED_FACT");
});

test("derived metrics carry a formula and resolve to real facts", () => {
  const facts = new Set(load("facts.json").facts.map((f) => f.id));
  const metrics = load("metrics.json").metrics;
  assert.ok(metrics.length >= 6);
  for (const m of metrics) {
    assert.ok(m.formula, `${m.id} no formula`);
    for (const id of [...m.numeratorFacts, ...m.denominatorFacts]) assert.ok(facts.has(id), `${m.id} → missing ${id}`);
    assert.ok(m.caveats);
  }
  // spot-check the net margin FY2024 = 631/36319 ≈ 1.7%
  const nm = metrics.find((m) => m.id === "MET-ALE-NET-MARGIN-FY2024");
  assert.ok(Math.abs(nm.value - 1.7) < 0.2);
});

test("the ~100M target is flagged, never compared as a historical result", () => {
  const cvf = load("claims-vs-filed.json").comparisons;
  const target = cvf.find((c) => /revenue target/i.test(c.claim));
  assert.match(target.classification, /TARGET|forward/i);
  assert.equal(target.periodMismatch, true);
  assert.equal(target.perimeterMismatch, true);
  assert.equal(target.filedComparator.period, "FY2024");
});

test("balance-sheet reconciliation is recorded and gaps are never zero", () => {
  const r = load("reconciliation.json").reconciliation;
  assert.ok(["PASSED_WITH_ROUNDING", "PASSED", "WARNING"].includes(r.state));
  for (const g of load("gaps.json").gaps) assert.notEqual(g.value, 0);
});

test("finance gate FAILS on a metric referencing a missing fact (non-vacuous)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "able-fin-"));
  try {
    cpSync(join(ROOT, "static/data"), join(tmp, "static/data"), { recursive: true });
    cpSync(join(ROOT, "scripts"), join(tmp, "scripts"), { recursive: true });
    const p = join(tmp, "static/data/dossier/finance/metrics.json");
    const j = JSON.parse(readFileSync(p, "utf8"));
    j.metrics[0].numeratorFacts = ["FIN-ALE-FY2024-NONEXISTENT"];
    writeFileSync(p, JSON.stringify(j, null, 2));
    assert.throws(() => execFileSync(node, ["scripts/dossier/finance-validate.mjs"], { cwd: tmp, stdio: "pipe" }));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
