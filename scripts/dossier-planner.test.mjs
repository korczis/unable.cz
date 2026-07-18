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

test("two mirrors of the same register count as ONE independent upstream", () => {
  // CLM-16 cites SRC-10 + SRC-11 — both aggregator mirrors of cz_register.
  const c = byClaim("CLM-16");
  assert.equal(c.sourceRecords >= 2, true);
  assert.equal(c.independentUpstreams, 1, "SRC-10 + SRC-11 are the same upstream authority");
  assert.equal(c.monoculture, true);
  assert.ok(c.note, "a single-upstream CORROBORATED claim must carry the caveat");
});

test("two independent media outlets count as TWO upstreams", () => {
  // CLM-14 (Blackfish acquisition) cites SRC-04 (Forbes) + SRC-05 (CzechCrunch).
  const c = byClaim("CLM-14");
  assert.equal(c.independentUpstreams, 2);
  assert.equal(c.monoculture, false);
});

test("a primary filed document is distinguished from a mirror", () => {
  // CLM-26 (exekuce) rests on Sbírka listin primary documents.
  const c = byClaim("CLM-26");
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

test("relationship verification distinguishes independent media from single register", () => {
  const v = load("planner/verification.json").verification;
  const e5 = v.find((x) => x.edge === "e5"); // able → blackfish acquired 100%, Forbes+CzechCrunch
  assert.equal(e5.verificationState, "partially_verified");
  assert.equal(e5.independentUpstreams, 2);
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
    const m = j.claims.find((c) => c.monoculture && c.epistemicState === "CORROBORATED");
    delete m.note; // strip the honesty caveat
    writeFileSync(p, JSON.stringify(j, null, 2));
    assert.throws(() => execFileSync(node, ["scripts/dossier/validate.mjs"], { cwd: tmp, stdio: "pipe" }));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
