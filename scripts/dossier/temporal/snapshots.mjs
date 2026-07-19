/*
 * Snapshot engine for the Able.cz dossier (PROMPT-09 §5–§7).
 *
 * A snapshot is an IMMUTABLE record of what the public dossier said at one
 * published state: a manifest (counts, hashes, provenance) + the full frozen
 * object revisions (objects.json). Snapshots are never regenerated from the
 * latest data — once written they are only verified, never rewritten.
 *
 *   node scripts/dossier/temporal/snapshots.mjs --bootstrap
 *     One-time: materialize the real, already-deployed publication history of
 *     data/dossier/able/dossier.json from git (docs/dossier/temporal/00 §4).
 *     Refuses to alter an existing snapshot whose content hash differs.
 *
 *   node scripts/dossier/temporal/snapshots.mjs
 *     Build-time: extract the current canonical state; if its semantic hash
 *     equals the latest snapshot's, do nothing (semantic no-op — a rebuild is
 *     NOT a new snapshot). Otherwise append a new snapshot.
 *
 * Output:  static/data/dossier/snapshots/<id>/{manifest,objects}.json
 *          static/data/dossier/snapshots/{index,current}.json
 * Mirror:  generated/dossier/snapshots/** (same bytes; static/ is the
 *          published copy, generated/ the pipeline handoff dir).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  TEMPORAL_SCHEMA_VERSION, CASE_ID, CASE_SLUG, PUBLICATION_PROFILE,
  extractObjects, snapshotContentHash, countByType, stateDistribution, sha256, canonical,
} from "./lib.mjs";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const CANONICAL = "data/dossier/able/dossier.json";
const REASONING = "data/dossier/able/reasoning.json";
const STATIC_OUT = join(ROOT, "static/data/dossier/snapshots");
const GEN_OUT = join(ROOT, "generated/dossier/snapshots");
const GENERATOR_VERSION = "temporal-1.0.0";

/*
 * The real publication history (verified against git in the phase-1 audit).
 * Each commit changed the canonical dossier.json AND was deployed to
 * production by .github/workflows/deploy.yml. generated_at is the real commit
 * time; approval is the on-record push to main. This table is history — it is
 * intentionally hardcoded and never recomputed.
 */
const BOOTSTRAP = [
  { seq: 1, commit: "cc56717", generatedAt: "2026-07-17T18:27:21+02:00", note: "První publikovaný dossier (15 tvrzení, 6 zdrojů)." },
  { seq: 2, commit: "01aadea", generatedAt: "2026-07-17T19:55:05+02:00", note: "Měřená digitální stopa able.cz (DNS/VAT/TLS)." },
  { seq: 3, commit: "8004298", generatedAt: "2026-07-17T21:17:13+02:00", note: "Vlastnická síť + Sbírka listin; nález ZenX Capital ~45,8 %." },
  { seq: 4, commit: "9c99b53", generatedAt: "2026-07-18T07:59:27+02:00", note: "Surová evidenční vrstva (ARES, artefakty, provider runs)." },
  { seq: 5, commit: "57fbf68", generatedAt: "2026-07-18T08:09:53+02:00", note: "Obohacení z primárních zdrojů; 58 tvrzení; vyřešený rozpor." },
  { seq: 6, commit: "f9fc4dc", generatedAt: "2026-07-18T08:43:03+02:00", note: "Obnova SRC-22; opravy z adversariálního auditu." },
  { seq: 7, commit: "05a72d3", generatedAt: "2026-07-18T21:32:38+02:00", note: "Konvergence mezního data evidence na 2026-07-18." },
];

/* Publication interruptions that are part of the honest record. */
const PUBLICATION_EVENTS = [
  { at: "2026-07-17T19:43:43+02:00", commit: "186ea29", event: "WITHDRAWN", note: "Dossier dočasně stažen z publikace (revert)." },
  { at: "2026-07-17T19:51:07+02:00", commit: "db36129", event: "REPUBLISHED", note: "Publikace obnovena; kanonický obsah byte-identický se snapshotem r01." },
];

const snapshotId = (cutoff, seq) => `${CASE_SLUG}-${PUBLICATION_PROFILE}-${cutoff}-r${String(seq).padStart(2, "0")}`;

function readDocAtCommit(commit) {
  const raw = execFileSync("git", ["show", `${commit}:${CANONICAL}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
  return JSON.parse(raw);
}

function readReasoningAtCommit(commit) {
  // The reasoning layer (PROMPT-10) postdates the bootstrapped history —
  // absent file means the snapshot honestly has no reasoning objects.
  try {
    const raw = execFileSync("git", ["show", `${commit}:${REASONING}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
    return JSON.parse(raw);
  } catch { return null; }
}

function writeJson(relPath, value) {
  for (const base of [STATIC_OUT, GEN_OUT]) {
    const p = join(base, relPath);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, JSON.stringify(value, null, 2) + "\n");
  }
}

