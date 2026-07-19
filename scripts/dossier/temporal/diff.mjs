/*
 * Semantic field-level diff + change classification (PROMPT-09 §8–§11).
 *
 * Pure functions over two snapshot object sets. Arrays of ids were sorted at
 * extraction time, so a reordered source list can never surface as a change.
 * Every rule here is a documented table, not a heuristic buried in code:
 * see docs/dossier/temporal/06 (diff), 07 (epistemic impact), 08 (materiality).
 */
import { canonical } from "./lib.mjs";

export const MATERIALITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"];
export const materialityRank = (m) => MATERIALITY_ORDER.indexOf(m);

/* Epistemic status ladder — higher = stronger public evidence. */
const STATUS_RANK = { SELF_REPORTED: 1, ASSESSED: 1, CORROBORATED: 2, VERIFIED_PRIMARY: 3 };

export function epistemicOfStatusChange(oldS, newS) {
  if (newS === "CONTRADICTED") return "CONTRADICTED";
  if (oldS === "CONTRADICTED") return "RESOLVED";
  const a = STATUS_RANK[oldS], b = STATUS_RANK[newS];
  if (a == null || b == null) {
    // NOT_FOUND / BLOCKED / UNKNOWN endpoints: an upgrade into the ladder is a
    // strengthening (e.g. BLOCKED provider recovered and verified), a drop out
    // of it is a weakening; between unranked states we do not pretend to know.
    if (b != null) return "STRENGTHENED";
    if (a != null) return "WEAKENED";
    return "UNKNOWN";
  }
  return b > a ? "STRENGTHENED" : b < a ? "WEAKENED" : "NO_EPISTEMIC_CHANGE";
}

/* ----------------------------------------------------------- field diff */

/**
 * Field-level semantic diff of two payloads.
 * Collections (arrays) diff as sets; scalars/objects as values.
 * Returns [] when semantically identical.
 */
export function diffFields(oldP, newP) {
  const fields = [...new Set([...Object.keys(oldP || {}), ...Object.keys(newP || {})])].sort();
  const changes = [];
  for (const f of fields) {
    const a = oldP?.[f], b = newP?.[f];
    if (canonical(a ?? null) === canonical(b ?? null)) continue;
    if (Array.isArray(a) && Array.isArray(b)) {
      const A = new Set(a.map((x) => canonical(x))), B = new Set(b.map((x) => canonical(x)));
      const added = b.filter((x) => !A.has(canonical(x)));
      const removed = a.filter((x) => !B.has(canonical(x)));
      if (!added.length && !removed.length) continue; // reorder only — not a change
      changes.push({ field: f, kind: "collection", added, removed });
    } else {
      changes.push({ field: f, kind: "value", previous: a ?? null, current: b ?? null });
    }
  }
  return changes;
}

/* --------------------------------------------------------- classification */

const OWNERSHIP_PREDICATES = new Set(["OWNS", "OWNERSHIP", "SHAREHOLDER_OF", "ACQUIRED", "STATUTORY_REPRESENTATIVE_OF"]);
const changedField = (fc, name) => fc.find((c) => c.field === name);

/**
 * Classify one object-level difference into
 * { changeType, materiality, epistemicImpact }.
 * kind: "added" | "removed" | "changed".
 */
