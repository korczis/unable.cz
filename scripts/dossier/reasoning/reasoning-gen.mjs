/*
 * Epistemic reasoning engine — generator (PROMPT-10).
 *
 * Derives the full inspectable reasoning graph
 *
 *     observation → evidence/assertion → claim → assessment → conclusion → executive finding
 *
 * from records that already exist (evidence.json, extraction, provider runs,
 * dossier.json) plus the AUTHORED analytical layer in
 * data/dossier/able/reasoning.json (inference steps, assumptions,
 * alternatives, counterfactuals, conflicts, executive findings).
 *
 * It INVENTS NOTHING: the generator only connects existing ids; every edge in
 * the output names the canonical record it came from. Confidence is never
 * summarized into one number — diversity vectors carry source/evidence/
 * provider/document/time/jurisdiction dimensions separately.
 *
 * Output: static/data/dossier/reasoning/{graph,why,manifest,executive}.json
 *         static/data/dossier/reasoning/nodes/<id>.json (assessment+ nodes)
 *         content/dossier/reasoning/{_index.md,<id>.md}
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const d = JSON.parse(readFileSync(join(ROOT, "data/dossier/able/dossier.json"), "utf8"));
const ev = JSON.parse(readFileSync(join(ROOT, "data/dossier/able/evidence.json"), "utf8"));
const R = JSON.parse(readFileSync(join(ROOT, "data/dossier/able/reasoning.json"), "utf8"));
const RUNS_PATH = join(ROOT, "cases/DD-Able-CZ-2026-07-17/provider-runs.ndjson");

const DATA_OUT = join(ROOT, "static/data/dossier/reasoning");
const CONTENT_OUT = join(ROOT, "content/dossier/reasoning");
mkdirSync(join(DATA_OUT, "nodes"), { recursive: true });
mkdirSync(CONTENT_OUT, { recursive: true });

const cutoff = d.meta.evidenceCutoff;

/* Source upstream authority — same model as planner.mjs / claims-gen.mjs. */
const UPSTREAM = {
  "SRC-01": "able_cz", "SRC-02": "able_cz", "SRC-03": "cz_register", "SRC-04": "forbes",
  "SRC-05": "czechcrunch", "SRC-06": "linkedin", "SRC-07": "dns", "SRC-08": "vies",
  "SRC-09": "crtsh", "SRC-10": "cz_register", "SRC-11": "cz_register", "SRC-12": "cz_register",
  "SRC-13": "czechcrunch", "SRC-14": "cz_register", "SRC-15": "cz_register", "SRC-16": "cz_register",
  "SRC-17": "cz_register", "SRC-18": "cz_register", "SRC-19": "cz_register", "SRC-20": "contracts_register",
  "SRC-21": "isir", "SRC-22": "media_unknown",
};
const JURISDICTION = {
  cz_register: "CZ — úřední registr", contracts_register: "CZ — úřední registr", isir: "CZ — úřední registr",
  able_cz: "subjekt sám", forbes: "CZ — média", czechcrunch: "CZ — média", media_unknown: "CZ — média",
  linkedin: "sociální síť", dns: "technická infrastruktura", crtsh: "technická infrastruktura (CT log)", vies: "EU — úřední (VIES)",
};

/* ---------------------------------------------------------------- indexes */

const sourceById = {}; (d.sources || []).forEach((s) => (sourceById[s.id] = s));
const claimById = {}; (d.claims || []).forEach((c) => (claimById[c.id] = c));
const finAssessById = {}; (d.financials.assessed || []).forEach((a) => (finAssessById[a.id] = a));
const conById = {}; (d.contradictions || []).forEach((c) => (conById[c.id] = c));
const rqById = {}; (d.resolvedQuestions || []).forEach((q) => (rqById[q.id] = q));
// Risks are defined in export.mjs output — read the derived export (single source of counts there).
const risks = JSON.parse(readFileSync(join(ROOT, "static/data/able-cz/risks.json"), "utf8")).risks;
const riskById = {}; risks.forEach((r) => (riskById[r.id] = r));

const spanById = {};
for (const s of ev.documentSpans || []) spanById[s.id] = { ...s, kind: "document_span" };
for (const s of ev.webSpans || []) spanById[s.id] = { ...s, kind: "web_span" };
const selectorById = {};
for (const [id, sel] of Object.entries(ev.assertionSelectors || {})) selectorById[id] = { id, ...sel, kind: "register_assertion" };

const asmById = {}; (R.assumptions || []).forEach((a) => (asmById[a.id] = a));
const infs = [...(R.inferences || []), ...(R.conclusions || [])];
const infById = {}; infs.forEach((i) => (infById[i.id] = i));
const infByProduct = {}; infs.forEach((i) => (infByProduct[i.produces] = i));

