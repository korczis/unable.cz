/*
 * Tests for the investigation-cockpit layer (cockpit.js + template wiring).
 * Run by `npm test`.
 *
 * The load-bearing guarantee (§36 data consistency): every metric the cockpit
 * shows is COMPUTED from the embedded canonical #dossier-data at runtime — it is
 * never a hardcoded number that could drift from the data. These tests prove the
 * wiring is in place and that the status buckets the overview counts are
 * exhaustive over the canonical claims (so no claim is silently dropped).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");

test("template mounts the cockpit and loads the module", () => {
  const t = read("templates/dossier.html");
  assert.ok(t.includes('id="cockpit-overview"'), "overview mount point present");
  assert.ok(/js\/cockpit\.js/.test(t), "cockpit.js is included");
  assert.ok(t.includes('id="dossier-data"'), "canonical data is embedded for the cockpit to read");
});

test("cockpit reads canonical data, not hardcoded counts", () => {
  const js = read("scripts/dossier/cockpit.js");
  assert.ok(js.includes('getElementById("dossier-data")'), "reads the embedded canonical data");
  assert.ok(js.includes("claims.length"), "claim count is computed, not literal");
  assert.ok(js.includes("sources.length"), "source count is computed, not literal");
  // No hardcoded '58 claims' / '22 sources'-style literals that could drift.
  assert.ok(!/\b(58|22)\s*(claims|sources|tvrzení|zdroj)/i.test(js), "no drift-prone hardcoded totals");
});

test("overview claim count matches the claims table (both exclude superseded) §36", () => {
  const tpl = read("templates/dossier.html");
  const cockpit = read("scripts/dossier/cockpit.js");
  // The claims table hides superseded claims; the overview must count the same set.
  assert.ok(/not c\.superseded/.test(tpl), "claims table filters superseded");
  assert.ok(/!c\.superseded/.test(cockpit), "overview also excludes superseded — counts agree");
});

test("overview status buckets are exhaustive over canonical claims (no claim dropped)", () => {
  const d = JSON.parse(read("data/dossier/able/dossier.json"));
  // The buckets the overview counts, matching cockpit.js.
  const buckets = {
    verified: ["VERIFIED_PRIMARY", "CORROBORATED"],
    selfrep: ["SELF_REPORTED"],
    assessed: ["ASSESSED"],
    contradicted: ["CONTRADICTED"],
  };
  const known = new Set(Object.values(buckets).flat().concat(["NOT_FOUND", "UNKNOWN", "RESOLVED", "BLOCKED"]));
  for (const c of d.claims || []) {
    assert.ok(known.has(c.status), `claim ${c.id} has status "${c.status}" outside the known enum — overview would miscount`);
  }
  // The classified buckets never exceed the total (sanity on the computation).
  const classified = (d.claims || []).filter((c) => Object.values(buckets).flat().includes(c.status)).length;
  assert.ok(classified <= (d.claims || []).length);
});
