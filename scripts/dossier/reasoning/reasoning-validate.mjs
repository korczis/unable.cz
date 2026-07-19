/*
 * Epistemic reasoning gate (PROMPT-10 §VALIDATION).
 *
 * Fails the build when any conclusion cannot answer "why should I believe
 * this?" mechanically:
 *   - assessment (ASSESSED claim / FIN-ASSESS / risk) without an inference record,
 *   - inference premising on a nonexistent or superseded record,
 *   - inference without a supporting premise that resolves down to preserved
 *     evidence (broken chain),
 *   - inference without declared assumptions / alternatives / counterfactuals
 *     / uncertainty (hidden assumption, single-explanation output),
 *   - executive finding without claim/evidence support, or whose claims are
 *     not actually cited in the narrative,
 *   - contradiction without a conflict-resolution record (silent picking),
 *   - method/transparency metadata missing,
 *   - dangling edges in the generated graph.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const d = JSON.parse(readFileSync(join(ROOT, "data/dossier/able/dossier.json"), "utf8"));
const ev = JSON.parse(readFileSync(join(ROOT, "data/dossier/able/evidence.json"), "utf8"));
// REASONING_JSON env override exists ONLY so tests can prove these gates are
// non-vacuous (a mutated file must fail); the build always uses the canonical path.
const R = JSON.parse(readFileSync(process.env.REASONING_JSON || join(ROOT, "data/dossier/able/reasoning.json"), "utf8"));
const graph = JSON.parse(readFileSync(join(ROOT, "static/data/dossier/reasoning/graph.json"), "utf8"));
const why = JSON.parse(readFileSync(join(ROOT, "static/data/dossier/reasoning/why.json"), "utf8")).why;
const risks = JSON.parse(readFileSync(join(ROOT, "static/data/able-cz/risks.json"), "utf8")).risks;

const errors = [];
const err = (m) => errors.push(m);

const claimById = {}; d.claims.forEach((c) => (claimById[c.id] = c));
const known = new Set([
  ...d.claims.map((c) => c.id),
  ...d.financials.assessed.map((a) => a.id),
  ...risks.map((r) => r.id),
  ...d.contradictions.map((c) => c.id),
  ...d.resolvedQuestions.map((q) => q.id),
  ...d.sources.map((s) => s.id),
  ...ev.documentSpans.map((s) => s.id),
  ...ev.webSpans.map((s) => s.id),
  ...Object.keys(ev.assertionSelectors),
  ...R.assumptions.map((a) => a.id),
]);

const infs = [...R.inferences, ...R.conclusions];
const infByProduct = {}; infs.forEach((i) => (infByProduct[i.produces] = i));
const EVIDENCE_IDS = new Set([...ev.documentSpans.map((s) => s.id), ...ev.webSpans.map((s) => s.id), ...Object.keys(ev.assertionSelectors)]);

/* -- every assessment/conclusion has a chain -------------------------------- */
for (const c of d.claims.filter((c) => c.status === "ASSESSED" && !c.superseded)) {
  if (!infByProduct[c.id]) err(`assessment ${c.id} has no inference record (assessment without reasoning)`);
}
for (const a of d.financials.assessed) if (!infByProduct[a.id]) err(`financial assessment ${a.id} has no inference record`);
for (const r of risks) if (!infByProduct[r.id]) err(`conclusion ${r.id} has no inference record (conclusion without reasoning)`);

/* -- inference integrity ----------------------------------------------------- */
function resolvesToEvidence(ref, depth = 0, seen = new Set()) {
  if (depth > 6 || seen.has(ref)) return false;
  seen.add(ref);
  if (EVIDENCE_IDS.has(ref)) return true;
  const c = claimById[ref];
  if (c) {
    if ((ev.claimEvidence?.[c.id] || []).length > 0) return true;
    return (c.sources || []).length > 0; // sources are themselves preserved (artifact layer)
  }
  if (ref.startsWith("SRC-")) return true;
  const inf2 = infByProduct[ref];
  if (inf2) return inf2.premises.some((p) => resolvesToEvidence(p.ref, depth + 1, seen));
  if (ref.startsWith("CON-")) return true; // contradictions carry their own sourced sides
  return false;
}

