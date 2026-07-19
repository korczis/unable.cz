/*
 * Temporal engine tests (PROMPT-09 §44).
 *
 * Two layers:
 *  - pure-function fixtures over lib.mjs/diff.mjs (the §44 scenario table),
 *  - non-vacuous invariants over the REAL generated snapshot/change data
 *    (immutability, reconciliation, honest time semantics).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { extractObjects, snapshotContentHash, parseValidTime, contentHash } from "./dossier/temporal/lib.mjs";
import { diffFields, diffSnapshots, classify, categorize, epistemicOfStatusChange, materialityRank } from "./dossier/temporal/diff.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const J = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

/* ------------------------------------------------ valid-time precision */

test("valid time: never fabricates day precision", () => {
  assert.deepEqual(parseValidTime("2025-07-29").precision, "EXACT_DATE");
  assert.deepEqual(parseValidTime("2025-07").precision, "MONTH");
  assert.deepEqual(parseValidTime("2025").precision, "YEAR");
  assert.deepEqual(parseValidTime("3 October 2012"), { value: "2012-10-03", precision: "EXACT_DATE", raw: "3 October 2012" });
  const vague = parseValidTime("2025 (Forbes coverage, exact dates not re-verified)");
  assert.equal(vague.precision, "YEAR");
  assert.equal(vague.value, "2025");
  assert.equal(parseValidTime("sometime recently").precision, "UNKNOWN");
  assert.equal(parseValidTime(null).precision, "UNKNOWN");
});

/* --------------------------------------------------- semantic hashing */

test("semantic no-op: same document → identical snapshot hash; reordered sources are not a change", () => {
  const doc = { meta: { subject: "X", ico: "1", evidenceCutoff: "2026-07-18" }, claims: [{ id: "CLM-01", text: "t", status: "SELF_REPORTED", sources: ["SRC-02", "SRC-01"] }] };
  const doc2 = JSON.parse(JSON.stringify(doc));
  doc2.claims[0].sources = ["SRC-01", "SRC-02"]; // reordered only
  assert.equal(snapshotContentHash(extractObjects(doc)), snapshotContentHash(extractObjects(doc2)));
  const d = diffSnapshots(
    extractObjects(doc).map(asFrozen), extractObjects(doc2).map(asFrozen));
  assert.equal(d.added.length + d.removed.length + d.changed.length, 0);
});

function asFrozen(o) {
  return { object_type: o.objectType, object_id: o.objectId, revision_id: o.objectId + "@" + o.contentHash, content_hash: o.contentHash, payload: o.payload };
}

test("field diff: reordered collection is reorder-only, value changes survive", () => {
  assert.deepEqual(diffFields({ sources: ["A", "B"] }, { sources: ["B", "A"] }), []);
  const fc = diffFields({ status: "SELF_REPORTED", sources: ["A"] }, { status: "CORROBORATED", sources: ["A", "B"] });
  assert.equal(fc.find((f) => f.field === "status").current, "CORROBORATED");
  assert.deepEqual(fc.find((f) => f.field === "sources").added, ["B"]);
});

/* ------------------------------------------------- §44 fixture table */

test("fixture 1: new shareholder → OWNERSHIP_CHANGED, HIGH", () => {
  const c = classify("shareholding", "added", null, { name: "ZenX Capital, a.s.", vklad: "45.8 %" });
  assert.equal(c.changeType, "OWNERSHIP_CHANGED");
  assert.equal(c.materiality, "HIGH");
});

test("fixture 2: historical fact discovered late is a KNOWLEDGE_CHANGE, not a fresh event", () => {
  assert.equal(categorize({ changeType: "RELATIONSHIP_ADDED", effectiveAt: "2020-10-14", fromCutoff: "2026-07-17", toCutoff: "2026-07-18" }), "KNOWLEDGE_CHANGE");
  assert.equal(categorize({ changeType: "RELATIONSHIP_ADDED", effectiveAt: "2026-07-18", fromCutoff: "2026-07-17", toCutoff: "2026-07-18" }), "WORLD_CHANGE");
});

test("fixture 3: corrected ownership percentage → OWNERSHIP_CHANGED via vklad field", () => {
  const fc = diffFields({ vklad: "48.2 %" }, { vklad: "45.80 %" });
  const c = classify("shareholding", "changed", { vklad: "48.2 %" }, { vklad: "45.80 %" }, fc);
  assert.equal(c.changeType, "OWNERSHIP_CHANGED");
  assert.equal(categorize({ changeType: c.changeType, effectiveAt: null, fromCutoff: "a", toCutoff: "b" }), "KNOWLEDGE_CHANGE");
});

