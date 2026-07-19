/*
 * Temporal integrity gate (PROMPT-09 §41–§43).
 *
 * Fails the build (exit 1) on any critical temporal defect:
 *   - snapshot immutability broken (hash of an existing snapshot changed),
 *   - broken previous-snapshot chain or sequence,
 *   - object revision hash not matching its payload,
 *   - canonical drift: committed canonical state ≠ latest snapshot,
 *   - diff not reconciling with both manifests,
 *   - change object without a semantic difference or vice versa,
 *   - material change without a static route (or non-material with one),
 *   - valid_to before valid_from,
 *   - publication leak (local paths / PII patterns in frozen payloads),
 *   - BLOCKED record missing from the revalidation plan.
 * Warns (exit 0) on policy-level staleness so an overdue review never blocks
 * unrelated deploys — the dossier already announces its own staleness.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { extractObjects, snapshotContentHash, contentHash, canonical, sha256 } from "./lib.mjs";
import { diffSnapshots, materialityRank } from "./diff.mjs";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const SNAP_DIR = join(ROOT, "static/data/dossier/snapshots");
const GEN_DIR = join(ROOT, "generated/dossier/snapshots");
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const J = (p) => JSON.parse(readFileSync(p, "utf8"));

/* ---------------------------------------------------- snapshot integrity */