const seenInfIds = new Set();
for (const inf of infs) {
  if (seenInfIds.has(inf.id)) err(`duplicate inference id ${inf.id}`);
  seenInfIds.add(inf.id);
  if (!known.has(inf.produces)) err(`${inf.id}: produces unknown record ${inf.produces}`);
  if (!inf.premises?.length) err(`${inf.id}: no premises (inference without supporting chain)`);
  let hasSupport = false;
  for (const p of inf.premises || []) {
    if (!known.has(p.ref)) err(`${inf.id}: premise ${p.ref} does not resolve to any canonical record`);
    const c = claimById[p.ref];
    if (c?.superseded) err(`${inf.id}: premises on SUPERSEDED claim ${p.ref} — use its successor`);
    if (!["supports", "contradicts", "contextualizes"].includes(p.role)) err(`${inf.id}: premise ${p.ref} has invalid role ${p.role}`);
    if (p.role === "supports") {
      hasSupport = true;
      if (!resolvesToEvidence(p.ref)) err(`${inf.id}: supporting premise ${p.ref} does not resolve down to preserved evidence (broken chain)`);
    }
  }
  if (!hasSupport) err(`${inf.id}: no supporting premise (assessment without evidence)`);
  if (!inf.steps?.length) err(`${inf.id}: no reasoning steps`);
  if (!inf.assumptions?.length) err(`${inf.id}: no declared assumptions (hidden assumption)`);
  for (const a of inf.assumptions || []) if (!R.assumptions.find((x) => x.id === a)) err(`${inf.id}: unknown assumption ${a}`);
  if (!inf.primaryExplanation) err(`${inf.id}: missing primary explanation`);
  if (!inf.alternatives?.length) err(`${inf.id}: no alternative explanation (single-explanation output is forbidden)`);
  for (const alt of inf.alternatives || []) if (!alt.distinguishingEvidence) err(`${inf.id}: alternative without distinguishing evidence`);
  const cf = inf.counterfactuals || {};
  if (!(cf.falsify?.length || cf.strengthen?.length)) err(`${inf.id}: counterfactuals must include what would falsify or strengthen`);
  if (!inf.uncertainty?.length) err(`${inf.id}: no remaining uncertainty declared`);
}

/* -- executive findings ------------------------------------------------------ */
const narrative = readFileSync(join(ROOT, "content/dossier.md"), "utf8");
for (const ex of R.executiveFindings) {
  if (!ex.supports?.length) err(`${ex.id}: executive finding without support`);
  let evidenceBacked = false;
  for (const s of ex.supports) {
    if (!known.has(s.ref)) err(`${ex.id}: support ${s.ref} unknown`);
    if (claimById[s.ref]?.superseded) err(`${ex.id}: supported by superseded claim ${s.ref}`);
    if (resolvesToEvidence(s.ref)) evidenceBacked = true;
    if (s.ref.startsWith("CLM-") && !narrative.includes(s.ref)) err(`${ex.id}: cites ${s.ref} which the narrative never anchors (unsupported executive summary)`);
  }
  if (!evidenceBacked) err(`${ex.id}: executive finding does not resolve to evidence`);
  if (ex.reasoning && !infs.find((i) => i.id === ex.reasoning)) err(`${ex.id}: reasoning ${ex.reasoning} not found`);
  if (!Array.isArray(ex.uncertainty)) err(`${ex.id}: uncertainty must be declared (possibly empty array, never absent)`);
}

/* -- conflicts --------------------------------------------------------------- */
for (const con of d.contradictions) {
  const cf = R.conflicts.find((x) => x.conflict === con.id);
  if (!cf) { err(`contradiction ${con.id} has no conflict-resolution record (silent conflict)`); continue; }
  for (const ref of [...cf.sideA.refs, ...cf.sideB.refs]) if (!known.has(ref)) err(`${cf.id}: side ref ${ref} unknown`);
  if (!cf.resolution || !cf.resolutionState) err(`${cf.id}: missing resolution`);
  if (cf.remainingUncertainty == null) err(`${cf.id}: remaining uncertainty not declared`);
}

/* -- transparency ------------------------------------------------------------ */
for (const f of ["authoredBy", "producedIn", "inputs", "limitations"]) {
  if (!R.meta?.method?.[f]) err(`meta.method.${f} missing (hidden reasoning)`);
}
if (!R.meta.reasoningVersion || !R.meta.promptVersion) err("reasoning/prompt version missing");

/* -- generated graph integrity ------------------------------------------------ */
const nodeIds = new Set(graph.nodes.map((n) => n.id));
for (const e of graph.edges) {
  if (!nodeIds.has(e.from)) err(`graph edge from dangling node ${e.from}`);
  if (!nodeIds.has(e.to)) err(`graph edge to dangling node ${e.to}`);
  if (!e.via) err(`graph edge ${e.from}→${e.to} does not name its canonical origin`);
}
for (const ex of R.executiveFindings) if (!why[ex.id]) err(`why-index missing executive ${ex.id}`);
for (const c of d.claims.filter((c) => !c.superseded)) if (!why[c.id]) err(`why-index missing claim ${c.id}`);

if (errors.length) {
  for (const e of errors) console.error("ERROR " + e);
  console.error(`Reasoning validation FAILED: ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`Reasoning validation OK: ${infs.length} chains, ${R.executiveFindings.length} executive findings, ${R.conflicts.length} conflicts, ${graph.nodes.length} nodes / ${graph.edges.length} edges — every conclusion answers 'why'.`);