export function classify(objectType, kind, oldP, newP, fieldChanges = []) {
  const P = newP || oldP || {};
  if (kind === "added") {
    switch (objectType) {
      case "claim":
        return { changeType: "CLAIM_ADDED", materiality: "LOW", epistemicImpact: STATUS_RANK[P.status] >= 2 ? "STRENGTHENED" : "NO_EPISTEMIC_CHANGE" };
      case "source":
        return { changeType: "SOURCE_ADDED", materiality: P.tier === 1 ? "MEDIUM" : "LOW", epistemicImpact: P.tier === 1 ? "STRENGTHENED" : "NO_EPISTEMIC_CHANGE" };
      case "relationship": {
        const high = OWNERSHIP_PREDICATES.has(P.predicate) && P.status === "VERIFIED_PRIMARY";
        return { changeType: "RELATIONSHIP_ADDED", materiality: high ? "HIGH" : "LOW", epistemicImpact: P.status === "VERIFIED_PRIMARY" ? "STRENGTHENED" : "NO_EPISTEMIC_CHANGE" };
      }
      case "shareholding": return { changeType: "OWNERSHIP_CHANGED", materiality: "HIGH", epistemicImpact: "STRENGTHENED" };
      case "statutory_role": return { changeType: "ROLE_CHANGED", materiality: "HIGH", epistemicImpact: "STRENGTHENED" };
      case "transaction": return { changeType: "OWNERSHIP_CHANGED", materiality: "HIGH", epistemicImpact: "STRENGTHENED" };
      case "financial_fact":
        return { changeType: "FINANCIAL_PERIOD_ADDED", materiality: "MEDIUM", epistemicImpact: P.bucket === "verified" ? "STRENGTHENED" : "NO_EPISTEMIC_CHANGE" };
      case "contradiction": return { changeType: "CONTRADICTION_OPENED", materiality: "MEDIUM", epistemicImpact: "CONTRADICTED" };
      case "open_question": return { changeType: "GAP_OPENED", materiality: "LOW", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
      case "resolved_question": return { changeType: "GAP_RESOLVED", materiality: "MEDIUM", epistemicImpact: "RESOLVED" };
      case "identity_field":
        return { changeType: "OBJECT_ENRICHED", materiality: "LOW", epistemicImpact: P.status === "VERIFIED_PRIMARY" ? "STRENGTHENED" : "NO_EPISTEMIC_CHANGE" };
      case "entity": case "timeline_event": return { changeType: "OBJECT_ADDED", materiality: "LOW", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
      // Reasoning layer (PROMPT-10): publishing a new executive finding is a
      // material act; supporting reasoning machinery is not intelligence per se.
      case "executive_finding": return { changeType: "REASONING_ADDED", materiality: "MEDIUM", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
      case "reasoning_inference": return { changeType: "REASONING_ADDED", materiality: "LOW", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
      case "reasoning_assumption": case "conflict_resolution": return { changeType: "REASONING_ADDED", materiality: "INFORMATIONAL", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
      case "case_meta": return { changeType: "OBJECT_ADDED", materiality: "INFORMATIONAL", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
      default: return { changeType: "OBJECT_ADDED", materiality: "INFORMATIONAL", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
    }
  }

  if (kind === "removed") {
    // Removal from the public snapshot is always review-worthy; gap closures
    // are matched to a resolution record by the caller (GAP_RESOLVED there).
    return { changeType: "OBJECT_REMOVED_FROM_PUBLICATION", materiality: "MEDIUM", epistemicImpact: "UNKNOWN" };
  }

  // kind === "changed"
  const statusCh = changedField(fieldChanges, "status");
  switch (objectType) {
    case "claim": {
      const sup = changedField(fieldChanges, "superseded");
      if (sup && newP.superseded) return { changeType: "CLAIM_SUPERSEDED", materiality: "MEDIUM", epistemicImpact: "CORRECTED" };
      if (statusCh) return { changeType: "STATUS_CHANGED", materiality: "MEDIUM", epistemicImpact: epistemicOfStatusChange(oldP.status, newP.status) };
      if (changedField(fieldChanges, "text")) return { changeType: "CLAIM_CORRECTED", materiality: "MEDIUM", epistemicImpact: "CORRECTED" };
      const src = changedField(fieldChanges, "sources");
      if (src && src.added?.length && !src.removed?.length) return { changeType: "EVIDENCE_ADDED", materiality: "LOW", epistemicImpact: "STRENGTHENED" };
      return { changeType: "OBJECT_ENRICHED", materiality: "INFORMATIONAL", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
    }
    case "source": {
      if (changedField(fieldChanges, "availability") || changedField(fieldChanges, "url"))
        return { changeType: "SOURCE_AVAILABILITY_CHANGED", materiality: "MEDIUM", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
      return { changeType: "OBJECT_ENRICHED", materiality: "LOW", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
    }
    case "identity_field": {
      if (changedField(fieldChanges, "value")) return { changeType: "OBJECT_CORRECTED", materiality: "MEDIUM", epistemicImpact: "CORRECTED" };
      if (statusCh) return { changeType: "STATUS_CHANGED", materiality: "MEDIUM", epistemicImpact: epistemicOfStatusChange(oldP.status, newP.status) };
      return { changeType: "OBJECT_ENRICHED", materiality: "LOW", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
    }
    case "contradiction": {
      if (statusCh && oldP.status === "CONTRADICTED" && newP.status !== "CONTRADICTED")
        return { changeType: "CONTRADICTION_RESOLVED", materiality: "MEDIUM", epistemicImpact: "RESOLVED" };
      return { changeType: "OBJECT_ENRICHED", materiality: "LOW", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
    }
    case "shareholding":
      if (changedField(fieldChanges, "vklad")) return { changeType: "OWNERSHIP_CHANGED", materiality: "HIGH", epistemicImpact: "CORRECTED" };
      return { changeType: "OBJECT_ENRICHED", materiality: "LOW", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
    case "statutory_role":
      if (changedField(fieldChanges, "until")) return { changeType: "VALIDITY_ENDED", materiality: "HIGH", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
      if (changedField(fieldChanges, "role")) return { changeType: "ROLE_CHANGED", materiality: "HIGH", epistemicImpact: "CORRECTED" };
      return { changeType: "OBJECT_ENRICHED", materiality: "LOW", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
    case "relationship": {
      if (changedField(fieldChanges, "source") || changedField(fieldChanges, "target"))
        return { changeType: "OBJECT_CORRECTED", materiality: "HIGH", epistemicImpact: "CORRECTED" };
      if (statusCh) return { changeType: "STATUS_CHANGED", materiality: "MEDIUM", epistemicImpact: epistemicOfStatusChange(oldP.status, newP.status) };
      return { changeType: "OBJECT_ENRICHED", materiality: "LOW", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
    }
    case "financial_fact":
      if (changedField(fieldChanges, "display")) return { changeType: "FINANCIAL_VALUE_CORRECTED", materiality: "HIGH", epistemicImpact: "CORRECTED" };
      return { changeType: "OBJECT_ENRICHED", materiality: "LOW", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
    case "case_meta":
      return { changeType: "PUBLICATION_METADATA_CHANGED", materiality: "INFORMATIONAL", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
    case "timeline_event": case "transaction":
      return { changeType: "OBJECT_CORRECTED", materiality: "MEDIUM", epistemicImpact: "CORRECTED" };
    case "reasoning_inference": case "executive_finding":
      // "Why did reasoning change?" — a changed chain or finding is a
      // first-class, reviewable event, never a silent rewrite.
      return { changeType: "REASONING_CHANGED", materiality: "MEDIUM", epistemicImpact: "CORRECTED" };
    case "reasoning_assumption": case "conflict_resolution":
      return { changeType: "REASONING_CHANGED", materiality: "LOW", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
    default:
      return { changeType: "OBJECT_ENRICHED", materiality: "LOW", epistemicImpact: "NO_EPISTEMIC_CHANGE" };
  }
}

/**
 * Change category — does the represented world change, or only our knowledge?
 * (docs/dossier/temporal/05 §4; never conflate discovery date with event date.)
 */
export function categorize({ changeType, effectiveAt, fromCutoff, toCutoff }) {
  if (changeType === "PUBLICATION_METADATA_CHANGED" || changeType === "OBJECT_REMOVED_FROM_PUBLICATION") return "PUBLICATION_CHANGE";
  if (["OBJECT_CORRECTED", "CLAIM_CORRECTED", "CLAIM_SUPERSEDED", "FINANCIAL_VALUE_CORRECTED"].includes(changeType)) return "CORRECTION";
  if (effectiveAt && fromCutoff && effectiveAt <= fromCutoff) return "KNOWLEDGE_CHANGE"; // the world had already changed; we found out late
  if (effectiveAt && fromCutoff && toCutoff && effectiveAt > fromCutoff && effectiveAt <= toCutoff) return "WORLD_CHANGE";
  return "KNOWLEDGE_CHANGE";
}

/**
 * Diff two snapshot object lists (objects.json "objects" arrays).
 * Returns { added, removed, changed, unchangedCount } of raw entries.
 */
export function diffSnapshots(oldObjects, newObjects) {
  const key = (o) => o.object_type + ":" + o.object_id;
  const oldMap = new Map(oldObjects.map((o) => [key(o), o]));
  const newMap = new Map(newObjects.map((o) => [key(o), o]));
  const added = [], removed = [], changed = [];
  let unchangedCount = 0;
  for (const [k, n] of newMap) {
    const o = oldMap.get(k);
    if (!o) { added.push(n); continue; }
    if (o.content_hash === n.content_hash) { unchangedCount++; continue; }
    const fieldChanges = diffFields(o.payload, n.payload);
    if (!fieldChanges.length) { unchangedCount++; continue; } // hash differs only via normalization drift — not semantic
    changed.push({ old: o, new: n, fieldChanges });
  }
  for (const [k, o] of oldMap) if (!newMap.has(k)) removed.push(o);
  const byKey = (a, b) => key(a).localeCompare(key(b));
  added.sort(byKey); removed.sort(byKey); changed.sort((a, b) => key(a.new).localeCompare(key(b.new)));
  return { added, removed, changed, unchangedCount };
}
