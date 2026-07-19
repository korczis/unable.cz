/*
 * Change-object generator (PROMPT-09 §8, §18, §32, §33).
 *
 * Walks every adjacent snapshot pair in static/data/dossier/snapshots/ and
 * turns each semantic difference into a first-class, stable-ID change object
 * (CHG-0001 …). Deterministic: snapshots are immutable, ordering is by
 * (pair, object key), so re-running never renumbers an existing change.
 *
 * Distinguishes throughout:
 *   effective_at  — when the represented world changed (valid time, if known),
 *   observed_at   — when the underlying evidence was retrieved (if derivable),
 *   published_at  — when the dossier snapshot containing it went out.
 * Nothing is backfilled: unknown stays null with an explicit basis note.
 *
 * Output: static/data/dossier/changes/{manifest.json,chg-*.json}
 *         static/data/dossier/history/objects.json   (revision chains)
 *         generated/dossier/notifications/latest.json
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { TEMPORAL_SCHEMA_VERSION, CASE_ID } from "./lib.mjs";
import { diffSnapshots, classify, categorize, materialityRank } from "./diff.mjs";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const SNAP_DIR = join(ROOT, "static/data/dossier/snapshots");
const OUT = join(ROOT, "static/data/dossier/changes");
const HIST_OUT = join(ROOT, "static/data/dossier/history");
const NOTIF_OUT = join(ROOT, "generated/dossier/notifications");

const index = JSON.parse(readFileSync(join(SNAP_DIR, "index.json"), "utf8"));
const snaps = index.snapshots.map((s) => ({
  ...s,
  manifest: JSON.parse(readFileSync(join(SNAP_DIR, s.snapshot_id, "manifest.json"), "utf8")),
  objects: JSON.parse(readFileSync(join(SNAP_DIR, s.snapshot_id, "objects.json"), "utf8")).objects,
}));

const cutoffOf = (s) => s.manifest.evidence_cutoff;
const short = (t, n = 90) => { const x = String(t || "").replace(/\s+/g, " ").trim(); return x.length > n ? x.slice(0, n - 1) + "…" : x; };

/* ------------------------------------------------------- Czech summaries */

function publicSummary(chg, oldP, newP) {
  const P = newP || oldP || {};
  switch (chg.change_type) {
    case "CLAIM_ADDED": return `Přidáno tvrzení ${chg.object_id} (${P.status}): „${short(P.text)}“`;
    case "CLAIM_SUPERSEDED": return `Tvrzení ${chg.object_id} nahrazeno (${(P.supersededBy || []).join(", ") || "—"}). Důvod: ${short(P.supersededReason, 140) || "viz záznam"}`;
    case "CLAIM_CORRECTED": return `Opraveno znění tvrzení ${chg.object_id}.`;
    case "STATUS_CHANGED": return `${chg.object_id}: stav evidence ${oldP?.status} → ${newP?.status}.`;
    case "EVIDENCE_ADDED": return `${chg.object_id}: doplněny zdroje (${(chg.field_changes.find((f) => f.field === "sources")?.added || []).join(", ")}).`;
    case "SOURCE_ADDED": return `Nový zdroj ${chg.object_id}${P.tier != null ? ` (tier ${P.tier})` : ""}: ${short(P.title)}`;
    case "SOURCE_AVAILABILITY_CHANGED": return `Zdroj ${chg.object_id}: změna dostupnosti/URL.`;
    case "RELATIONSHIP_ADDED": return `Nový vztah (${P.status}): ${short(P.label || P.id)}`;
    case "OWNERSHIP_CHANGED":
      return chg.object_type === "transaction"
        ? `Transakce: ${short(P.label, 140)}`
        : `Vlastnická struktura: ${P.name} — ${P.vklad || "podíl viz záznam"}.`;
    case "ROLE_CHANGED": return `Statutární orgán: ${P.name} — ${short(P.role)}.`;
    case "VALIDITY_ENDED": return `Ukončení platnosti: ${P.name} — ${short(P.role || P.label)}.`;
    case "FINANCIAL_PERIOD_ADDED": return `Finanční údaj (${P.bucket}): ${P.metric} = ${P.display ?? "viz záznam"}.`;
    case "FINANCIAL_VALUE_CORRECTED": return `Opravená finanční hodnota: ${P.metric}.`;
    case "CONTRADICTION_OPENED": return `Nový rozpor ${chg.object_id}: ${short(P.field)}.`;
    case "CONTRADICTION_RESOLVED": return `Rozpor ${chg.object_id} vyřešen: ${short(P.field)}.`;
    case "GAP_OPENED": return `Nová otevřená otázka: ${short(P.text, 140)}`;
    case "GAP_RESOLVED":
      if (chg.object_type === "financial_fact") return `Dříve nedohledaný finanční údaj je nyní doložen: ${short(P.metric, 100)} (nástupce ${chg.successor_object_id || "viz záznam"}).`;
      return `Vyřešená otázka ${chg.object_id}: ${short(P.question || P.text, 140)}`;
    case "PUBLICATION_METADATA_CHANGED": {
      const fc = chg.field_changes.find((f) => f.field === "evidenceCutoff");
      return fc ? `Mezní datum evidence posunuto: ${fc.previous} → ${fc.current}.` : "Změna publikačních metadat případu.";
    }
    case "OBJECT_REMOVED_FROM_PUBLICATION": return `Záznam ${chg.object_id} (${chg.object_type}) již není součástí veřejného snapshotu.`;
    case "OBJECT_CORRECTED":
      if (chg.successor_object_id) return `Záznam ${chg.object_id} (${chg.object_type}) přeformulován; nástupce ${chg.successor_object_id}.`;
      return `Opraven záznam ${chg.object_id} (${chg.object_type}): ${chg.field_changes.map((f) => f.field).join(", ")}.`;
    case "OBJECT_ENRICHED": return `Obohacen záznam ${chg.object_id} (${chg.object_type}): ${chg.field_changes.map((f) => f.field).join(", ")}.`;
    case "OBJECT_ADDED": return `Nový záznam ${chg.object_id} (${chg.object_type}): ${short(P.label || P.event || P.field || P.metric || P.text || "", 120)}`;
    default: return `Změna záznamu ${chg.object_id} (${chg.object_type}).`;
  }
}