/* Provider runs per source — the observation layer's grounding. */
const runsBySource = {};
if (existsSync(RUNS_PATH)) {
  for (const line of readFileSync(RUNS_PATH, "utf8").split("\n").filter(Boolean)) {
    try { const r = JSON.parse(line); if (r.sourceId) (runsBySource[r.sourceId] ||= []).push({ runId: r.runId, at: r.finishedAt || r.startedAt, outcome: r.outcome, sha256: r.sha256 || null }); } catch { /* skip */ }
  }
}

function resolveRef(ref) {
  if (claimById[ref]) return { kind: claimById[ref].status === "ASSESSED" ? "assessment" : "claim", label: claimById[ref].text, layer: claimById[ref].status === "ASSESSED" ? 4 : 3 };
  if (finAssessById[ref]) return { kind: "assessment", label: finAssessById[ref].text, layer: 4 };
  if (riskById[ref]) return { kind: "conclusion", label: riskById[ref].title, layer: 5 };
  if (spanById[ref]) return { kind: "evidence", label: spanById[ref].exactText || spanById[ref].quote || ref, layer: 1 };
  if (selectorById[ref]) return { kind: "assertion", label: selectorById[ref].note || selectorById[ref].path || ref, layer: 2 };
  if (sourceById[ref]) return { kind: "source", label: sourceById[ref].title, layer: 0 };
  if (conById[ref]) return { kind: "conflict", label: conById[ref].field, layer: 4 };
  if (asmById[ref]) return { kind: "assumption", label: asmById[ref].text, layer: 4 };
  if (rqById[ref]) return { kind: "resolution", label: rqById[ref].question, layer: 3 };
  return null;
}

/* ------------------------------------------------------------ graph build */

const nodes = new Map(); // id -> node
const edges = []; // {from,to,role,via}
const addNode = (id, kind, label, layer, extra = {}) => {
  if (!nodes.has(id)) nodes.set(id, { id, kind, label: String(label || id).slice(0, 160), layer, ...extra });
  return nodes.get(id);
};
const addEdge = (from, to, role, via) => edges.push({ from, to, role, via });

// sources + observations (retrieval events, grounded in provider runs)
for (const s of d.sources || []) {
  addNode(s.id, "source", s.title, 0, { tier: s.tier ?? null, upstream: UPSTREAM[s.id] || "unknown" });
  const runs = runsBySource[s.id] || [];
  const obsId = "OBS-" + s.id;
  addNode(obsId, "observation", `Stažení a uchování ${s.id} (${s.retrievedAt || "?"})`, 0, {
    sourceId: s.id, retrievedAt: s.retrievedAt || null,
    providerRuns: runs.map((r) => r.runId),
    note: runs.length ? null : "Retrieval předchází evidenční vrstvě; provider run nezaznamenán (první pass).",
  });
  addEdge(s.id, obsId, "observed_via", "sources.retrievedAt/provider-runs.ndjson");
}

// evidence + assertions ← sources
for (const s of Object.values(spanById)) {
  addNode(s.id, "evidence", s.exactText || s.quote || s.id, 1, { evidenceKind: s.kind, sourceId: s.sourceId, file: s.file || s.artifactTag || null });
  if (s.sourceId) { addEdge("OBS-" + s.sourceId, s.id, "preserved_in", "evidence.json spans"); addEdge(s.id, s.sourceId, "from_source", "evidence.json spans"); }
}
for (const a of Object.values(selectorById)) {
  addNode(a.id, "assertion", a.note || a.path || a.id, 2, { sourceId: a.sourceId || "SRC-12" });
  const src = a.sourceId || "SRC-12";
  addEdge("OBS-" + src, a.id, "extracted_from", "extraction/ares-assertions.json");
  addEdge(a.id, src, "from_source", "evidence.json assertionSelectors");
}

// claims ← evidence (claimEvidence) and ← sources
for (const c of d.claims || []) {
  addNode(c.id, c.status === "ASSESSED" ? "assessment" : "claim", c.text, c.status === "ASSESSED" ? 4 : 3, { status: c.status, superseded: !!c.superseded });
  for (const link of ev.claimEvidence?.[c.id] || []) {
    const evidenceId = link.spanId || link.selector || null;
    const role = (link.relation || "SUPPORTS").toLowerCase();
    if (evidenceId) addEdge(evidenceId, c.id, role, "evidence.json claimEvidence");
    else if (link.sourceId) addEdge(link.sourceId, c.id, role, "evidence.json claimEvidence (source-level)");
  }
  for (const s of c.sources || []) addEdge(s, c.id, "cited_by_claim", "dossier.json claims.sources");
}

