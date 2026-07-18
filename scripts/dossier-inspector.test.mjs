/*
 * Tests for the context inspector + global search (inspector.js + wiring).
 * Run by `npm test`.
 *
 * Guarantees: the module is wired, it reads canonical #dossier-data (not
 * hardcoded records), and the entity relationships it renders resolve to real
 * graph nodes (so the "no dead end" entity navigation can never point nowhere).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");

test("template loads the inspector module", () => {
  const t = read("templates/dossier.html");
  assert.ok(/js\/inspector\.js/.test(t), "inspector.js is included");
});

test("inspector reads canonical data and cockpit's event seam", () => {
  const js = read("scripts/dossier/inspector.js");
  assert.ok(js.includes('getElementById("dossier-data")'), "reads embedded canonical data");
  assert.ok(js.includes("dossier:") && js.includes("-selected"), "listens on the cockpit selection events");
  assert.ok(js.includes("data-entity"), "entity links use data-entity");
});

test("every graph edge endpoint resolves to a real node (no dead-end entity link)", () => {
  const d = JSON.parse(read("data/dossier/able/dossier.json"));
  const ids = new Set((d.graph?.nodes || []).map((n) => n.data.id));
  for (const e of d.graph?.edges || []) {
    assert.ok(ids.has(e.data.source), `edge ${e.data.id} source ${e.data.source} has no node`);
    assert.ok(ids.has(e.data.target), `edge ${e.data.id} target ${e.data.target} has no node`);
  }
});

test("every claim referenced by a node exists (inspector claim backlinks resolve)", () => {
  const d = JSON.parse(read("data/dossier/able/dossier.json"));
  const claimIds = new Set((d.claims || []).map((c) => c.id));
  for (const n of d.graph?.nodes || []) {
    for (const cid of n.data.claims || []) {
      assert.ok(claimIds.has(cid), `node ${n.data.id} references missing claim ${cid}`);
    }
  }
});

test("inspector wires financial drill-down over canonical financials", () => {
  const js = read("scripts/dossier/inspector.js");
  assert.ok(js.includes("finByMetric") && js.includes("fin-drill"), "financial index + drill affordance present");
  assert.ok(js.includes("D.financials") || js.includes("F.financials") || js.includes("var F = D.financials"), "reads canonical financials");
});

test("every filed financial metric's sources resolve (drill-down never dead-ends)", () => {
  const d = JSON.parse(read("data/dossier/able/dossier.json"));
  const srcIds = new Set((d.sources || []).map((s) => s.id));
  const f = d.financials || {};
  for (const group of ["verified", "assessed", "selfReported"]) {
    for (const m of f[group] || []) {
      for (const s of m.sources || []) {
        assert.ok(srcIds.has(s), `financial "${m.metric}" cites missing source ${s}`);
      }
    }
  }
});

test("filed financial fact is kept separate from assessment", () => {
  const d = JSON.parse(read("data/dossier/able/dossier.json"));
  // A VERIFIED_PRIMARY filed figure carries a citation (the observed fact); any
  // interpretation lives in `note`, never conflated into the citation.
  for (const m of d.financials?.verified || []) {
    if (m.note && m.citation) {
      assert.notEqual(m.note, m.citation, `financial "${m.metric}" conflates fact and assessment`);
    }
  }
});
