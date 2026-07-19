/*
 * Temporal core for the Able.cz dossier (PROMPT-09).
 *
 * Everything here is deterministic and pure: canonical JSON serialization,
 * SHA-256 content hashing, extraction of stable-ID object revisions from a
 * dossier.json document (of ANY historical shape), and valid-time parsing
 * that never invents precision it does not have.
 *
 * Two timestamp axes are kept apart everywhere (docs/dossier/temporal/01):
 *   valid time   — when a fact applied in the represented world,
 *   system time  — when this repository knew/published it (snapshot dates).
 * Retrieval time is NEVER substituted for effective time.
 */
import { createHash } from "node:crypto";

export const TEMPORAL_SCHEMA_VERSION = "1.0.0";
export const CASE_ID = "DD-Able-CZ-2026-07-17";
export const CASE_SLUG = "able-cz";
export const PUBLICATION_PROFILE = "public";

/* ---------------------------------------------------------------- hashing */

/** Canonical JSON: object keys sorted recursively; arrays keep order. */
export function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  }
  return JSON.stringify(value === undefined ? null : value);
}

export function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Content hash of an object revision: sha256 over canonical JSON (16 hex chars kept). */
export function contentHash(payload) {
  return sha256(canonical(payload)).slice(0, 16);
}

/** FNV-1a 32-bit — stable short ids for records that carry no canonical id. */
export function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ("0000000" + h.toString(16)).slice(-8);
}

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ------------------------------------------------------------- valid time */

/**
 * Parse a date-ish string into { value, precision } without inventing
 * precision. Returns precision UNKNOWN (value null) for free text.
 * Precisions: EXACT_DATE | MONTH | YEAR | UNKNOWN.
 */
