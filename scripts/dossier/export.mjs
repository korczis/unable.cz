/*
 * Derive the normalized, downloadable web exports under static/data/able-cz/
 * from the single source of truth, data/dossier/able/dossier.json.
 *
 * This script INVENTS NOTHING. Every export is a reshaping of records already
 * present in dossier.json, plus a small header block. The one derived artifact
 * is the risk register (risks.json): each risk is an ASSESSED reading of a gap
 * or discrepancy that dossier.json already documents, and every risk cites the
 * dossier records that ground it. Ordinal scales only — no invented 1..100.
 *
 * Usage:  node scripts/dossier/export.mjs
 * Output: static/data/able-cz/{case,metadata,entities,relationships,claims,
 *         evidence,timeline,financials,risks,sources}.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SRC = join(ROOT, "data/dossier/able/dossier.json");
const OUT = join(ROOT, "static/data/able-cz");

const SCHEMA_VERSION = "1.0.0";

const d = JSON.parse(readFileSync(SRC, "utf8"));
const meta = d.meta || {};
const cutoff = meta.evidenceCutoff || null;

mkdirSync(OUT, { recursive: true });

/** Count claims/edges/etc. by their `status` field. */
function tally(items, key = "status") {
  const out = {};
  for (const it of items || []) {
    const v = it[key] || (it.data && it.data[key]);
    if (v) out[v] = (out[v] || 0) + 1;
  }
  return out;
}

/** Wrap a payload with a provenance header so every file is self-describing. */
function withHeader(kind, payload, extra = {}) {
  return {
    _export: {
      schemaVersion: SCHEMA_VERSION,
      kind,
      subject: meta.subject || null,
      ico: meta.ico || null,
      evidenceCutoff: cutoff,
      generatedAt: cutoff, // stamped to the cutoff to stay deterministic
      source: "data/dossier/able/dossier.json",
      note: "Public-source review. Derived losslessly from the dossier data; nothing added.",
      ...extra,
    },
    ...payload,
  };
}

function write(name, kind, payload, extra) {
  writeFileSync(join(OUT, name), JSON.stringify(withHeader(kind, payload, extra), null, 2) + "\n");
  return name;
}

// --- entities: from graph nodes ------------------------------------------
const entities = (d.graph?.nodes || []).map((n) => ({
  id: n.data.id,
  label: n.data.label,
  type: n.data.group || n.data.type || "unknown",
}));

// --- relationships: from graph edges -------------------------------------
const relationships = (d.graph?.edges || []).map((e) => ({
  id: e.data.id,
  from: e.data.source,
  to: e.data.target,
  label: e.data.label,
  status: e.data.status,
}));

// --- evidence: sources joined to the claims/fields that cite them --------
// Superseded claims are audit-trail records, not live findings: they are
// excluded from live projections and shipped separately.
const liveClaims = (d.claims || []).filter((c) => !c.superseded);
const supersededClaims = (d.claims || []).filter((c) => c.superseded);
const claimsBySource = {};
for (const c of liveClaims) for (const s of c.sources || []) (claimsBySource[s] ||= []).push(c.id);
for (const f of d.identity || []) for (const s of f.sources || []) (claimsBySource[s] ||= []).push("identity:" + f.field);
const evidence = (d.sources || []).map((s) => ({
  id: s.id,
  title: s.title,
  url: s.url,
  tier: s.tier,
  kind: s.kind,
  retrievedAt: s.retrievedAt,
  supports: claimsBySource[s.id] || [],
}));

