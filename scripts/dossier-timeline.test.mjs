/*
 * Tests for the unified timeline (timeline.js + wiring). Run by `npm test`.
 *
 * The timeline shows only dated, sourced events from canonical data. These
 * assert it is wired and that every timeline milestone carries a date and a
 * source (so no timeline event is a dead end or an unsourced assertion).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");

test("template loads the timeline module before the cockpit", () => {
  const t = read("templates/dossier.html");
  assert.ok(/js\/timeline\.js/.test(t), "timeline.js included");
  assert.ok(t.indexOf("js/timeline.js") < t.indexOf("js/cockpit.js"), "loads before cockpit so its section joins the navigator");
});

test("timeline reads canonical events and links each to sources", () => {
  const js = read("scripts/dossier/timeline.js");
  assert.ok(js.includes("D.timeline"), "reads canonical d.timeline");
  assert.ok(js.includes("firstObserved"), "folds in dated relationship start-dates");
  assert.ok(js.includes("data-record"), "each source links through the record seam");
});

test("every timeline milestone is dated and sourced (no dead-end event)", () => {
  const d = JSON.parse(read("data/dossier/able/dossier.json"));
  const srcIds = new Set((d.sources || []).map((s) => s.id));
  assert.ok((d.timeline || []).length >= 3, "there is a real timeline");
  for (const t of d.timeline || []) {
    assert.ok(/\d{4}-\d{2}-\d{2}/.test(t.date || ""), `timeline event "${(t.event || "").slice(0, 30)}" lacks a full date`);
    assert.ok((t.sources || []).length, `timeline event "${(t.event || "").slice(0, 30)}" has no source`);
    for (const s of t.sources || []) assert.ok(srcIds.has(s), `timeline event cites unknown source ${s}`);
  }
});