test("fixture 4: new tier-1 primary source strengthens without inventing a world change", () => {
  const c = classify("source", "added", null, { tier: 1, title: "ARES VR" });
  assert.equal(c.changeType, "SOURCE_ADDED");
  assert.equal(c.epistemicImpact, "STRENGTHENED");
  assert.equal(categorize({ changeType: "SOURCE_ADDED", effectiveAt: null, fromCutoff: "a", toCutoff: "b" }), "KNOWLEDGE_CHANGE");
});

test("fixtures 6+7: availability change is not evidence invalidation; recovery strengthens", () => {
  const fc = diffFields({ availability: "AVAILABLE" }, { availability: "BLOCKED" });
  const c = classify("source", "changed", { availability: "AVAILABLE" }, { availability: "BLOCKED" }, fc);
  assert.equal(c.changeType, "SOURCE_AVAILABILITY_CHANGED");
  assert.equal(c.epistemicImpact, "NO_EPISTEMIC_CHANGE"); // preserved artifacts stay valid
  assert.equal(epistemicOfStatusChange("BLOCKED", "VERIFIED_PRIMARY"), "STRENGTHENED");
});

test("fixtures 8+9: claim status ladder", () => {
  assert.equal(epistemicOfStatusChange("SELF_REPORTED", "CORROBORATED"), "STRENGTHENED");
  assert.equal(epistemicOfStatusChange("VERIFIED_PRIMARY", "SELF_REPORTED"), "WEAKENED");
  assert.equal(epistemicOfStatusChange("CORROBORATED", "CONTRADICTED"), "CONTRADICTED");
  assert.equal(epistemicOfStatusChange("CONTRADICTED", "VERIFIED_PRIMARY"), "RESOLVED");
  const fc = diffFields({ status: "SELF_REPORTED" }, { status: "CONTRADICTED" });
  const c = classify("claim", "changed", { status: "SELF_REPORTED" }, { status: "CONTRADICTED" }, fc);
  assert.equal(c.changeType, "STATUS_CHANGED");
  assert.equal(c.epistemicImpact, "CONTRADICTED");
});

test("fixtures 11+12: financial correction vs new period are distinct", () => {
  const fc = diffFields({ display: "36,319 tis." }, { display: "36,320 tis." });
  const corr = classify("financial_fact", "changed", { display: "36,319 tis." }, { display: "36,320 tis." }, fc);
  assert.equal(corr.changeType, "FINANCIAL_VALUE_CORRECTED");
  assert.equal(corr.materiality, "HIGH");
  const added = classify("financial_fact", "added", null, { bucket: "verified", metric: "Revenue FY2025" });
  assert.equal(added.changeType, "FINANCIAL_PERIOD_ADDED");
  assert.equal(added.epistemicImpact, "STRENGTHENED");
});

test("claim supersession → CLAIM_SUPERSEDED / CORRECTED", () => {
  const oldP = { superseded: false, supersededBy: [] };
  const newP = { superseded: true, supersededBy: ["CLM-52"] };
  const c = classify("claim", "changed", oldP, newP, diffFields(oldP, newP));
  assert.equal(c.changeType, "CLAIM_SUPERSEDED");
  assert.equal(c.epistemicImpact, "CORRECTED");
});

/* --------------------------------------- real generated data invariants */

const index = J("static/data/dossier/snapshots/index.json");
const CHG = J("static/data/dossier/changes/manifest.json");

test("snapshots: chain, hashes and immutability hold over real data (non-vacuous)", () => {
  assert.ok(index.snapshots.length >= 2, "need at least two snapshots for temporal claims");
  let prev = null;
  for (const s of index.snapshots) {
    const obj = J(`static/data/dossier/snapshots/${s.snapshot_id}/objects.json`);
    const man = J(`static/data/dossier/snapshots/${s.snapshot_id}/manifest.json`);
    assert.equal(man.previous_snapshot_id, prev);
    assert.equal(
      snapshotContentHash(obj.objects.map((o) => ({ objectType: o.object_type, objectId: o.object_id, contentHash: o.content_hash }))),
      man.content_hash
    );
    for (const o of obj.objects.slice(0, 25)) assert.equal(contentHash(o.payload), o.content_hash);
    prev = s.snapshot_id;
  }
});

test("no-op guarantee: current canonical (incl. reasoning layer) equals the latest snapshot exactly", () => {
  const doc = J("data/dossier/able/dossier.json");
  const reasoning = J("data/dossier/able/reasoning.json");
  const last = index.snapshots[index.snapshots.length - 1];
  assert.equal(snapshotContentHash(extractObjects(doc, reasoning)), last.content_hash);
});