/* -------------------------------------------------------- helper lookups */

function sourceRetrievedAt(toObjects, sourceIds) {
  const dates = [];
  for (const sid of sourceIds || []) {
    const s = toObjects.find((o) => o.object_type === "source" && o.object_id === sid);
    if (s?.payload?.retrievedAt) dates.push(s.payload.retrievedAt);
  }
  return dates.length ? dates.sort()[0] : null;
}

function affectedClaims(toObjects, chg, payload) {
  if (chg.object_type === "claim") return [chg.object_id];
  if (chg.object_type === "source")
    return toObjects.filter((o) => o.object_type === "claim" && (o.payload.sources || []).includes(chg.object_id)).map((o) => o.object_id);
  return payload?.claims || [];
}

function routesFor(chg) {
  const r = ["/dossier/changes/"];
  if (chg.object_type === "claim") r.push("/dossier/claims/" + chg.object_id.toLowerCase() + "/");
  if (chg.object_type === "financial_fact") r.push("/dossier/finance/");
  if (["entity", "relationship"].includes(chg.object_type)) r.push("/dossier/#graph");
  return r;
}

/* --------------------------------------------------------------- engine */

const allChanges = [];
const pairSummaries = [];
let counter = 0;
const nextId = () => "CHG-" + String(++counter).padStart(4, "0");

