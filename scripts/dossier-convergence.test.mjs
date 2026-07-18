/*
 * Convergence guards — prevent the evidence-cutoff drift that the production
 * proof (docs/dossier/convergence/13) caught: the page showed 2026-07-17 in the
 * subtitle (from canonical meta.evidenceCutoff) and 2026-07-18 in the freshness
 * panel (from front matter) at once, while 4 sources were actually retrieved on
 * the 18th. These pin the three to each other so they can never diverge again.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const dossier = JSON.parse(read("data/dossier/able/dossier.json"));

test("canonical evidenceCutoff equals the latest source retrieval date", () => {
  const latest = (dossier.sources || []).map((s) => s.retrievedAt).filter(Boolean).sort().pop();
  assert.equal(dossier.meta.evidenceCutoff, latest, "meta.evidenceCutoff must be the newest retrievedAt (the true cutoff)");
});

test("front-matter cutoff matches canonical meta.evidenceCutoff (no dual date on the page)", () => {
  const fm = read("content/dossier.md");
  const m = fm.match(/^cutoff\s*=\s*(\d{4}-\d{2}-\d{2})/m);
  assert.ok(m, "front matter declares a cutoff");
  assert.equal(m[1], dossier.meta.evidenceCutoff, "front-matter cutoff must equal canonical meta.evidenceCutoff");
});

test("front-matter sources_consulted matches the canonical source count", () => {
  const fm = read("content/dossier.md");
  const m = fm.match(/^sources_consulted\s*=\s*(\d+)/m);
  assert.ok(m, "front matter declares sources_consulted");
  assert.equal(+m[1], (dossier.sources || []).length, "sources_consulted must equal the real source count");
});

test("claim accounting is internally consistent (issued = live + superseded)", () => {
  const total = dossier.claims.length;
  const superseded = dossier.claims.filter((c) => c.superseded).length;
  const live = total - superseded;
  assert.equal(live + superseded, total, "issued = live + superseded");
});