// financial assessments, risks, contradictions, assumptions
for (const a of d.financials.assessed || []) addNode(a.id, "assessment", a.text, 4, { status: "ASSESSED" });
for (const r of risks) addNode(r.id, "conclusion", r.title, 5, { category: r.category, probability: r.probability, impact: r.impact });
for (const c of d.contradictions || []) addNode(c.id, "conflict", c.field, 4, { status: c.status });
for (const a of R.assumptions || []) addNode(a.id, "assumption", a.text, 4, { basis: a.basis });

// authored inference chains
for (const inf of infs) {
  addNode(inf.id, inf.kind === "conclusion" ? "inference" : "inference", "Úsudek → " + inf.produces, 4, { produces: inf.produces, steps: inf.steps.length });
  for (const p of inf.premises) addEdge(p.ref, inf.id, p.role, "reasoning.json premises");
  addEdge(inf.id, inf.produces, "produces", "reasoning.json");
  for (const asm of inf.assumptions || []) addEdge(asm, inf.id, "assumes", "reasoning.json assumptions");
}

// executive findings
for (const ex of R.executiveFindings || []) {
  addNode(ex.id, "executive_finding", ex.text, 6, { narrativeSection: ex.narrativeSection });
  for (const s of ex.supports) addEdge(s.ref, ex.id, s.role, "reasoning.json executiveFindings");
  if (ex.reasoning) addEdge(ex.reasoning, ex.id, "reasoned_by", "reasoning.json executiveFindings");
}

// conflicts (authored resolution structure)
for (const cf of R.conflicts || []) {
  for (const ref of cf.sideA.refs) addEdge(ref, cf.conflict, "conflict_side_a", "reasoning.json conflicts");
  for (const ref of cf.sideB.refs) addEdge(ref, cf.conflict, "conflict_side_b", "reasoning.json conflicts");
}

/* -------------------------------------------- support closure + diversity */

const inEdges = {}; const outEdges = {};
for (const e of edges) { (inEdges[e.to] ||= []).push(e); (outEdges[e.from] ||= []).push(e); }

const SUPPORT_ROLES = new Set(["supports", "produces", "preserved_in", "extracted_from", "cited_by_claim", "reasoned_by", "observed_via", "contextualizes"]);
function supportClosure(id, acc = new Set(), depth = 0) {
  if (depth > 12) return acc;
  for (const e of inEdges[id] || []) {
    if (!SUPPORT_ROLES.has(e.role)) continue;
    if (acc.has(e.from)) continue;
    acc.add(e.from);
    supportClosure(e.from, acc, depth + 1);
  }
  return acc;
}

function diversityOf(id) {
  const closure = supportClosure(id);
  const sources = [...closure].filter((x) => sourceById[x]);
  const evidence = [...closure].filter((x) => spanById[x] || selectorById[x]);
  const documents = [...new Set([...closure].map((x) => spanById[x]?.file).filter(Boolean))];
  const upstreams = [...new Set(sources.map((s) => UPSTREAM[s] || "unknown"))].sort();
  const jurisdictions = [...new Set(upstreams.map((u) => JURISDICTION[u] || "neurčeno"))].sort();
  const providers = [...new Set(sources.flatMap((s) => (runsBySource[s] || []).length ? ["provider-run:" + s] : []))];
  const times = sources.map((s) => sourceById[s].retrievedAt).filter(Boolean).sort();
  return {
    source_count: sources.length, sources: sources.sort(),
    evidence_count: evidence.length,
    document_count: documents.length, documents: documents.sort(),
    provider_run_backed_sources: providers.length,
    upstream_families: upstreams,
    upstream_family_count: upstreams.length,
    jurisdictions,
    time_span: times.length ? { first_retrieved: times[0], last_retrieved: times[times.length - 1] } : null,
    monoculture: upstreams.length <= 1,
    note: "Šest rozměrů záměrně NEsloučených do jednoho čísla — jednočíselná 'confidence' by zakryla, KDE je opora slabá.",
  };
}

/* ------------------------------------------------------------- why index */

