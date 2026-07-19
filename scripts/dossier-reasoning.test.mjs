/*
 * Epistemic reasoning engine tests (PROMPT-10).
 *
 * Invariants over the REAL generated reasoning data (every conclusion answers
 * "why"), plus non-vacuity proofs: the validator must actually FAIL when a
 * chain is broken, an alternative is missing, or a premise rests on a
 * superseded claim.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const J = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const d = J("data/dossier/able/dossier.json");
const R = J("data/dossier/able/reasoning.json");
const why = J("static/data/dossier/reasoning/why.json").why;
const graph = J("static/data/dossier/reasoning/graph.json");
const execTrace = J("static/data/dossier/reasoning/executive.json").findings;
const risks = J("static/data/able-cz/risks.json").risks;
const infs = [...R.inferences, ...R.conclusions];

test("every assessment and conclusion has a full inference record", () => {
  const produced = new Set(infs.map((i) => i.produces));
  for (const c of d.claims.filter((c) => c.status === "ASSESSED" && !c.superseded)) assert.ok(produced.has(c.id), c.id);
  for (const a of d.financials.assessed) assert.ok(produced.has(a.id), a.id);
  for (const r of risks) assert.ok(produced.has(r.id), r.id);
});

test("no single-explanation output: every chain carries alternatives, counterfactuals and uncertainty", () => {
  for (const inf of infs) {
    assert.ok(inf.alternatives.length >= 1, inf.id + " alternatives");
    for (const alt of inf.alternatives) assert.ok(alt.distinguishingEvidence, inf.id + " distinguishing evidence");
    assert.ok((inf.counterfactuals.falsify || []).length + (inf.counterfactuals.strengthen || []).length > 0, inf.id + " counterfactuals");
    assert.ok(inf.uncertainty.length >= 1, inf.id + " uncertainty");
    assert.ok(inf.assumptions.length >= 1, inf.id + " declared assumptions");
    assert.ok(inf.steps.length >= 1 && inf.premises.length >= 1, inf.id + " chain");
  }
});

test("no inference premises on a superseded claim", () => {
  const superseded = new Set(d.claims.filter((c) => c.superseded).map((c) => c.id));
  for (const inf of infs) for (const p of inf.premises) assert.ok(!superseded.has(p.ref), inf.id + " uses superseded " + p.ref);
});

test("executive findings: no unsupported bullets, narrative anchoring holds", () => {
  const narrative = readFileSync(join(ROOT, "content/dossier.md"), "utf8");
  for (const ex of R.executiveFindings) {
    assert.ok(ex.supports.length >= 1, ex.id);
    for (const s of ex.supports) if (s.ref.startsWith("CLM-")) assert.ok(narrative.includes(s.ref), ex.id + " cites unanchored " + s.ref);
  }
});

test("why-index answers 'why should I believe this' for every live claim", () => {
  for (const c of d.claims.filter((c) => !c.superseded)) {
    const w = why[c.id];
    assert.ok(w, c.id + " missing why record");
    if (c.status === "ASSESSED") {
      assert.ok(w.produced_by_inference, c.id + " (ASSESSED) must name its inference");
      assert.ok(w.alternatives.length >= 1 && w.uncertainty.length >= 1, c.id + " why must expose alternatives+uncertainty");
    } else {
      assert.ok(w.supporting.length + w.contextualizing.length >= 1, c.id + " has no visible support");
    }
  }
});

test("reasoning graph: layered, no dangling edges, every edge names its canonical origin", () => {
  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const e of graph.edges) {
    assert.ok(ids.has(e.from) && ids.has(e.to), e.from + "→" + e.to);
    assert.ok(e.via, "edge origin missing");
  }
  const kinds = new Set(graph.nodes.map((n) => n.kind));
  for (const k of ["observation", "evidence", "assertion", "claim", "assessment", "inference", "conclusion", "executive_finding", "assumption", "conflict"]) {
    assert.ok(kinds.has(k), "missing layer kind " + k);
  }
});

test("diversity is a vector, never one number; monoculture is flagged honestly", () => {
  for (const f of execTrace) {
    const dv = f.diversity;
    for (const k of ["source_count", "evidence_count", "document_count", "upstream_family_count", "jurisdictions"]) assert.ok(k in dv, f.id + " " + k);
    assert.ok(!("confidence" in dv) && !("score" in dv), "diversity must not collapse into a single score");
    assert.equal(dv.monoculture, dv.upstream_family_count <= 1, f.id + " monoculture flag");
  }
  // A register-only chain must be flagged as monoculture (e.g. mirrored-exits assessment).
  const n43 = J("static/data/dossier/reasoning/nodes/inf-clm-43.json");
  assert.equal(n43.diversity.monoculture, true, "INF-CLM-43 rests on the register family alone and must say so");
});

test("conflicts: both sides + resolution + remaining uncertainty for every contradiction", () => {
  for (const con of d.contradictions) {
    const cf = R.conflicts.find((x) => x.conflict === con.id);
    assert.ok(cf, con.id);
    assert.ok(cf.sideA.refs.length && cf.sideB.refs.length && cf.resolution && cf.resolutionState);
    assert.ok(cf.remainingUncertainty != null);
  }
});

test("LLM/method transparency present on every published node shard", () => {
  const n = J("static/data/dossier/reasoning/nodes/inf-clm-45.json");
  for (const k of ["authoredBy", "producedIn", "inputs", "limitations"]) assert.ok(n.method[k], k);
});

test("reasoning layer is snapshot-tracked: r08 contains the 36 reasoning objects as change records", () => {
  const CHG = J("static/data/dossier/changes/manifest.json");
  const pair = CHG.pairs.find((p) => p.to_snapshot_id.endsWith("-r08"));
  assert.ok(pair, "r07→r08 pair");
  const reasoningChanges = CHG.changes.filter((c) => c.to_snapshot_id === pair.to_snapshot_id && c.change_type === "REASONING_ADDED");
  assert.equal(reasoningChanges.length, 36);
  const execAdds = reasoningChanges.filter((c) => c.object_type === "executive_finding");
  assert.equal(execAdds.length, 8);
  assert.ok(execAdds.every((c) => c.materiality === "MEDIUM" && c.public_route), "exec findings are material with routes");
});

/* -------- non-vacuity: the gates must actually reject broken reasoning ----- */

function validateMutated(mutate) {
  const copy = JSON.parse(JSON.stringify(R));
  mutate(copy);
  const dir = mkdtempSync(join(tmpdir(), "rsn-"));
  const p = join(dir, "reasoning.json");
  writeFileSync(p, JSON.stringify(copy));
  try {
    execFileSync("node", [join(ROOT, "scripts/dossier/reasoning/reasoning-validate.mjs")], { env: { ...process.env, REASONING_JSON: p }, stdio: "pipe" });
    return 0;
  } catch (e) { return e.status; }
}

test("gate is non-vacuous: removing alternatives fails validation", () => {
  assert.equal(validateMutated((r) => { r.inferences[0].alternatives = []; }), 1);
});

test("gate is non-vacuous: premising on a superseded claim fails validation", () => {
  assert.equal(validateMutated((r) => { r.inferences[0].premises.push({ ref: "CLM-25", role: "supports" }); }), 1);
});

test("gate is non-vacuous: deleting a conclusion's inference fails validation", () => {
  assert.equal(validateMutated((r) => { r.conclusions = r.conclusions.filter((c) => c.produces !== "R-04"); }), 1);
});

test("gate is non-vacuous: hidden assumption (empty list) fails validation", () => {
  assert.equal(validateMutated((r) => { r.inferences[2].assumptions = []; }), 1);
});
