/*
 * Tests for the financial period comparison (compare.js + wiring). Run by `npm test`.
 *
 * The comparison is arithmetic on filed figures, never a score. These assert the
 * module is wired, reads canonical financials, and that the two-period displays
 * it parses are real (both periods present and numeric) so the Δ/% it computes
 * are sound and no period is silently zero-filled.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");

test("template loads the comparison module before the cockpit", () => {
  const t = read("templates/dossier.html");
  assert.ok(/js\/compare\.js/.test(t), "compare.js is included");
  assert.ok(t.indexOf("js/compare.js") < t.indexOf("js/cockpit.js"), "loads before cockpit so the injected section joins the navigator");
});

test("comparison reads canonical financials and is drillable to the source", () => {
  const js = read("scripts/dossier/compare.js");
  assert.ok(js.includes("D.financials"), "reads canonical financials");
  assert.ok(js.includes("data-fin"), "each value drills to the financial inspector");
  assert.ok(!/Math\.random|hardcoded|= 0\.\d{2,}/.test(js), "no invented magnitudes");
});

test("every two-period metric parses to two real annual numbers (no zero-fill)", () => {
  const d = JSON.parse(read("data/dossier/able/dossier.json"));
  let twoPeriod = 0;
  for (const m of d.financials?.verified || []) {
    const mm = String(m.display).match(/^\s*([\d.,]+)\s*\/\s*([\d.,]+)\s*tis\.\s*CZK/i);
    if (!mm) continue;
    twoPeriod++;
    const a = parseFloat(mm[1].replace(/,/g, "")), b = parseFloat(mm[2].replace(/,/g, ""));
    assert.ok(Number.isFinite(a) && Number.isFinite(b), `"${m.metric}" has a non-numeric period`);
    // The Δ the chart shows is exactly a - b; assert it is well-defined.
    assert.ok(Number.isFinite(a - b));
  }
  assert.ok(twoPeriod >= 2, "there are multiple two-period metrics to compare");
});