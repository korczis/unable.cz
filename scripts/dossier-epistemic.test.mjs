/*
 * Tests for the epistemic derivation layer (derive.mjs) and the integrity gate
 * (validate.mjs). Run by `npm test` (node --test over scripts/*.test.mjs).
 *
 * These assert the load-bearing invariants of the deeper investigation layer:
 * derived records trace back to real evidence, hypotheses are never presented
 * as facts, an "absent" dimension always records a gap, and the gate actually
 * fails on a planted violation (so a green run means something).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "static/data/able-cz");
const node = process.execPath;

// Ensure exports + derivations are current before asserting on them.
execFileSync(node, ["scripts/dossier/export.mjs"], { cwd: ROOT });
execFileSync(node, ["scripts/dossier/derive.mjs"], { cwd: ROOT });

const load = (n) => JSON.parse(readFileSync(join(OUT, n), "utf8"));
const dossier = JSON.parse(readFileSync(join(ROOT, "data/dossier/able/dossier.json"), "utf8"));

const knownRefs = new Set([
  ...(dossier.claims || []).map((c) => c.id),
  ...(dossier.contradictions || []).map((c) => c.id),
  ...(dossier.sources || []).map((s) => s.id),
  ...(dossier.openQuestions || []).map((_, i) => "OQ-" + String(i + 1).padStart(2, "0")),
  "financials.notFound",
]);

test("every gap, hypothesis and frontier task traces back to a real record", () => {
  const rows = [
    ...load("gaps.json").gaps,
    ...load("hypotheses.json").hypotheses,
    ...load("frontier.json").tasks,
  ];
  assert.ok(rows.length > 0);
  for (const r of rows) {
    assert.ok(Array.isArray(r.derivedFrom) && r.derivedFrom.length, `${r.id} lacks provenance`);
    for (const ref of r.derivedFrom) assert.ok(knownRefs.has(ref), `${r.id} → orphan ${ref}`);
  }
});

test("a hypothesis is never labelled with a fact state", () => {
  const factStates = new Set(["VERIFIED_PRIMARY", "CORROBORATED"]);
  for (const h of load("hypotheses.json").hypotheses) {
    assert.ok(!factStates.has(h.state), `${h.id} masquerades as fact`);
    assert.ok(h.falsification, `${h.id} has no falsification condition`);
  }
});

test("an 'absent' coverage dimension always records a gap", () => {
  for (const dim of load("coverage.json").dimensions) {
    if (dim.coverage === "absent") {
      assert.ok(dim.openGaps.length || dim.notFoundCount, `${dim.dimension} absent without a gap`);
    }
  }
});

test("every contradiction produces a frontier task", () => {
  const refs = new Set(load("frontier.json").tasks.flatMap((t) => t.derivedFrom || []));
  for (const c of dossier.contradictions || []) assert.ok(refs.has(c.id), `${c.id} has no task`);
});

test("integrity gate passes on the clean, shipped exports", () => {
  execFileSync(node, ["scripts/dossier/validate.mjs"], { cwd: ROOT }); // throws on non-zero exit
});

test("integrity gate FAILS on a planted birth-number leak (non-vacuous)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "able-gate-"));
  try {
    // Copy the repo skeleton the validator reads, then plant a rodné číslo.
    cpSync(join(ROOT, "data"), join(tmp, "data"), { recursive: true });
    cpSync(join(ROOT, "static/data"), join(tmp, "static/data"), { recursive: true });
    cpSync(join(ROOT, "scripts"), join(tmp, "scripts"), { recursive: true });
    const leak = join(tmp, "static/data/able-cz/claims.json");
    const j = JSON.parse(readFileSync(leak, "utf8"));
    j._planted = "debtor 900101/1234"; // rodné-číslo-shaped token
    writeFileSync(leak, JSON.stringify(j, null, 2));
    assert.throws(
      () => execFileSync(node, ["scripts/dossier/validate.mjs"], { cwd: tmp, stdio: "pipe" }),
      /./,
      "gate should have failed on planted PII"
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