const index = J(join(SNAP_DIR, "index.json"));
const snaps = [];
let prevId = null;
index.snapshots.forEach((s, i) => {
  if (s.snapshot_sequence !== i + 1) err(`sequence gap: ${s.snapshot_id} has seq ${s.snapshot_sequence}, expected ${i + 1}`);
  if ((s.previous_snapshot_id || null) !== prevId) err(`broken previous link at ${s.snapshot_id}: ${s.previous_snapshot_id} != ${prevId}`);
  prevId = s.snapshot_id;

  const dir = join(SNAP_DIR, s.snapshot_id);
  if (!existsSync(join(dir, "manifest.json")) || !existsSync(join(dir, "objects.json"))) {
    err(`snapshot ${s.snapshot_id}: missing manifest/objects`);
    return;
  }
  const manifest = J(join(dir, "manifest.json"));
  const objectsFile = J(join(dir, "objects.json"));
  const objects = objectsFile.objects;

  // per-object revision hashes + duplicate ids + valid interval sanity
  const seen = new Set();
  for (const o of objects) {
    const key = o.object_type + ":" + o.object_id;
    if (seen.has(key)) err(`${s.snapshot_id}: duplicate object ${key}`);
    seen.add(key);
    if (contentHash(o.payload) !== o.content_hash) err(`${s.snapshot_id}: content hash mismatch for ${key}`);
    if (o.revision_id !== o.object_id + "@" + o.content_hash) err(`${s.snapshot_id}: revision id malformed for ${key}`);
    if (o.valid_from && o.valid_to && String(o.valid_to) < String(o.valid_from)) err(`${s.snapshot_id}: valid_to < valid_from for ${key}`);
    // publication safety: frozen payloads must not leak local paths or PII
    const raw = canonical(o.payload);
    if (/\/Users\//.test(raw)) err(`${s.snapshot_id}: local filesystem path leaked in ${key}`);
    if (/\b\d{6}\/\d{3,4}\b/.test(raw)) err(`${s.snapshot_id}: rodné-číslo-like pattern in ${key}`);
  }

  // manifest-level hashes
  const recomputed = snapshotContentHash(objects.map((o) => ({ objectType: o.object_type, objectId: o.object_id, contentHash: o.content_hash })));
  if (recomputed !== manifest.content_hash) err(`${s.snapshot_id}: manifest content_hash ${manifest.content_hash.slice(0, 12)}… != recomputed ${recomputed.slice(0, 12)}…`);
  if (manifest.content_hash !== s.content_hash) err(`${s.snapshot_id}: index content_hash disagrees with manifest`);
  if (sha256(canonical(objects)) !== manifest.object_manifest_hash) err(`${s.snapshot_id}: object_manifest_hash mismatch`);
  if (manifest.snapshot_id !== s.snapshot_id) err(`${s.snapshot_id}: manifest carries different id ${manifest.snapshot_id}`);
  if (manifest.evidence_cutoff !== s.evidence_cutoff) err(`${s.snapshot_id}: cutoff disagrees between index and manifest`);

  // generated/ mirror byte-identity (static/ is the published copy)
  for (const f of ["manifest.json", "objects.json"]) {
    const g = join(GEN_DIR, s.snapshot_id, f);
    if (!existsSync(g)) err(`generated mirror missing: ${s.snapshot_id}/${f}`);
    else if (readFileSync(g, "utf8") !== readFileSync(join(dir, f), "utf8")) err(`generated mirror diverges: ${s.snapshot_id}/${f}`);
  }
  snaps.push({ ...s, manifest, objects });
});

// current pointer + canonical drift gate
const current = J(join(SNAP_DIR, "current.json"));
const last = index.snapshots[index.snapshots.length - 1];
if (current.snapshot_id !== last.snapshot_id || current.content_hash !== last.content_hash) err("current.json does not match the last snapshot in index.json");
const canonicalDoc = J(join(ROOT, "data/dossier/able/dossier.json"));
const reasoningPath = join(ROOT, "data/dossier/able/reasoning.json");
const canonicalReasoning = existsSync(reasoningPath) ? J(reasoningPath) : null;
const liveHash = snapshotContentHash(extractObjects(canonicalDoc, canonicalReasoning));
if (liveHash !== last.content_hash) err(`canonical drift: data/dossier/able/dossier.json (hash ${liveHash.slice(0, 12)}…) does not equal latest snapshot ${last.snapshot_id} (${last.content_hash.slice(0, 12)}…). Run snapshots.mjs + changes-gen.mjs and commit.`);

/* ------------------------------------------------- diff reconciliation */

const CHG = J(join(ROOT, "static/data/dossier/changes/manifest.json"));
if (CHG.current_snapshot_id !== last.snapshot_id) err("changes manifest was generated for a different current snapshot — regenerate");

const ids = new Set();
CHG.changes.forEach((c, i) => {
  if (ids.has(c.id)) err(`duplicate change id ${c.id}`);
  ids.add(c.id);
  const expected = "CHG-" + String(i + 1).padStart(4, "0");
  if (c.id !== expected) err(`non-deterministic change numbering: position ${i} has ${c.id}, expected ${expected}`);
});

for (const p of CHG.pairs) {
  const from = snaps.find((s) => s.snapshot_id === p.from_snapshot_id);
  const to = snaps.find((s) => s.snapshot_id === p.to_snapshot_id);
  if (!from || !to) { err(`pair references missing snapshot ${p.from_snapshot_id}..${p.to_snapshot_id}`); continue; }
  const d = diffSnapshots(from.objects, to.objects);
  const r = p.reconciliation;
  if (d.added.length !== r.objects_added || d.removed.length !== r.objects_removed || d.changed.length !== r.objects_changed || d.unchangedCount !== r.objects_unchanged)
    err(`pair ${p.from_snapshot_id}→${p.to_snapshot_id}: reconciliation drift (recomputed +${d.added.length}/−${d.removed.length}/~${d.changed.length}/=${d.unchangedCount})`);
  if (r.objects_unchanged + r.objects_changed + r.objects_added !== to.objects.length)
    err(`pair →${p.to_snapshot_id}: unchanged+changed+added != to-snapshot object count`);
  if (r.objects_unchanged + r.objects_changed + r.objects_removed !== from.objects.length)
    err(`pair ${p.from_snapshot_id}→: unchanged+changed+removed != from-snapshot object count`);

  // 1:1 between semantic differences and change objects
  const semantic = new Set([
    ...d.added.map((o) => "added:" + o.object_type + ":" + o.object_id),
    ...d.removed.map((o) => "removed:" + o.object_type + ":" + o.object_id),
    ...d.changed.map((c2) => "changed:" + c2.new.object_type + ":" + c2.new.object_id),
  ]);
  const recorded = new Set(CHG.changes.filter((c) => c.from_snapshot_id === p.from_snapshot_id && c.to_snapshot_id === p.to_snapshot_id)
    .map((c) => c.change_kind + ":" + c.object_type + ":" + c.object_id));
  for (const k of semantic) if (!recorded.has(k)) err(`pair →${p.to_snapshot_id}: semantic difference without change record: ${k}`);
  for (const k of recorded) if (!semantic.has(k)) err(`pair →${p.to_snapshot_id}: change record without semantic difference: ${k}`);
}

// revision references + routes + shards
const CONTENT = join(ROOT, "content/dossier/changes");
const contentPages = new Set(readdirSync(CONTENT).filter((f) => /^chg-\d+\.md$/.test(f)));
for (const c of CHG.changes) {
  const from = snaps.find((s) => s.snapshot_id === c.from_snapshot_id);
  const to = snaps.find((s) => s.snapshot_id === c.to_snapshot_id);
  if (c.old_revision_id) {
    const o = from.objects.find((x) => x.object_type === c.object_type && x.object_id === c.object_id);
    if (!o || o.revision_id !== c.old_revision_id) err(`${c.id}: old_revision_id not found in ${c.from_snapshot_id}`);
  }
  if (c.new_revision_id) {
    const o = to.objects.find((x) => x.object_type === c.object_type && x.object_id === c.object_id);
    if (!o || o.revision_id !== c.new_revision_id) err(`${c.id}: new_revision_id not found in ${c.to_snapshot_id}`);
  }
  if (c.change_type === "GAP_RESOLVED" && c.object_type === "open_question" && c.resolved_by) {
    if (!to.objects.find((x) => x.object_type === "resolved_question" && x.object_id === c.resolved_by))
      err(`${c.id}: resolved_by ${c.resolved_by} missing in target snapshot`);
  }
  if (c.effective_at && c.effective_time_precision === "UNKNOWN") err(`${c.id}: effective_at set with UNKNOWN precision`);
  const material = materialityRank(c.materiality) <= materialityRank("MEDIUM");
  const shard = existsSync(join(ROOT, "static/data/dossier/changes", c.id.toLowerCase() + ".json"));
  const page = contentPages.has(c.id.toLowerCase() + ".md");
  if (material && (!shard || !page)) err(`${c.id}: material change missing ${shard ? "content page" : "JSON shard"}`);
  if (!material && (shard || page)) err(`${c.id}: non-material change has a static route`);
  if (material && !c.public_route) err(`${c.id}: material change without public_route`);
}

// snapshot pages exist
const snapPages = readdirSync(join(ROOT, "content/dossier/snapshots"));
for (const s of index.snapshots) if (!snapPages.includes(s.snapshot_id + ".md")) err(`missing snapshot page for ${s.snapshot_id}`);

/* --------------------------------------------------- staleness (§43) */

const fresh = J(join(ROOT, "static/data/dossier/revalidation/freshness.json"));
const plan = J(join(ROOT, "static/data/dossier/revalidation/plan.json"));
const planIds = new Set(plan.tasks.map((t) => t.object_id));
for (const i of fresh.items) {
  if (i.current_state === "BLOCKED" && !planIds.has(i.object_id)) err(`BLOCKED record ${i.object_id} missing from revalidation plan`);
  if (["DUE", "STALE"].includes(i.current_state) && i.materiality === "HIGH") warn(`HIGH-materiality record overdue: ${i.object_id} (due ${i.next_due_at})`);
}
for (const t of plan.tasks) {
  if (!t.recommended_provider) err(`task ${t.task_id} has no provider`);
  if (!t.stop_condition) err(`task ${t.task_id} has no stop condition`);
}
if (fresh._export.asOf !== fresh._export.evidenceCutoff) warn(`freshness evaluated as of ${fresh._export.asOf} (explicit --as-of), not the evidence cutoff`);

/* -------------------------------------------------------------- report */

for (const w of warnings) console.warn("WARN  " + w);
if (errors.length) {
  for (const e of errors) console.error("ERROR " + e);
  console.error(`Temporal validation FAILED: ${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}
console.log(`Temporal validation OK: ${snaps.length} snapshots, ${CHG.total_changes} changes reconciled, ${fresh.items.length} freshness records, ${plan.taskCount} revalidation tasks (${warnings.length} warning(s)).`);
