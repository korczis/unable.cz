/*
 * Tests for the investigation-planner layer (planner.mjs) and its gates in
 * validate.mjs. Run by `npm test`.
 *
 * The load-bearing invariant is SOURCE INDEPENDENCE: two mirrors of the same
 * authority must count as ONE independent upstream, while two genuinely
 * separate origins count as two. And the gate must fail if a copy is ever
 * counted as independent, or a monoculture claim is shown as corroborated.
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

for (const s of ["export.mjs", "derive.mjs", "planner.mjs"]) execFileSync(node, ["scripts/dossier/" + s], { cwd: ROOT });
const load = (n) => JSON.parse(readFileSync(join(OUT, n), "utf8"));
const div = load("planner/diversity.json").claims;
const byClaim = (id) => div.find((c) => c.claim === id);

test("two register-family sources count as ONE independent upstream", () => {
  // CLM-35 cites SRC-12 (ARES) + SRC-10 (mirror) — both are the cz_register
  // upstream; official channel + mirror is still one authority, not two.
  const c = byClaim("CLM-35");
  assert.equal(c.sourceRecords >= 2, true);
  assert.equal(c.independentUpstreams, 1, "SRC-12 + SRC-10 are the same upstream authority");
  assert.equal(c.monoculture, true);
  // The caveat note is mandatory only for CORROBORATED monocultures (none
  // remain after the 2026-07-18 primary upgrade); ASSESSED rows carry their
  // basis in the claim itself.
});

test("two independent media outlets count as TWO upstreams", () => {
  // CLM-14 (Blackfish acquisition) cites SRC-04 (Forbes) + SRC-05 (CzechCrunch).
  const c = byClaim("CLM-14");
  assert.equal(c.independentUpstreams, 2);
  assert.equal(c.monoculture, false);
});

test("a primary filed document is distinguished from a mirror", () => {
  // CLM-46 (exekuce, split from the superseded CLM-26) rests on Sbírka listin
  // primary documents.
  const c = byClaim("CLM-46");
  assert.ok(c.primaryDirectCount >= 1, "must record ≥1 direct primary registry document");
});

test("independentUpstreams never exceeds sourceRecords, for every claim", () => {
  for (const c of div) assert.ok(c.independentUpstreams <= c.sourceRecords, `${c.claim} impossible independence`);
});

test("every planner task has an info-gain class and a resolvable origin", () => {
  const tasks = load("planner/tasks.json").tasks;
  const eig = new Set(["very_low", "low", "moderate", "high", "very_high"]);
  assert.ok(tasks.length > 0);
  for (const t of tasks) {
    assert.ok(eig.has(t.expectedInformationGain), `${t.id} bad EIG`);
    assert.ok(t.derivedFrom && t.derivedFrom.length, `${t.id} no origin`);
    assert.ok(t.whyRanked, `${t.id} no rationale`);
  }
});

test("relationship verification never overstates the evidence (enrichment-robust)", () => {
  const v = load("planner/verification.json").verification;
  // Invariant 1: a self-reported edge is never `verified` — always source_claimed
  // or unverified (a company's own word cannot verify itself).
  for (const e of v.filter((x) => x.epistemicState === "SELF_REPORTED")) {
    assert.ok(["source_claimed", "unverified"].includes(e.verificationState), `${e.edge} overstated`);
  }
  // Invariant 2: a single-upstream CORROBORATED edge is never `verified` — it is
  // single_upstream (one authority is not independent corroboration).
  for (const e of v.filter((x) => x.epistemicState === "CORROBORATED" && x.independentUpstreams <= 1)) {
    assert.equal(e.verificationState, "single_upstream", `${e.edge} single-authority shown as verified`);
  }
  // Invariant 3: independentUpstreams never exceeds the source count.
  for (const e of v) assert.ok(e.independentUpstreams <= (e.sources || []).length, `${e.edge} impossible independence`);
  // Invariant 4: the acquisition edge is register-confirmed (primary), so verified.
  const e5 = v.find((x) => x.edge === "e5");
  if (e5) {
    assert.equal(e5.verificationState, "verified");
    assert.ok(e5.upstreams.includes("cz_register"));
  }
});

test("planner gate FAILS when a copy is counted as independent (non-vacuous)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "able-plan-"));
  try {
    for (const dir of ["data", "static/data", "scripts"]) cpSync(join(ROOT, dir), join(tmp, dir), { recursive: true });
    const p = join(tmp, "static/data/able-cz/planner/diversity.json");
    const j = JSON.parse(readFileSync(p, "utf8"));
    j.claims[0].independentUpstreams = j.claims[0].sourceRecords + 5; // impossible
    writeFileSync(p, JSON.stringify(j, null, 2));
    assert.throws(() => execFileSync(node, ["scripts/dossier/validate.mjs"], { cwd: tmp, stdio: "pipe" }));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("planner gate FAILS when a monoculture CORROBORATED claim drops its caveat", () => {
  const tmp = mkdtempSync(join(tmpdir(), "able-plan2-"));
  try {
    for (const dir of ["data", "static/data", "scripts"]) cpSync(join(ROOT, dir), join(tmp, dir), { recursive: true });
    const p = join(tmp, "static/data/able-cz/planner/diversity.json");
    const j = JSON.parse(readFileSync(p, "utf8"));
    // The 2026-07-18 primary-source upgrade eliminated every real
    // CORROBORATED-monoculture claim, so synthesize the defect: the gate must
    // still fire if one ever reappears without its caveat.
    const m = j.claims[0];
    m.epistemicState = "CORROBORATED";
    m.monoculture = true;
    delete m.note; // strip the honesty caveat
    writeFileSync(p, JSON.stringify(j, null, 2));
    assert.throws(() => execFileSync(node, ["scripts/dossier/validate.mjs"], { cwd: tmp, stdio: "pipe" }));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