function readIndex() {
  const p = join(STATIC_OUT, "index.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

/** Hash a committed derived manifest file if it exists (route-layer provenance). */
function hashIfExists(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  return sha256(readFileSync(p, "utf8"));
}

function buildSnapshot({ doc, reasoning, seq, previousId, generatedAt, commit, note, routeLayer }) {
  const objects = extractObjects(doc, reasoning);
  objects.sort((a, b) => (a.objectType + ":" + a.objectId).localeCompare(b.objectType + ":" + b.objectId));
  const cutoff = doc.meta?.evidenceCutoff || null;
  const id = snapshotId(cutoff, seq);
  const contentHash = snapshotContentHash(objects);

  const objectsFile = {
    schema_version: TEMPORAL_SCHEMA_VERSION,
    snapshot_id: id,
    object_count: objects.length,
    objects: objects.map((o) => ({
      object_type: o.objectType,
      object_id: o.objectId,
      revision_id: o.objectId + "@" + o.contentHash,
      content_hash: o.contentHash,
      valid_from: o.validFrom,
      valid_to: o.validTo,
      valid_time_precision: o.validTimePrecision,
      valid_time_source: o.validTimeSource,
      payload: o.payload,
    })),
  };
  const objectManifestHash = sha256(canonical(objectsFile.objects));

  const claims = objects.filter((o) => o.objectType === "claim");
  const counts = {
    by_type: countByType(objects),
    entity_count: (countByType(objects).entity || 0),
    relationship_count: (countByType(objects).relationship || 0),
    claim_live_count: claims.filter((c) => !c.payload.superseded).length,
    claim_superseded_count: claims.filter((c) => c.payload.superseded).length,
    source_count: countByType(objects).source || 0,
    contradiction_open_count: objects.filter((o) => o.objectType === "contradiction" && o.payload.status === "CONTRADICTED").length,
    contradiction_resolved_count: objects.filter((o) => o.objectType === "contradiction" && o.payload.status !== "CONTRADICTED").length,
    gap_open_count: countByType(objects).open_question || 0,
    gap_resolved_count: countByType(objects).resolved_question || 0,
    timeline_event_count: countByType(objects).timeline_event || 0,
    financial_fact_count: countByType(objects).financial_fact || 0,
    transaction_count: countByType(objects).transaction || 0,
  };

  const manifest = {
    schema_version: TEMPORAL_SCHEMA_VERSION,
    snapshot_id: id,
    case_id: CASE_ID,
    case_slug: CASE_SLUG,
    publication_profile: PUBLICATION_PROFILE,
    snapshot_sequence: seq,
    previous_snapshot_id: previousId,
    generated_at: generatedAt,
    evidence_cutoff: cutoff,
    approved_at: generatedAt,
    approval_state: "PUBLISHED",
    canonical_case_revision: commit,
    prismatic_commit: null,
    prismatic_note: "Prismatic má koncepty (fact-row valid-time, content-hash lifecycle), ale žádný dossier-snapshot příkaz; kanonický případ žije v tomto repozitáři. Viz docs/dossier/temporal/00.",
    unable_commit: commit,
    generator_version: GENERATOR_VERSION,
    content_hash: contentHash,
    object_manifest_hash: objectManifestHash,
    route_manifest_hash: routeLayer ? hashIfExists("static/data/dossier/claims/manifest.json") : null,
    finance_manifest_hash: routeLayer ? hashIfExists("static/data/dossier/finance/manifest.json") : null,
    graph_manifest_hash: routeLayer ? sha256(canonical({ nodes: doc.graph?.nodes || [], edges: doc.graph?.edges || [] })) : null,
    search_index_hash: null,
    route_layer_note: routeLayer
      ? "Route-layer hashe odpovídají derivovaným manifestům commitnutým spolu s tímto snapshotem."
      : "Historický snapshot bootstrapovaný z gitu: zachována je objektová vrstva (úplná), derivované route manifesty té doby zachovány nebyly. Poctivé omezení — viz docs/dossier/temporal/03.",
    counts,
    state_distributions: {
      claim_states: stateDistribution(objects.filter((o) => o.objectType === "claim")),
      relationship_states: stateDistribution(objects.filter((o) => o.objectType === "relationship")),
      identity_states: stateDistribution(objects.filter((o) => o.objectType === "identity_field")),
    },
    production_url: "/dossier/snapshots/" + id + "/",
    note: note || null,
  };
  return { id, manifest, objectsFile, contentHash };
}

function persistSnapshot(snap) {
  const dirRel = snap.id;
  const manifestPath = join(STATIC_OUT, dirRel, "manifest.json");
  if (existsSync(manifestPath)) {
    const existing = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (existing.content_hash !== snap.contentHash) {
      throw new Error(`REFUSING to overwrite immutable snapshot ${snap.id}: existing content_hash ${existing.content_hash} != ${snap.contentHash}`);
    }
    return false; // already persisted, identical — immutability respected
  }
  mkdirSync(join(STATIC_OUT, dirRel), { recursive: true });
  mkdirSync(join(GEN_OUT, dirRel), { recursive: true });
  writeJson(join(dirRel, "manifest.json"), snap.manifest);
  writeJson(join(dirRel, "objects.json"), snap.objectsFile);
  return true;
}

function writeIndex(entries) {
  const index = {
    schema_version: TEMPORAL_SCHEMA_VERSION,
    case_id: CASE_ID,
    publication_profile: PUBLICATION_PROFILE,
    snapshot_count: entries.length,
    publication_events: PUBLICATION_EVENTS,
    retention_policy: "Všechny dříve publikované veřejné snapshoty se uchovávají trvale; snapshot se nikdy nemaže ani nepřepisuje (validátor selže na změně hashe).",
    snapshots: entries,
  };
  writeJson("index.json", index);
  const cur = entries[entries.length - 1];
  writeJson("current.json", {
    schema_version: TEMPORAL_SCHEMA_VERSION,
    snapshot_id: cur.snapshot_id,
    snapshot_sequence: cur.snapshot_sequence,
    evidence_cutoff: cur.evidence_cutoff,
    generated_at: cur.generated_at,
    content_hash: cur.content_hash,
    previous_snapshot_id: cur.previous_snapshot_id,
  });
}

const indexEntry = (m) => ({
  snapshot_id: m.snapshot_id,
  snapshot_sequence: m.snapshot_sequence,
  previous_snapshot_id: m.previous_snapshot_id,
  evidence_cutoff: m.evidence_cutoff,
  generated_at: m.generated_at,
  unable_commit: m.unable_commit,
  content_hash: m.content_hash,
  counts: { claims_live: m.counts.claim_live_count, claims_superseded: m.counts.claim_superseded_count, sources: m.counts.source_count, entities: m.counts.entity_count, relationships: m.counts.relationship_count },
  note: m.note,
});

/* ------------------------------------------------------------------ main */

const mode = process.argv.includes("--bootstrap") ? "bootstrap" : "ensure";

if (mode === "bootstrap") {
  const entries = [];
  let prevId = null;
  for (const spec of BOOTSTRAP) {
    const doc = readDocAtCommit(spec.commit);
    const isLast = spec.seq === BOOTSTRAP.length;
    const snap = buildSnapshot({ doc, reasoning: readReasoningAtCommit(spec.commit), seq: spec.seq, previousId: prevId, generatedAt: spec.generatedAt, commit: spec.commit, note: spec.note, routeLayer: isLast });
    const created = persistSnapshot(snap);
    entries.push(indexEntry(snap.manifest));
    console.log((created ? "created " : "kept    ") + snap.id + "  hash=" + snap.contentHash.slice(0, 12) + "  objects=" + snap.objectsFile.object_count);
    prevId = snap.id;
  }
  writeIndex(entries);
  console.log("Snapshot index: " + entries.length + " snapshots, current=" + entries[entries.length - 1].snapshot_id);
} else {
  const index = readIndex();
  if (!index) {
    console.error("No snapshot index. Run with --bootstrap first.");
    process.exit(1);
  }
  const doc = JSON.parse(readFileSync(join(ROOT, CANONICAL), "utf8"));
  const reasoningPath = join(ROOT, REASONING);
  const reasoning = existsSync(reasoningPath) ? JSON.parse(readFileSync(reasoningPath, "utf8")) : null;
  const objects = extractObjects(doc, reasoning);
  const currentHash = snapshotContentHash(objects);
  const last = index.snapshots[index.snapshots.length - 1];
  if (currentHash === last.content_hash) {
    console.log("Semantic no-op: canonical state equals " + last.snapshot_id + " (hash " + currentHash.slice(0, 12) + "). No new snapshot.");
    process.exit(0);
  }
  let commit = null;
  try {
    const dirty = execFileSync("git", ["status", "--porcelain", "--", "data/dossier"], { cwd: ROOT }).toString().trim();
    // Only record HEAD when the canonical inputs are actually committed at it —
    // a dirty tree would attribute the snapshot to a commit that lacks it.
    commit = dirty ? null : execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT }).toString().trim();
  } catch { /* not a git checkout */ }
  const seq = last.snapshot_sequence + 1;
  const snap = buildSnapshot({
    doc, reasoning, seq, previousId: last.snapshot_id,
    // Deterministic: a new semantic state is stamped to its evidence cutoff,
    // never to wall-clock build time (repo convention; docs/dossier/temporal/04).
    generatedAt: doc.meta?.evidenceCutoff || null,
    commit, note: "Nový sémantický stav zjištěný při buildu (data:build).", routeLayer: true,
  });
  persistSnapshot(snap);
  index.snapshots.push(indexEntry(snap.manifest));
  writeIndex(index.snapshots);
  console.log("created " + snap.id + " (previous " + last.snapshot_id + "); re-run changes-gen + validate before committing.");
}