test("changes: every adjacent pair reconciles against the frozen objects", () => {
  for (const p of CHG.pairs) {
    const A = J(`static/data/dossier/snapshots/${p.from_snapshot_id}/objects.json`).objects;
    const B = J(`static/data/dossier/snapshots/${p.to_snapshot_id}/objects.json`).objects;
    const d = diffSnapshots(A, B);
    assert.equal(d.added.length, p.reconciliation.objects_added, p.to_snapshot_id);
    assert.equal(d.removed.length, p.reconciliation.objects_removed, p.to_snapshot_id);
    assert.equal(d.changed.length, p.reconciliation.objects_changed, p.to_snapshot_id);
    assert.equal(d.unchangedCount + d.changed.length + d.added.length, B.length);
  }
});

test("fixture 13 (real): the r06→r07 cutoff move is publication metadata, not intelligence", () => {
  const pair = CHG.pairs.find((p) => p.to_snapshot_id === "able-cz-public-2026-07-18-r07");
  assert.ok(pair, "r06→r07 pair must exist");
  assert.equal(pair.material_change_count, 0);
  const metaChanges = CHG.changes.filter((c) => c.to_snapshot_id === pair.to_snapshot_id);
  assert.ok(metaChanges.every((c) => c.materiality === "INFORMATIONAL" || materialityRank(c.materiality) > materialityRank("MEDIUM")));
});

test("gap lifecycle (real): resolved gaps carry resolution links, never silent removal without flag", () => {
  const resolved = CHG.changes.filter((c) => c.change_type === "GAP_RESOLVED");
  assert.ok(resolved.length >= 4, "the known resolved questions must surface");
  for (const c of resolved.filter((x) => x.object_type === "open_question" && x.change_kind === "removed")) {
    assert.ok(c.resolved_by || c.successor_object_id, c.id + " must link its resolution");
  }
  const removals = CHG.changes.filter((c) => c.change_type === "OBJECT_REMOVED_FROM_PUBLICATION");
  for (const c of removals) assert.equal(c.materiality, "MEDIUM", "silent removals must stay review-worthy");
});

test("time axes (real): observation is never used as the effective date", () => {
  for (const c of CHG.changes) {
    if (c.effective_at) {
      assert.notEqual(c.effective_time_precision, "UNKNOWN", c.id);
      // effective dates come from valid-time fields, never from retrievedAt
      assert.ok(c.effective_time_source, c.id + " must name the canonical field its effective date came from");
    }
    assert.ok(c.observed_no_later_than, c.id);
    assert.ok(c.published_at, c.id);
  }
});

test("knowledge-change discipline (real): pre-case effective dates are never WORLD_CHANGE", () => {
  const first = index.snapshots[0].evidence_cutoff;
  for (const c of CHG.changes) {
    if (c.effective_at && c.effective_at < first) assert.equal(c.category, "KNOWLEDGE_CHANGE", c.id);
  }
});

test("revalidation (real): BLOCKED records are queued with provider + stop condition", () => {
  const fresh = J("static/data/dossier/revalidation/freshness.json");
  const plan = J("static/data/dossier/revalidation/plan.json");
  const blocked = fresh.items.filter((i) => i.current_state === "BLOCKED");
  assert.ok(blocked.length >= 1, "the ISIR block must surface as BLOCKED");
  for (const b of blocked) {
    const t = plan.tasks.find((x) => x.object_id === b.object_id);
    assert.ok(t, b.object_id + " must be in the plan");
    assert.ok(t.recommended_provider && t.stop_condition);
  }
  // evidence quality never decays: relationship currentness keeps status intact
  for (const r of fresh.relationshipCurrentness) assert.ok(r.evidence_quality, r.object_id);
});

test("notifications (real): deterministic, deduplicated by change id, latest pair only", () => {
  const n = J("generated/dossier/notifications/latest.json");
  const lastPair = CHG.pairs[CHG.pairs.length - 1];
  assert.equal(n.to_snapshot_id, lastPair.to_snapshot_id);
  const ids = n.candidates.map((c) => c.change_id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of n.candidates) assert.equal(typeof c.should_notify, "boolean");
});

test("publication safety (real): frozen payloads leak no local paths", () => {
  for (const s of index.snapshots) {
    const raw = readFileSync(join(ROOT, `static/data/dossier/snapshots/${s.snapshot_id}/objects.json`), "utf8");
    assert.ok(!raw.includes("/Users/"), s.snapshot_id);
  }
});