const why = {};
for (const [id, node] of nodes) {
  const sup = (inEdges[id] || []).filter((e) => e.role === "supports" || e.role === "cited_by_claim" || e.role === "preserved_in" || e.role === "extracted_from");
  const ctx = (inEdges[id] || []).filter((e) => e.role === "contextualizes");
  const con = (inEdges[id] || []).filter((e) => e.role === "contradicts" || e.role.startsWith("conflict_side"));
  const producedBy = (inEdges[id] || []).find((e) => e.role === "produces");
  const usedBy = (outEdges[id] || []).filter((e) => ["supports", "contradicts", "contextualizes", "reasoned_by"].map((r) => r).includes(e.role));
  const inf = infByProduct[id] || null;
  why[id] = {
    kind: node.kind,
    supporting: sup.map((e) => ({ ref: e.from, kind: nodes.get(e.from)?.kind, via: e.via })),
    contextualizing: ctx.map((e) => ({ ref: e.from, kind: nodes.get(e.from)?.kind })),
    contradicting: con.map((e) => ({ ref: e.from, kind: nodes.get(e.from)?.kind, side: e.role })),
    produced_by_inference: producedBy ? producedBy.from : null,
    used_by: usedBy.map((e) => ({ ref: e.to, role: e.role, kind: nodes.get(e.to)?.kind })),
    assumptions: inf ? inf.assumptions : [],
    uncertainty: inf ? inf.uncertainty : [],
    alternatives: inf ? inf.alternatives : [],
    counterfactuals: inf ? inf.counterfactuals : null,
    reasoning_route: inf ? "/dossier/reasoning/" + inf.id.toLowerCase() + "/" : null,
  };
}

/* ---------------------------------------------------- node detail shards */

for (const f of readdirSync(CONTENT_OUT)) if (/^(inf|exec)-.*\.md$/.test(f)) rmSync(join(CONTENT_OUT, f));

const detailNodes = [];
for (const inf of infs) {
  const target = claimById[inf.produces] || finAssessById[inf.produces] || riskById[inf.produces];
  const targetText = target?.text || target?.title || inf.produces;
  const detail = {
    schemaVersion: "1.0.0", id: inf.id, kind: inf.kind, produces: inf.produces,
    producesText: targetText,
    canonicalPath: "/dossier/reasoning/" + inf.id.toLowerCase() + "/",
    premises: inf.premises.map((p) => ({ ...p, kind: resolveRef(p.ref)?.kind || "unknown", label: String(resolveRef(p.ref)?.label || p.ref).slice(0, 180) })),
    steps: inf.steps,
    assumptions: (inf.assumptions || []).map((a) => ({ id: a, text: asmById[a]?.text || a })),
    primaryExplanation: inf.primaryExplanation,
    alternatives: inf.alternatives,
    counterfactuals: inf.counterfactuals,
    uncertainty: inf.uncertainty,
    diversity: diversityOf(inf.produces),
    trust: {
      supporting: (inEdges[inf.id] || []).filter((e) => e.role === "supports").map((e) => e.from),
      contradicting: (inEdges[inf.id] || []).filter((e) => e.role === "contradicts").map((e) => e.from),
      contextualizing: (inEdges[inf.id] || []).filter((e) => e.role === "contextualizes").map((e) => e.from),
      alternatives: inf.alternatives.length,
      unknown: inf.uncertainty,
    },
    method: R.meta.method,
    evidenceCutoff: cutoff, generatedAt: cutoff,
  };
  detailNodes.push(detail);
  writeFileSync(join(DATA_OUT, "nodes", inf.id.toLowerCase() + ".json"), JSON.stringify(detail, null, 2) + "\n");
  const title = inf.id + " — proč: " + String(targetText).replace(/\s+/g, " ").slice(0, 40);
  writeFileSync(join(CONTENT_OUT, inf.id.toLowerCase() + ".md"),
    "+++\n" +
    `title = "${title.replace(/"/g, "'")}"\n` +
    `description = "${("Úsudkový řetězec " + inf.id + " (" + inf.kind + ") pro " + inf.produces + ": premisy, kroky, alternativy, kontrafaktuály a nejistoty.").slice(0, 155)}"\n` +
    'template = "dossier/reasoning-node.html"\n' +
    "[extra]\n" +
    `node_id = "${inf.id}"\n` +
    `data_path = "static/data/dossier/reasoning/nodes/${inf.id.toLowerCase()}.json"\n` +
    "+++\n");
}

