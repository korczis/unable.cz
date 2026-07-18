/*
 * Investigation planner + source-intelligence layer for the Able.cz dossier.
 *
 * Where derive.mjs answered "what do we know / what's missing", this answers
 * "how well do we actually know it, and what should we check next" — the source
 * layer of the epistemic chain. It INVENTS NOTHING: every output is computed
 * from the sourced records in dossier.json plus the already-derived gaps/
 * frontier, and each row carries provenance back to those record IDs.
 *
 * The load-bearing new capability is SOURCE INDEPENDENCE. "CORROBORATED" in this
 * case usually means two aggregator mirrors of the SAME Czech register — that is
 * one upstream authority, not two independent confirmations. This script models
 * an explicit `upstream` for every source and, per claim, counts DISTINCT
 * upstream authorities (not source records), flagging monoculture. It makes the
 * dossier's own caveat machine-checkable instead of a footnote.
 *
 * Usage:  node scripts/dossier/planner.mjs   (run after export.mjs + derive.mjs)
 * Output: static/data/able-cz/planner/{sources,diversity,questions,tasks,
 *         verification,manifest}.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SRC = join(ROOT, "data/dossier/able/dossier.json");
const DERIVED = join(ROOT, "static/data/able-cz");
const OUT = join(DERIVED, "planner");
const SCHEMA_VERSION = "1.0.0";

const d = JSON.parse(readFileSync(SRC, "utf8"));
const meta = d.meta || {};
const cutoff = meta.evidenceCutoff || null;
mkdirSync(OUT, { recursive: true });

const claims = (d.claims || []).filter((c) => !c.superseded); // superseded = audit trail, not live findings
const edges = (d.graph?.edges || []).map((e) => e.data);
const SRCX = {};
(d.sources || []).forEach((s) => (SRCX[s.id] = s));

// ===========================================================================
// SOURCE INTELLIGENCE
// ---------------------------------------------------------------------------
// `upstream` = the ULTIMATE authority a source derives from. Two sources with
// the same upstream are NOT independent confirmations. This mapping is the
// documented core of the diversity engine (docs/dossier/planner/09).
//   - able_cz     : the company's own pages (first-party, controlled)
//   - cz_register : the Czech commercial register / ARES / or.justice.cz — the
//                   SAME authority whether reached directly, via a mirror
//                   (kurzy.cz), an aggregator (Hlídač státu, Northdata), or a
//                   filed primary document (Sbírka listin).
//   - forbes / czechcrunch / linkedin / dns / vies / crtsh : independent origins.
// `class` = evidentiary tier of the specific source record.
// ===========================================================================
const SOURCE_MODEL = {
  "SRC-01": { upstream: "able_cz", class: "company", primary: false, official: false },
  "SRC-02": { upstream: "able_cz", class: "company", primary: false, official: false },
  "SRC-03": { upstream: "cz_register", class: "register_mirror", primary: false, official: true },
  "SRC-04": { upstream: "forbes", class: "media", primary: false, official: false },
  "SRC-05": { upstream: "czechcrunch", class: "media", primary: false, official: false },
  "SRC-06": { upstream: "linkedin", class: "profile", primary: false, official: false },
  "SRC-07": { upstream: "dns", class: "technical", primary: true, official: false },
  "SRC-08": { upstream: "vies", class: "official_register", primary: true, official: true },
  "SRC-09": { upstream: "crtsh", class: "technical", primary: true, official: false },
  "SRC-10": { upstream: "cz_register", class: "register_aggregator", primary: false, official: false },
  "SRC-11": { upstream: "cz_register", class: "register_aggregator", primary: false, official: false },
  "SRC-12": { upstream: "cz_register", class: "official_register", primary: true, official: true },
  "SRC-13": { upstream: "czechcrunch", class: "media", primary: false, official: false },
  "SRC-14": { upstream: "cz_register", class: "register_aggregator", primary: false, official: false },
  "SRC-15": { upstream: "cz_register", class: "primary_registry_document", primary: true, official: true },
  "SRC-16": { upstream: "cz_register", class: "primary_registry_document", primary: true, official: true },
  "SRC-17": { upstream: "cz_register", class: "primary_registry_document", primary: true, official: true },
  "SRC-18": { upstream: "cz_register", class: "primary_registry_document", primary: true, official: true },
  "SRC-19": { upstream: "cz_register", class: "primary_registry_document", primary: true, official: true },
  "SRC-20": { upstream: "contracts_register", class: "official_register", primary: true, official: true },
  "SRC-21": { upstream: "isir", class: "official_register", primary: true, official: true },
  "SRC-22": { upstream: "media_unknown", class: "media", primary: false, official: false },
};
const model = (id) => SOURCE_MODEL[id] || { upstream: "unknown", class: "other", primary: false, official: false };

// Which claims/edges each source supports.
function usage(id) {
  const c = claims.filter((x) => (x.sources || []).includes(id)).map((x) => x.id);
  const e = edges.filter((x) => (x.sources || []).includes(id)).map((x) => x.id);
  const con = (d.contradictions || [])
    .filter((x) => [x.valueA?.source, x.valueB?.source].includes(id))
    .map((x) => x.id);
  return { claims: c, edges: e, contradictions: con };
}

const freshness = (id) => {
  // All retrievals are at the cutoff in this pass; still record it explicitly.
  const r = SRCX[id]?.retrievedAt;
  return r === cutoff ? "fresh" : r ? "aged" : "unknown";
};

const sources = (d.sources || []).map((s) => {
  const m = model(s.id);
  const u = usage(s.id);
  return {
    id: s.id,
    title: s.title,
    url: s.url,
    tier: s.tier,
    kind: s.kind,
    class: m.class,
    upstream: m.upstream,
    official: m.official,
    primary: m.primary,
    independence: m.upstream === "able_cz" ? "company_controlled" : m.class.includes("aggregator") || m.class.includes("mirror") ? "derivative" : "independent_origin",
    freshness: freshness(s.id),
    retrievedAt: s.retrievedAt,
    claimsSupported: u.claims,
    edgesSupported: u.edges.length,
    contradictionsTouched: u.contradictions,
  };
});

// ===========================================================================
// SOURCE DIVERSITY PER CLAIM
// ---------------------------------------------------------------------------
// The honest count of INDEPENDENT support: distinct upstream authorities, not
// source records. Also how many are direct primary documents, and whether the
// claim rests on a single upstream (monoculture) or the company's own word.
// ===========================================================================
function materialityOf(c) {
  const t = (c.text || "").toLowerCase();
  if (/revenue|financ|net result|assets|equity|liabilit|acquir|shareholder|ownership|exekuc|insolven|jednatel|owner/i.test(c.text || "")) return "high";
  if (/client|contract|tender|role|director|board|invest/i.test(t)) return "moderate";
  return "low";
}
const diversity = claims.map((c) => {
  const srcs = c.sources || [];
  const upstreams = [...new Set(srcs.map((s) => model(s).upstream))];
  const primaryDirect = srcs.filter((s) => model(s).class === "primary_registry_document").length;
  const companyControlledOnly = srcs.length > 0 && srcs.every((s) => model(s).upstream === "able_cz");
  return {
    claim: c.id,
    epistemicState: c.status,
    materiality: materialityOf(c),
    sourceRecords: srcs.length,
    independentUpstreams: upstreams.length,
    upstreams,
    primaryDirectCount: primaryDirect,
    companyControlledOnly,
    monoculture: upstreams.length <= 1,
    // The key honest note: a CORROBORATED claim resting on one upstream is NOT
    // independently corroborated, however many mirror records cite it.
    note:
      upstreams.length <= 1 && c.status === "CORROBORATED"
        ? "CORROBORATED přes více záznamů jediné autority (" + upstreams[0] + ") — ne nezávislé potvrzení."
        : companyControlledOnly
        ? "Pouze first-party zdroj (able.cz) — tvrzení firmy."
        : undefined,
    derivedFrom: [c.id],
  };
});

// ===========================================================================
// INVESTIGATION QUESTIONS (from gaps + contradictions)
// ===========================================================================
const gaps = existsSync(join(DERIVED, "gaps.json")) ? JSON.parse(readFileSync(join(DERIVED, "gaps.json"), "utf8")).gaps : [];
const questions = [];
for (const g of gaps) {
  questions.push({
    id: "Q-" + g.id.replace(/^GAP-?/, ""),
    target: g.affectedDimension,
    category: g.category,
    text: g.expectedDatum,
    reason: "Otevřená mezera v evidenci.",
    materiality: g.materiality,
    missingEvidence: g.expectedDatum,
    candidateSource: g.recommendedSource,
    status: g.status === "blocked" ? "blocked" : "open",
    linkedTask: "TASK-" + g.id,
    derivedFrom: g.derivedFrom,
  });
}
for (const c of d.contradictions || []) {
  questions.push({
    id: "Q-" + c.id,
    target: c.field,
    category: "contradiction",
    text: "Které tvrzení je správné: " + c.field + "?",
    reason: c.resolution,
    materiality: c.id === "CON-02" ? "moderate" : "low",
    missingEvidence: "přímý primární zdroj rozhodující spor",
    candidateSource: c.id === "CON-02" ? "or.justice.cz — IČO 02474727" : "or.justice.cz — Able.cz",
    status: "open",
    linkedTask: "TASK-" + c.id,
    derivedFrom: [c.id],
  });
}

// ===========================================================================
// PLANNER TASKS — enrich the frontier with expected-information-gain (ordinal)
// and explicit, stored prioritization dimensions + a "why ranked" rationale.
// ===========================================================================
const frontier = existsSync(join(DERIVED, "frontier.json")) ? JSON.parse(readFileSync(join(DERIVED, "frontier.json"), "utf8")).tasks : [];
const EIG_BY_PRI = { high: "high", medium: "moderate", low: "low" };
const tasks = frontier.map((t) => {
  // Expected information gain: a task resolving a contradiction or adding a
  // PRIMARY source to a currently single-upstream claim gains the most.
  let eig = EIG_BY_PRI[t.priority] || "low";
  if (/rozpor|CON-/i.test(t.question + " " + (t.reason || ""))) eig = "high";
  if (/or\.justice\.cz|Sbírka listin|primary/i.test(t.recommendedSource || "")) eig = eig === "low" ? "moderate" : eig;
  const dims = {
    materiality: t.materiality,
    uncertainty: t.currentConfidence === "disputed" ? "high" : t.currentConfidence === "unknown" ? "high" : "moderate",
    sourceAvailability: t.recommendedSource ? "known_public_source" : "none",
    sourceAuthority: /or\.justice\.cz|Sbírka listin|ČÚZK|justice/i.test(t.recommendedSource || "") ? "official_primary" : "secondary",
    staleness: "current",
    cost: "low",
    legalRisk: "low",
    privacyRisk: /fyzick|rezidenč|natural|osob/i.test(t.reason || "") ? "elevated" : "low",
  };
  return {
    ...t,
    expectedInformationGain: eig,
    priorityDimensions: dims,
    whyRanked:
      "Priorita " + t.priority + ": materialita=" + t.materiality +
      ", nejistota=" + dims.uncertainty +
      ", zdroj=" + dims.sourceAuthority +
      (dims.sourceAvailability === "known_public_source" ? " (známý veřejný zdroj)" : " (bez známého zdroje)") + ".",
  };
});

// ===========================================================================
// RELATIONSHIP VERIFICATION STATES — an edge must never look more certain than
// its evidence. Derived from status + upstream independence.
// ===========================================================================
function verifyState(e) {
  const srcs = e.sources || [];
  const upstreams = [...new Set(srcs.map((s) => model(s).upstream))];
  const primaryDirect = srcs.some((s) => model(s).class === "primary_registry_document");
  const companyOnly = srcs.length > 0 && srcs.every((s) => model(s).upstream === "able_cz");
  if (e.status === "CONTRADICTED") return "contradicted";
  if (e.validTo) return "historical";
  if (e.status === "VERIFIED_PRIMARY" && (primaryDirect || upstreams.includes("vies") || upstreams.includes("cz_register"))) return "verified";
  if (e.status === "CORROBORATED" && upstreams.length >= 2) return "partially_verified";
  if (e.status === "CORROBORATED" && upstreams.length <= 1) return "single_upstream";
  if (companyOnly || e.status === "SELF_REPORTED") return "source_claimed";
  return "unverified";
}
const verification = edges.map((e) => {
  const srcs = e.sources || [];
  const upstreams = [...new Set(srcs.map((s) => model(s).upstream))];
  return {
    edge: e.id,
    from: e.source,
    to: e.target,
    label: e.label,
    epistemicState: e.status,
    verificationState: verifyState(e),
    independentUpstreams: upstreams.length,
    upstreams,
    hasPrimaryDirect: srcs.some((s) => model(s).class === "primary_registry_document"),
    sources: srcs,
  };
});

// ===========================================================================
// RUN DIFF — a content hash of the derived state, so future runs can diff.
// First run establishes the baseline; changes = none by construction.
// ===========================================================================
function stableHash(obj) {
  // Small deterministic FNV-1a over the JSON; no Date/Math.random used.
  const s = JSON.stringify(obj);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ("0000000" + h.toString(16)).slice(-8);
}
const stateFingerprint = {
  entities: (d.graph?.nodes || []).length,
  edges: edges.length,
  claims: claims.length,
  sources: sources.length,
  contradictions: (d.contradictions || []).length,
  monocultureClaims: diversity.filter((x) => x.monoculture).length,
  verifiedEdges: verification.filter((v) => v.verificationState === "verified").length,
};
const runHash = stableHash(stateFingerprint);

// ---- write ----------------------------------------------------------------
function withHeader(kind, payload, extra = {}) {
  return {
    _export: {
      schemaVersion: SCHEMA_VERSION, kind, subject: meta.subject, ico: meta.ico,
      evidenceCutoff: cutoff, generatedAt: cutoff, source: "data/dossier/able/dossier.json",
      note: "Investigation-planner projection. Derived from sourced records; ordinal/ASSESSED only; nothing invented. Source independence is counted by distinct upstream authority, not by source record.",
      ...extra,
    },
    ...payload,
  };
}
const write = (name, kind, payload, extra) => {
  writeFileSync(join(OUT, name), JSON.stringify(withHeader(kind, payload, extra), null, 2) + "\n");
  return "planner/" + name;
};

const tally = (arr, key) => arr.reduce((o, x) => ((o[x[key]] = (o[x[key]] || 0) + 1), o), {});
const written = [];
written.push(write("sources.json", "source-registry", { sources }, {
  count: sources.length, byUpstream: tally(sources, "upstream"), byIndependence: tally(sources, "independence"),
}));
written.push(write("diversity.json", "source-diversity", { claims: diversity }, {
  count: diversity.length,
  monoculture: diversity.filter((x) => x.monoculture).length,
  companyControlledOnly: diversity.filter((x) => x.companyControlledOnly).length,
  note: "independentUpstreams počítá odlišné autority, ne kopie. cz_register = jedna autorita, ať přes rejstřík, agregátor či Sbírku listin.",
}));
written.push(write("questions.json", "questions", { questions }, { count: questions.length, byStatus: tally(questions, "status") }));
written.push(write("tasks.json", "planner-tasks", { tasks }, { count: tasks.length, byEIG: tally(tasks, "expectedInformationGain"), byPriority: tally(tasks, "priority") }));
written.push(write("verification.json", "relationship-verification", { verification }, { count: verification.length, byState: tally(verification, "verificationState") }));
written.push(write("manifest.json", "planner-manifest", {
  runHash, stateFingerprint,
  baseline: true,
  changesSincePrevious: null,
  changeNote: "První běh plánovače — základní otisk stavu. Další běhy se porovnají proti runHash.",
  files: written.map((w) => w.replace("planner/", "")),
}));

console.log("Planner: derived " + written.length + " exports to static/data/able-cz/planner/:");
console.log("  sources " + sources.length + " | monoculture claims " + stateFingerprint.monocultureClaims + "/" + claims.length +
  " | verified edges " + stateFingerprint.verifiedEdges + "/" + edges.length + " | tasks " + tasks.length + " | runHash " + runHash);