export function parseValidTime(raw) {
  if (raw == null) return { value: null, precision: "UNKNOWN", raw: raw ?? null };
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { value: s, precision: "EXACT_DATE", raw: s };
  if (/^\d{4}-\d{2}$/.test(s)) return { value: s, precision: "MONTH", raw: s };
  if (/^\d{4}$/.test(s)) return { value: s, precision: "YEAR", raw: s };
  // "3 October 2012" / "14 Nov 2016" style — parse but keep EXACT_DATE only on full match
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const idx = months.indexOf(m[2].slice(0, 3).toLowerCase());
    if (idx >= 0) {
      const iso = `${m[3]}-${String(idx + 1).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
      return { value: iso, precision: "EXACT_DATE", raw: s };
    }
  }
  const y = s.match(/^(\d{4})\b/);
  if (y) return { value: y[1], precision: "YEAR", raw: s };
  return { value: null, precision: "UNKNOWN", raw: s };
}

/* ------------------------------------------------- object-revision extract */

/**
 * Extract every canonical object from a dossier.json document (any historical
 * shape) as a flat list of object revisions:
 *   { objectType, objectId, payload, validFrom, validTo, validTimePrecision,
 *     validTimeSource, contentHash }
 *
 * IDs are stable across snapshots. Records without a canonical id (open
 * questions, timeline events, financial facts) get content-derived ids —
 * documented consequence: editing their text is represented as
 * remove+add, never as a silent in-place mutation.
 */
export function extractObjects(doc, reasoning = null) {
  const out = [];
  const push = (objectType, objectId, payload, valid = {}) => {
    out.push({
      objectType,
      objectId,
      payload,
      validFrom: valid.from ?? null,
      validTo: valid.to ?? null,
      validTimePrecision: valid.precision ?? "UNKNOWN",
      validTimeSource: valid.source ?? null,
      contentHash: contentHash(payload),
    });
  };

  // meta — publication metadata, kept as one object so cutoff moves are
  // visible but classified as publication (not intelligence) changes.
  if (doc.meta) {
    push("case_meta", "META", {
      subject: doc.meta.subject ?? null,
      ico: doc.meta.ico ?? null,
      evidenceCutoff: doc.meta.evidenceCutoff ?? null,
      scope: doc.meta.scope ?? null,
    });
  }

  for (const c of doc.claims || []) {
    push("claim", c.id, {
      text: c.text ?? null,
      status: c.status ?? null,
      sources: [...(c.sources || [])].sort(),
      note: c.note ?? null,
      superseded: !!c.superseded,
      supersededBy: [...(c.supersededBy || [])].sort(),
      supersededReason: c.supersededReason ?? null,
    });
  }

  for (const s of doc.sources || []) {
    push("source", s.id, {
      title: s.title ?? null,
      url: s.url ?? null,
      tier: s.tier ?? null,
      kind: s.kind ?? null,
      retrievedAt: s.retrievedAt ?? null,
      availability: s.availability ?? null,
      note: s.note ?? null,
    });
  }

  for (const f of doc.identity || []) {
    push("identity_field", "ID-" + slugify(f.field), {
      field: f.field ?? null,
      value: f.value ?? null,
      status: f.status ?? null,
      sources: [...(f.sources || [])].sort(),
      note: f.note ?? null,
    });
  }

  for (const c of doc.contradictions || []) {
    push("contradiction", c.id || "CON-" + fnv(canonical(c)), {
      field: c.field ?? null,
      valueA: c.valueA ?? null,
      valueB: c.valueB ?? null,
      resolution: c.resolution ?? null,
      status: c.status ?? null,
    });
  }

  for (const q of doc.openQuestions || []) {
    const text = typeof q === "string" ? q : q.text || canonical(q);
    push("open_question", "OQ-" + fnv(text.replace(/\s+/g, " ").trim().toLowerCase()), { text });
  }

  for (const q of doc.resolvedQuestions || []) {
    push("resolved_question", q.id || "RQ-" + fnv(canonical(q)), {
      question: q.question ?? null,
      resolvedAt: q.resolvedAt ?? null,
      resolution: q.resolution ?? null,
      resolvedBy: [...(q.resolvedBy || [])].sort(),
    });
  }

  for (const t of doc.timeline || []) {
    const vt = parseValidTime(t.date);
    push(
      "timeline_event",
      "TLE-" + fnv((t.date || "") + "|" + (t.event || "")),
      { date: t.date ?? null, event: t.event ?? null, status: t.status ?? null, sources: [...(t.sources || [])].sort() },
      { from: vt.value, precision: vt.precision, source: "timeline.date" }
    );
  }

  for (const t of doc.transactions || []) {
    const eff = t.effectiveInRegister && Object.values(t.effectiveInRegister)[0];
    const vt = parseValidTime(eff);
    push(
      "transaction",
      "TXN-" + slugify((t.id || t.label || "").replace(/^transaction:/, "")),
      t,
      { from: vt.value, precision: vt.precision, source: "transactions.effectiveInRegister" }
    );
  }

  // Governance — statutory roles and shareholdings are the highest-materiality
  // records in the dossier; each person/holder is its own object.
  const gov = doc.governance || {};
  for (const m of gov.statutoryBody || []) {
    const since = parseValidTime(m.since);
    const until = parseValidTime(m.until);
    push(
      "statutory_role",
      "ROLE-" + slugify(m.name || "") + "-" + fnv(String(m.role || "")),
      { name: m.name ?? null, role: m.role ?? null, since: m.since ?? null, until: m.until ?? null, status: m.status ?? null, sources: [...(m.sources || [])].sort(), note: m.note ?? null },
      { from: since.value, to: until.value, precision: since.precision, source: "governance.statutoryBody.since/until" }
    );
  }
  for (const s of gov.shareholders || []) {
    const since = parseValidTime(s.since);
    push(
      "shareholding",
      "SHARE-" + slugify(s.name || ""),
      { name: s.name ?? null, vklad: s.vklad ?? null, since: s.since ?? null, status: s.status ?? null, sources: [...(s.sources || [])].sort(), note: s.note ?? null },
      { from: since.value, precision: since.precision, source: "governance.shareholders.since" }
    );
  }
  if (gov.signingRule) push("governance_rule", "GOV-SIGNING", { rule: gov.signingRule });
  for (const m of gov.marketingLeadership || []) {
    push("marketing_role", "MKT-" + slugify(m.name || canonical(m)), m);
  }

  // Financial facts — one object per (bucket, metric).
  const fin = doc.financials || {};
  for (const bucket of ["verified", "assessed", "selfReported", "notFound"]) {
    for (const raw of fin[bucket] || []) {
      // Older canonical revisions carried bare strings in some buckets.
      const f = typeof raw === "string" ? { metric: raw, status: bucket === "notFound" ? "NOT_FOUND" : null } : raw;
      push("financial_fact", "FIN-" + bucket.toUpperCase() + "-" + slugify(f.metric || canonical(f)), {
        bucket,
        metric: f.metric ?? null,
        display: f.display ?? null,
        status: f.status ?? null,
        sources: [...(f.sources || [])].sort(),
        evidence: [...(f.evidence || [])].sort(),
        note: f.note ?? null,
      });
    }
  }

  // Graph — entities and relationships. NOTE (documented defect, audit §6):
  // edge.firstObserved actually carries the real-world effective date, not an
  // observation date. We map it to valid_from and name the source field.
  for (const n of doc.graph?.nodes || []) {
    const d = n.data || {};
    const vt = parseValidTime(d.validFrom);
    push(
      "entity",
      "ENT-" + d.id,
      { id: d.id, label: d.label ?? null, group: d.group ?? null, type: d.type ?? null, cats: [...(d.cats || [])].sort(), ident: d.ident ?? null, summary: d.summary ?? null, claims: [...(d.claims || [])].sort(), sources: [...(d.sources || [])].sort() },
      { from: vt.value, precision: vt.precision, source: "graph.node.validFrom" }
    );
  }
  for (const e of doc.graph?.edges || []) {
    const d = e.data || {};
    const vf = parseValidTime(d.firstObserved);
    const vt = parseValidTime(d.lastObserved);
    push(
      "relationship",
      "REL-" + d.id,
      { id: d.id, source: d.source ?? null, target: d.target ?? null, label: d.label ?? null, status: d.status ?? null, cat: d.cat ?? null, predicate: d.predicate ?? null, why: d.why ?? null, confidence: d.confidence ?? null, firstObserved: d.firstObserved ?? null, lastObserved: d.lastObserved ?? null, sources: [...(d.sources || [])].sort() },
      { from: vf.value, to: vt.value, precision: vf.precision, source: "graph.edge.firstObserved (field name conflates observation with effect — see temporal audit)" }
    );
  }

  // Reasoning layer (PROMPT-10) — authored analytical objects become
  // first-class snapshot members, so a changed inference/conclusion/executive
  // finding is auditable history ("why did reasoning change"), never a silent
  // rewrite. Historical snapshots predate the layer: reasoning=null there.
  if (reasoning) {
    for (const a of reasoning.assumptions || []) {
      push("reasoning_assumption", a.id, { text: a.text ?? null, basis: a.basis ?? null });
    }
    for (const inf of [...(reasoning.inferences || []), ...(reasoning.conclusions || [])]) {
      push("reasoning_inference", inf.id, {
        kind: inf.kind ?? null,
        produces: inf.produces ?? null,
        premises: (inf.premises || []).map((p) => ({ ref: p.ref, role: p.role })).sort((a, b) => (a.ref + a.role).localeCompare(b.ref + b.role)),
        steps: inf.steps || [],
        assumptions: [...(inf.assumptions || [])].sort(),
        primaryExplanation: inf.primaryExplanation ?? null,
        alternatives: inf.alternatives || [],
        counterfactuals: inf.counterfactuals ?? null,
        uncertainty: inf.uncertainty || [],
      });
    }
    for (const ex of reasoning.executiveFindings || []) {
      push("executive_finding", ex.id, {
        text: ex.text ?? null,
        narrativeSection: ex.narrativeSection ?? null,
        supports: (ex.supports || []).map((s) => ({ ref: s.ref, role: s.role })).sort((a, b) => (a.ref + a.role).localeCompare(b.ref + b.role)),
        reasoning: ex.reasoning ?? null,
        uncertainty: ex.uncertainty || [],
      });
    }
    for (const cf of reasoning.conflicts || []) {
      push("conflict_resolution", cf.id, {
        conflict: cf.conflict ?? null,
        sideA: cf.sideA ?? null,
        sideB: cf.sideB ?? null,
        resolution: cf.resolution ?? null,
        resolutionState: cf.resolutionState ?? null,
        distinguishingEvidence: cf.distinguishingEvidence ?? null,
        remainingUncertainty: cf.remainingUncertainty ?? null,
      });
    }
  }

  return out;
}

/** Index an extraction by "type:id". Throws on duplicate stable ids. */
export function indexObjects(objects) {
  const map = new Map();
  for (const o of objects) {
    const key = o.objectType + ":" + o.objectId;
    if (map.has(key)) throw new Error("Duplicate stable id in extraction: " + key);
    map.set(key, o);
  }
  return map;
}

/** Snapshot-level semantic hash: sha256 over sorted "type:id@hash" lines. */
export function snapshotContentHash(objects) {
  const lines = objects.map((o) => o.objectType + ":" + o.objectId + "@" + o.contentHash).sort();
  return sha256(lines.join("\n"));
}

/** Count objects per type. */
export function countByType(objects) {
  const c = {};
  for (const o of objects) c[o.objectType] = (c[o.objectType] || 0) + 1;
  return c;
}

/** Distribution of a payload field (e.g. status) per object type. */
export function stateDistribution(objects, field = "status") {
  const c = {};
  for (const o of objects) {
    const v = o.payload?.[field];
    if (v == null) continue;
    c[v] = (c[v] || 0) + 1;
  }
  return c;
}