// --- risks: ASSESSED, each grounded in dossier records -------------------
const selfReported = liveClaims.filter((c) => c.status === "SELF_REPORTED").length;
const totalClaims = liveClaims.length;
const risks = [
  {
    id: "R-01", category: "governance", title: "Marketing titles are not statutory offices",
    probability: "moderate", impact: "low", confidence: "high",
    basis: "governance.marketingLeadership vs governance.statutoryBody; CLM-38",
    note: "Website markets four C-level leaders; the register confirms two as jednatelé. The marketed CTO appears nowhere in the complete preserved register history (primary-verified negative search).",
  },
  {
    id: "R-02", category: "financial", title: "Filed revenue declining and far below the media-reported combined target",
    probability: "high", impact: "moderate", confidence: "high",
    basis: "CLM-44, CLM-45 (filed FY2024 statement, exact rows cited)",
    note: "Replaces the earlier 'statements not retrieved' gap-risk, which was stale: statements were retrieved and parsed. The substantive reading: revenue fell ~14.8% YoY, thin shrinking margin, shareholder loans tripled (FIN-ASSESS-01..04).",
  },
  {
    id: "R-03", category: "reputational", title: "Performance claims are self-reported",
    probability: "moderate", impact: "moderate", confidence: "medium",
    basis: `${selfReported} of ${totalClaims} live claims are SELF_REPORTED`,
    note: "Marketing/performance claims await independent corroboration; the Registr smluv returned zero public contracts to anchor the tender claims (CLM-57).",
  },
  {
    id: "R-04", category: "legal", title: "Insolvency not conclusively screened",
    probability: "unknown", impact: "high", confidence: "low",
    basis: "CLM-58 (ISIR BLOCKED — HTTP 500 on both attempts)",
    note: "No public insolvency was found anywhere, but the authoritative register could not be queried. BLOCKED, not clear; absence is not proof of absence.",
  },
  {
    id: "R-05", category: "governance", title: "Public court-file discrepancy",
    probability: "high", impact: "low", confidence: "high",
    basis: "contradictions[CON-01]",
    note: "Company GDPR page cites C 85424; register records C 85425. Most plausibly a transcription/stale-copy error; recorded, not smoothed over.",
  },
  {
    id: "R-06", category: "ownership", title: "Control concentration outside the founders",
    probability: "high", impact: "moderate", confidence: "high",
    basis: "CLM-52, CLM-53 (primary cap table)",
    note: "ZenX Capital, a.s. has held 45.8–50% since Oct 2020 — more than both founders combined — while its own beneficial ownership is not register-visible. The public narrative reviewed does not reflect this.",
  },
];

// --- write all exports ----------------------------------------------------
const written = [];
written.push(write("entities.json", "entities", { entities }, { count: entities.length }));
written.push(write("relationships.json", "relationships", { relationships }, { count: relationships.length, byStatus: tally(d.graph?.edges) }));
written.push(write("claims.json", "claims", { claims: liveClaims, superseded: supersededClaims }, { count: totalClaims, supersededCount: supersededClaims.length, byStatus: tally(liveClaims) }));
written.push(write("transactions.json", "transactions", { transactions: d.transactions || [] }, { count: (d.transactions || []).length }));
written.push(write("resolved-questions.json", "resolved-questions", { resolvedQuestions: d.resolvedQuestions || [] }, { count: (d.resolvedQuestions || []).length }));
written.push(write("evidence.json", "evidence", { evidence }, { count: evidence.length }));
written.push(write("timeline.json", "timeline", { timeline: d.timeline || [] }, { count: (d.timeline || []).length }));
written.push(write("financials.json", "financials", { financials: d.financials || {} }));
written.push(write("risks.json", "risks", { risks, disclaimer: "Risks are ASSESSED readings of documented evidence gaps, not findings of fact. Severity is independent of evidence confidence." }, { count: risks.length }));
written.push(write("sources.json", "sources", { sources: d.sources || [] }, { count: (d.sources || []).length }));

// case.json + metadata.json: the top-level summaries
const summary = {
  subject: meta.subject,
  ico: meta.ico,
  evidenceCutoff: cutoff,
  confidence: (d.meta && d.meta.confidence) || "moderate",
  counts: {
    entities: entities.length,
    relationships: relationships.length,
    claims: totalClaims,
    sources: (d.sources || []).length,
    contradictions: (d.contradictions || []).length,
    openQuestions: (d.openQuestions || []).length,
    risks: risks.length,
  },
  claimsByStatus: tally(liveClaims),
  relationshipsByStatus: tally(d.graph?.edges),
};
written.push(write("metadata.json", "metadata", summary));
written.push(write("case.json", "case", {
  case: { id: "DD-Able-CZ-2026-07-17", subject: meta.subject, ico: meta.ico, kind: "public-source-due-diligence" },
  identity: d.identity || [],
  contradictions: d.contradictions || [],
  governance: d.governance || {},
  openQuestions: d.openQuestions || [],
  summary,
}));

console.log("Wrote " + written.length + " exports to static/data/able-cz/:");
for (const w of written) console.log("  - " + w);