for (let i = 1; i < snaps.length; i++) {
  const from = snaps[i - 1], to = snaps[i];
  const d = diffSnapshots(from.objects, to.objects);
  const fromCutoff = cutoffOf(from), toCutoff = cutoffOf(to);
  const pairChanges = [];

  // Gap-resolution matching: an open question that left publication in the
  // same pair in which a resolution record (RQ-*) arrived is a resolved gap,
  // not a silent removal. Matched by normalized text prefix.
  const norm = (t) => String(t || "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 60);

  // Succession matching for content-derived ids (open questions, timeline
  // events, financial facts keyed by text): a rewording shows up as
  // remove+add of different ids. Pair them by word overlap so a reformulated
  // record is reported as a correction with an explicit successor — never as
  // a silent disappearance plus an unrelated novelty.
  const newResolutions = d.added.filter((o) => o.object_type === "resolved_question");
  const resolvedGapIds = new Set();
  for (const rem of d.removed.filter((o) => o.object_type === "open_question")) {
    const match = newResolutions.find((r) => norm(r.payload.question).startsWith(norm(rem.payload.text).slice(0, 40)) || norm(rem.payload.text).startsWith(norm(r.payload.question).slice(0, 40)));
    if (match) resolvedGapIds.add(rem.object_type + ":" + rem.object_id);
  }

  const words = (o) => new Set(String(o.payload.text || o.payload.event || o.payload.metric || "").toLowerCase().split(/[^a-zá-ž0-9]+/).filter((w) => w.length > 3));
  const jaccard = (A, B) => { if (!A.size || !B.size) return 0; let i = 0; for (const w of A) if (B.has(w)) i++; return i / (A.size + B.size - i); };
  const successorOf = new Map(); // removedKey -> added object
  const predecessorOf = new Map(); // addedKey -> removed object
  for (const rem of d.removed) {
    if (!["open_question", "timeline_event", "financial_fact"].includes(rem.object_type)) continue;
    if (resolvedGapIds.has(rem.object_type + ":" + rem.object_id)) continue;
    const W = words(rem);
    let best = null, bestScore = 0;
    for (const add of d.added.filter((a) => a.object_type === rem.object_type && !predecessorOf.has(a.object_type + ":" + a.object_id))) {
      let s = jaccard(W, words(add));
      // A NOT_FOUND financial record replaced by a verified figure for the
      // same metric is a resolved gap even when the verified title grew
      // period suffixes — any real word overlap counts.
      if (rem.payload.bucket === "notFound" && add.payload.bucket === "verified") {
        let inter = 0; for (const w of W) if (words(add).has(w)) inter++;
        if (inter >= 1) s = Math.max(s, 0.35);
      }
      if (s > bestScore) { bestScore = s; best = add; }
    }
    if (best && bestScore >= 0.35) {
      successorOf.set(rem.object_type + ":" + rem.object_id, best);
      predecessorOf.set(best.object_type + ":" + best.object_id, rem);
    }
  }

  const emit = (kind, oldO, newO, fieldChanges) => {
    const ref = newO || oldO;
    const refKey = ref.object_type + ":" + ref.object_id;
    let cls = classify(ref.object_type, kind, oldO?.payload, newO?.payload, fieldChanges);
    let gapMatch = null;
    let successorId = null, predecessorId = null;
    if (kind === "removed" && resolvedGapIds.has(refKey)) {
      const m = newResolutions.find((r) => norm(r.payload.question).startsWith(norm(oldO.payload.text).slice(0, 40)) || norm(oldO.payload.text).startsWith(norm(r.payload.question).slice(0, 40)));
      gapMatch = m?.object_id || null;
      cls = { changeType: "GAP_RESOLVED", materiality: "MEDIUM", epistemicImpact: "RESOLVED" };
    } else if (kind === "removed" && successorOf.has(refKey)) {
      const succ = successorOf.get(refKey);
      successorId = succ.object_id;
      if (ref.object_type === "financial_fact" && oldO.payload.bucket === "notFound") {
        // A documented absence (NOT_FOUND) replaced by an actual record.
        cls = { changeType: "GAP_RESOLVED", materiality: "MEDIUM", epistemicImpact: "RESOLVED" };
      } else {
        cls = { changeType: "OBJECT_CORRECTED", materiality: "INFORMATIONAL", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
      }
    } else if (kind === "added" && predecessorOf.has(refKey)) {
      predecessorId = predecessorOf.get(refKey).object_id;
      if (cls.changeType === "OBJECT_ADDED" || cls.changeType === "GAP_OPENED") {
        // Rewording of an existing record, not new intelligence.
        cls = { ...cls, materiality: "INFORMATIONAL" };
      }
    }
    const effectiveAt = newO?.valid_from ?? null;
    const chg = {
      id: nextId(),
      schema_version: TEMPORAL_SCHEMA_VERSION,
      case_id: CASE_ID,
      from_snapshot_id: from.snapshot_id,
      to_snapshot_id: to.snapshot_id,
      change_kind: kind,
      change_type: cls.changeType,
      object_type: ref.object_type,
      object_id: ref.object_id,
      old_revision_id: oldO ? oldO.revision_id : null,
      new_revision_id: newO ? newO.revision_id : null,
      field_changes: fieldChanges || [],
      effective_at: effectiveAt,
      effective_time_precision: newO?.valid_time_precision ?? "UNKNOWN",
      effective_time_source: newO?.valid_time_source ?? null,
      observed_at: null,
      observed_at_basis: null,
      observed_no_later_than: toCutoff,
      published_at: to.manifest.generated_at,
      materiality: cls.materiality,
      epistemic_impact: cls.epistemicImpact,
      category: null,
      resolved_by: gapMatch,
      successor_object_id: successorId,
      predecessor_object_id: predecessorId,
      requires_revalidation: ["SOURCE_AVAILABILITY_CHANGED", "CONTRADICTION_OPENED", "OBJECT_REMOVED_FROM_PUBLICATION"].includes(cls.changeType)
        || (newO?.payload?.status === "BLOCKED"),
      public_summary: null,
      technical_summary: `${kind} ${ref.object_type} ${ref.object_id}` + (fieldChanges?.length ? ` fields=[${fieldChanges.map((f) => f.field).join(",")}]` : ""),
      source_ids: [...new Set([...(newO?.payload?.sources || []), ...(fieldChanges?.find((f) => f.field === "sources")?.added || [])])],
      evidence_ids: newO?.payload?.evidence || [],
      affected_claim_ids: [],
      affected_routes: [],
      public_route: null,
    };
    chg.category = categorize({ changeType: cls.changeType, effectiveAt, fromCutoff, toCutoff });
    if (ref.object_type === "source") { chg.observed_at = newO?.payload?.retrievedAt ?? oldO?.payload?.retrievedAt ?? null; chg.observed_at_basis = chg.observed_at ? "source.retrievedAt" : null; }
    else { chg.observed_at = sourceRetrievedAt(to.objects, chg.source_ids); chg.observed_at_basis = chg.observed_at ? "retrievedAt nejstaršího citovaného zdroje (horní odhad — samotné pozorování mohlo být dřívější)" : "nederivovatelné z kanonických dat — poctivé null"; }
    chg.affected_claim_ids = affectedClaims(to.objects, chg, newO?.payload);
    chg.affected_routes = routesFor(chg);
    chg.public_summary = publicSummary(chg, oldO?.payload, newO?.payload);
    if (materialityRank(chg.materiality) <= materialityRank("MEDIUM")) chg.public_route = "/dossier/changes/" + chg.id.toLowerCase() + "/";
    pairChanges.push(chg);
    allChanges.push(chg);
  };

  for (const o of d.added) emit("added", null, o, []);
  for (const o of d.removed) emit("removed", o, null, []);
  for (const c of d.changed) emit("changed", c.old, c.new, c.fieldChanges);

  const byMat = {}; const byType = {};
  for (const c of pairChanges) { byMat[c.materiality] = (byMat[c.materiality] || 0) + 1; byType[c.change_type] = (byType[c.change_type] || 0) + 1; }
  const material = pairChanges.filter((c) => materialityRank(c.materiality) <= materialityRank("MEDIUM"));
  pairSummaries.push({
    from_snapshot_id: from.snapshot_id,
    to_snapshot_id: to.snapshot_id,
    reconciliation: {
      objects_added: d.added.length, objects_removed: d.removed.length,
      objects_changed: d.changed.length, objects_unchanged: d.unchangedCount,
      from_object_count: from.objects.length, to_object_count: to.objects.length,
    },
    change_count: pairChanges.length,
    material_change_count: material.length,
    by_materiality: byMat,
    by_change_type: byType,
    // §33 — three summary levels, deterministic, every item linked to a change id.
    executive: material
      .slice()
      .sort((a, b) => materialityRank(a.materiality) - materialityRank(b.materiality))
      .slice(0, 7)
      .map((c) => ({ change_id: c.id, materiality: c.materiality, text: c.public_summary })),
    analyst: Object.entries(byType).sort().map(([t, n]) => ({ change_type: t, count: n, change_ids: pairChanges.filter((c) => c.change_type === t).map((c) => c.id) })),
    technical: {
      from_hash: from.content_hash, to_hash: to.content_hash,
      note: "Sémantický diff normalizovaných objektových revizí; přeuspořádání polí a seznamů zdrojů se nikdy nepočítá jako změna.",
    },
    change_ids: pairChanges.map((c) => c.id),
  });
}

/* ----------------------------------------------------------- write output */

mkdirSync(OUT, { recursive: true });
mkdirSync(HIST_OUT, { recursive: true });
mkdirSync(NOTIF_OUT, { recursive: true });

// stale shard cleanup (idempotent)
for (const f of readdirSync(OUT)) if (/^chg-\d+\.json$/.test(f)) rmSync(join(OUT, f));

const header = {
  schemaVersion: TEMPORAL_SCHEMA_VERSION,
  kind: "changes-manifest",
  caseId: CASE_ID,
  generatedAt: snaps[snaps.length - 1].manifest.evidence_cutoff,
  source: "static/data/dossier/snapshots/ (immutable manifests)",
  note: "Každá materiální změna je objekt první třídy s vlastní trasou. Sémantické změny — nikdy rozdíly formátování, pořadí polí nebo času buildu.",
};

const manifest = {
  _export: header,
  current_snapshot_id: snaps[snaps.length - 1].snapshot_id,
  previous_snapshot_id: snaps.length > 1 ? snaps[snaps.length - 2].snapshot_id : null,
  total_changes: allChanges.length,
  material_changes: allChanges.filter((c) => c.public_route).length,
  pairs: pairSummaries,
  changes: allChanges,
};
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

for (const c of allChanges.filter((c) => c.public_route)) {
  writeFileSync(join(OUT, c.id.toLowerCase() + ".json"), JSON.stringify(c, null, 2) + "\n");
}

// Object revision histories (§21): stable id → chain of {snapshot, revision}.
const histories = {};
for (const s of snaps) {
  for (const o of s.objects) {
    const k = o.object_type + ":" + o.object_id;
    (histories[k] ||= { object_type: o.object_type, object_id: o.object_id, revisions: [], change_ids: [] });
    const prev = histories[k].revisions[histories[k].revisions.length - 1];
    if (!prev || prev.content_hash !== o.content_hash) {
      histories[k].revisions.push({ snapshot_id: s.snapshot_id, snapshot_sequence: s.snapshot_sequence, revision_id: o.revision_id, content_hash: o.content_hash, revision_number: histories[k].revisions.length + 1 });
    } else {
      prev.last_snapshot_id = s.snapshot_id; prev.last_snapshot_sequence = s.snapshot_sequence;
    }
  }
}
for (const c of allChanges) {
  const k = c.object_type + ":" + c.object_id;
  if (histories[k]) histories[k].change_ids.push(c.id);
  else (histories[k] = { object_type: c.object_type, object_id: c.object_id, revisions: [], change_ids: [c.id], removed: true });
}
writeFileSync(join(HIST_OUT, "objects.json"), JSON.stringify({ _export: { ...header, kind: "object-histories" }, objects: histories }, null, 2) + "\n");

// Notification-ready records (§32) — latest adjacent pair only; consumed by
// external automation, never sent from Zola. Deduplicated by stable change id.
const latestPair = pairSummaries[pairSummaries.length - 1];
const latestChanges = allChanges.filter((c) => c.from_snapshot_id === latestPair.from_snapshot_id && c.to_snapshot_id === latestPair.to_snapshot_id);
writeFileSync(join(NOTIF_OUT, "latest.json"), JSON.stringify({
  _export: { ...header, kind: "notification-candidates" },
  from_snapshot_id: latestPair.from_snapshot_id,
  to_snapshot_id: latestPair.to_snapshot_id,
  candidates: latestChanges.map((c) => ({
    change_id: c.id,
    headline: c.public_summary,
    materiality: c.materiality,
    object: c.object_type + ":" + c.object_id,
    summary: c.technical_summary,
    snapshot: c.to_snapshot_id,
    effective_at: c.effective_at,
    observed_at: c.observed_at,
    public_url: c.public_route || "/dossier/changes/",
    should_notify: materialityRank(c.materiality) <= materialityRank("HIGH"),
    notification_reason: materialityRank(c.materiality) <= materialityRank("HIGH") ? "materiality>=HIGH" : "pod prahem notifikace (HIGH)",
  })),
}, null, 2) + "\n");

console.log(`Changes: ${allChanges.length} change objects across ${pairSummaries.length} snapshot pairs (${manifest.material_changes} material with own routes).`);
for (const p of pairSummaries) console.log(`  ${p.from_snapshot_id} → ${p.to_snapshot_id}: +${p.reconciliation.objects_added} −${p.reconciliation.objects_removed} ~${p.reconciliation.objects_changed} (=${p.reconciliation.objects_unchanged})  material=${p.material_change_count}`);