const execOut = (R.executiveFindings || []).map((ex) => ({
  ...ex,
  supports: ex.supports.map((s) => ({ ...s, kind: resolveRef(s.ref)?.kind || "unknown", label: String(resolveRef(s.ref)?.label || s.ref).slice(0, 160) })),
  diversity: diversityOf(ex.id),
  reasoningRoute: ex.reasoning ? "/dossier/reasoning/" + ex.reasoning.toLowerCase() + "/" : null,
}));
for (const ex of execOut) {
  writeFileSync(join(DATA_OUT, "nodes", ex.id.toLowerCase() + ".json"), JSON.stringify({ schemaVersion: "1.0.0", ...ex, method: R.meta.method, evidenceCutoff: cutoff, generatedAt: cutoff }, null, 2) + "\n");
  writeFileSync(join(CONTENT_OUT, ex.id.toLowerCase() + ".md"),
    "+++\n" +
    `title = "${(ex.id + " — exekutivní zjištění").replace(/"/g, "'")}"\n` +
    `description = "${("Exekutivní zjištění " + ex.id + " s úplnou stopou: " + ex.text).replace(/"/g, "'").slice(0, 155)}"\n` +
    'template = "dossier/reasoning-exec.html"\n' +
    "[extra]\n" +
    `node_id = "${ex.id}"\n` +
    `data_path = "static/data/dossier/reasoning/nodes/${ex.id.toLowerCase()}.json"\n` +
    "+++\n");
}

/* ------------------------------------------------------------- manifests */

const graphOut = {
  _export: { schemaVersion: "1.0.0", kind: "reasoning-graph", caseId: "DD-Able-CZ-2026-07-17", evidenceCutoff: cutoff, generatedAt: cutoff, source: "data/dossier/able/reasoning.json + evidence.json + dossier.json", note: "Vrstvy: 0 zdroje/pozorování · 1 evidence · 2 asercie · 3 tvrzení · 4 assessmenty/úsudky/předpoklady/rozpory · 5 závěry · 6 exekutivní zjištění." },
  layers: ["source/observation", "evidence", "assertion", "claim", "assessment/inference", "conclusion", "executive_finding"],
  node_count: nodes.size, edge_count: edges.length,
  nodes: [...nodes.values()],
  edges,
};
writeFileSync(join(DATA_OUT, "graph.json"), JSON.stringify(graphOut, null, 2) + "\n");
writeFileSync(join(DATA_OUT, "why.json"), JSON.stringify({ _export: { ...graphOut._export, kind: "why-index", note: "Pro každý objekt: co ho podpírá, co mu odporuje, který úsudek ho vytvořil, kdo ho používá, jaké předpoklady a nejistoty nese." }, why }, null, 2) + "\n");
writeFileSync(join(DATA_OUT, "executive.json"), JSON.stringify({ _export: { ...graphOut._export, kind: "executive-trace" }, findings: execOut }, null, 2) + "\n");

const byKind = {}; for (const n of nodes.values()) byKind[n.kind] = (byKind[n.kind] || 0) + 1;
const manifest = {
  _export: graphOut._export,
  method: R.meta.method,
  reasoningVersion: R.meta.reasoningVersion,
  promptVersion: R.meta.promptVersion,
  counts: { ...byKind, inference_records: infs.length, executive_findings: (R.executiveFindings || []).length, conflicts: (R.conflicts || []).length, assumptions: (R.assumptions || []).length },
  assumptions: R.assumptions,
  conflicts: R.conflicts.map((cf) => ({ ...cf, status: conById[cf.conflict]?.status || null })),
  inference_ids: infs.map((i) => i.id),
  executive_ids: (R.executiveFindings || []).map((e) => e.id),
  routes: [...infs.map((i) => "/dossier/reasoning/" + i.id.toLowerCase() + "/"), ...(R.executiveFindings || []).map((e) => "/dossier/reasoning/" + e.id.toLowerCase() + "/")],
};
writeFileSync(join(DATA_OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

writeFileSync(join(CONTENT_OUT, "_index.md"),
  "+++\n" +
  'title = "Proč tomu věřit — úsudková vrstva Able.cz DD"\n' +
  `description = "Explicitní úsudkový graf dossieru Able.cz: ${infs.length} úsudkových řetězců, ${(R.executiveFindings || []).length} exekutivních zjištění s úplnou stopou, alternativní vysvětlení a kontrafaktuály u každého závěru."\n` +
  'sort_by = "slug"\n' +
  'template = "dossier/reasoning-index.html"\n' +
  'page_template = "dossier/reasoning-node.html"\n' +
  "[extra]\n" +
  'manifest_path = "static/data/dossier/reasoning/manifest.json"\n' +
  'executive_path = "static/data/dossier/reasoning/executive.json"\n' +
  'graph_path = "static/data/dossier/reasoning/graph.json"\n' +
  "+++\n");

console.log(`Reasoning: ${nodes.size} nodes / ${edges.length} edges; ${infs.length} inference chains, ${(R.executiveFindings || []).length} executive findings, ${Object.keys(why).length} why-records.`);
console.log("  by kind: " + JSON.stringify(byKind));
