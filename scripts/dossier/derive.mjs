/*
 * Epistemic derivation layer for the Able.cz dossier.
 *
 * export.mjs reshapes dossier.json losslessly into the base web exports
 * (entities, relationships, claims, evidence, ...). THIS script goes one level
 * deeper: it derives the investigation's *epistemic* projections — source
 * coverage, evidence gaps, hypotheses, and a prioritized investigation frontier
 * — that the base records only imply.
 *
 * It INVENTS NO FACTS. Every derived record carries a `derivedFrom` array of
 * the dossier record IDs (claims CLM-*, contradictions CON-*, open questions
 * OQ-*, source IDs SRC-*, financials.notFound) it is computed from, so each row
 * traces back to sourced evidence. The derivations are ASSESSED analytical
 * readings — ordinal only, never invented magnitudes — and are labelled as such.
 * A hypothesis is never emitted as a fact; a gap is the absence of evidence,
 * not a finding.
 *
 * Usage:  node scripts/dossier/derive.mjs   (run after export.mjs)
 * Output: static/data/able-cz/{coverage,gaps,hypotheses,frontier,lineage}.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SRC = join(ROOT, "data/dossier/able/dossier.json");
const OUT = join(ROOT, "static/data/able-cz");
const SCHEMA_VERSION = "1.0.0";

const d = JSON.parse(readFileSync(SRC, "utf8"));
const meta = d.meta || {};
const cutoff = meta.evidenceCutoff || null;
mkdirSync(OUT, { recursive: true });

// ---- indices --------------------------------------------------------------
const SRCX = {};
(d.sources || []).forEach((s) => (SRCX[s.id] = s));
const edges = (d.graph?.edges || []).map((e) => e.data);
const nodes = (d.graph?.nodes || []).map((n) => n.data);
const claims = d.claims || [];

/** Source class from a source record's kind/tier — same rule the graph UI uses. */
function provClass(id) {
  const s = SRCX[id];
  if (!s) return "other";
  const k = (s.kind || "") + " " + (s.tier || "");
  if (/register|registr|official|government|primary/i.test(k)) return "official";
  if (/company|legal notice|marketing/i.test(k)) return "company";
  if (/media|profile|forbes|crunch|aggregator/i.test(k)) return "media";
  return "other";
}
function isPrimaryFiled(id) {
  const s = SRCX[id];
  return !!s && s.tier === 1 && /primary registry document|official register|government/i.test(s.kind || "");
}
function tally(items, key = "status") {
  const out = {};
  for (const it of items || []) {
    const v = typeof key === "function" ? key(it) : it[key];
    if (v) out[v] = (out[v] || 0) + 1;
  }
  return out;
}

// Czech display labels for the derived ordinal enums (not evidence-status
// enums — those stay as-is). Kept here so templates/dossier.html needs no
// map lookups (Tera has no dict literals) and the labels live with the rule.
const CS_COVERAGE = { strong: "silné", adequate: "dostatečné", partial: "částečné", weak: "slabé", absent: "chybí" };
const CS_MAT = { high: "vysoká", moderate: "střední", low: "nízká" };
const CS_PRI = { high: "vysoká", medium: "střední", low: "nízká" };

function withHeader(kind, payload, extra = {}) {
  return {
    _export: {
      schemaVersion: SCHEMA_VERSION,
      kind,
      subject: meta.subject || null,
      ico: meta.ico || null,
      evidenceCutoff: cutoff,
      generatedAt: cutoff,
      source: "data/dossier/able/dossier.json",
      note:
        "ASSESSED epistemic projection. Derived from the dossier's sourced records; " +
        "every row lists the record IDs it is computed from. Ordinal scales only; nothing invented.",
      ...extra,
    },
    ...payload,
  };
}
function write(name, kind, payload, extra) {
  writeFileSync(join(OUT, name), JSON.stringify(withHeader(kind, payload, extra), null, 2) + "\n");
  return name;
}

// ===========================================================================
// 1. INVESTIGATION COVERAGE MATRIX
// ---------------------------------------------------------------------------
// For each investigation dimension: which sources were checked, the evidence
// status distribution of the records touching it, and an ASSESSED ordinal
// coverage state (strong | adequate | partial | weak | absent) by a written
// rule. The state is analytical, not a fact about the company.
// ===========================================================================

// Records touching each dimension, via the graph's own category tags plus a
// few blocks (identity, financials, media) that live outside the edge cats.
const DIMENSIONS = [
  { key: "identity", label: "Identita", cats: [], probe: (r) => r.__kind === "identity" },
  { key: "ownership", label: "Vlastnictví", cats: ["ownership"] },
  { key: "management", label: "Vedení a orgány", cats: ["governance", "people"] },
  { key: "financials", label: "Finance", cats: [], probe: (r) => r.__kind === "financials" },
  { key: "transactions", label: "Transakce", cats: ["transactions"] },
  { key: "legal", label: "Právní a exekuce", cats: ["legal"] },
  { key: "technical", label: "Digitální stopa", cats: ["technical"] },
  { key: "commercial", label: "Klienti a obchod", cats: ["client"] },
  { key: "media", label: "Média a diskurz", cats: [], probe: (r) => r.__kind === "media" },
  { key: "procurement", label: "Veřejné zakázky", cats: [], probe: () => false },
];

// Flatten every sourced record into a common shape for coverage probing.
const flatRecords = [];
(d.identity || []).forEach((f) =>
  flatRecords.push({ __kind: "identity", id: "identity:" + f.field, status: f.status, sources: f.sources || [] })
);
edges.forEach((e) =>
  flatRecords.push({ __kind: "edge", id: e.id, status: e.status, sources: e.sources || [], cat: e.cat })
);
claims.forEach((c) => flatRecords.push({ __kind: "claim", id: c.id, status: c.status, sources: c.sources || [] }));
[...(d.financials?.verified || []), ...(d.financials?.selfReported || [])].forEach((m, i) =>
  flatRecords.push({ __kind: "financials", id: "fin:" + i, status: m.status, sources: m.sources || [] })
);
(d.sources || [])
  .filter((s) => provClass(s.id) === "media")
  .forEach((s) => flatRecords.push({ __kind: "media", id: "media:" + s.id, status: "SELF_REPORTED", sources: [s.id] }));

function recordsForDim(dim) {
  return flatRecords.filter((r) => {
    if (dim.probe) return dim.probe(r);
    return r.__kind === "edge" && dim.cats.includes(r.cat);
  });
}

/** Written coverage rule → ordinal state. Documented in docs/dossier/depth/07. */
function coverageState(recs, sources) {
  if (!recs.length) return "absent";
  const st = tally(recs);
  const hasPrimaryFiled = sources.some(isPrimaryFiled);
  const anyVerified = (st.VERIFIED_PRIMARY || 0) > 0;
  const anyCorroborated = (st.CORROBORATED || 0) > 0;
  const onlySelf = !anyVerified && !anyCorroborated;
  const anyDisputed = (st.CONTRADICTED || 0) > 0;
  if (onlySelf) return "weak";
  if (hasPrimaryFiled && anyVerified && !anyDisputed) return "strong";
  if (anyVerified || (anyCorroborated && hasPrimaryFiled)) return "adequate";
  return "partial";
}

const OQ = (d.openQuestions || []).map((q, i) => ({ id: "OQ-" + String(i + 1).padStart(2, "0"), text: q }));
// Keyword routing of open questions to the dimensions they most concern.
const OQ_DIM = {
  "OQ-01": "financials",
  "OQ-02": "management",
  "OQ-03": "commercial",
  "OQ-04": "procurement",
  "OQ-05": "financials",
  "OQ-06": "ownership",
  "OQ-07": "ownership",
  "OQ-08": "ownership",
  "OQ-09": "ownership",
  "OQ-10": "ownership",
};

const coverage = DIMENSIONS.map((dim) => {
  const recs = recordsForDim(dim);
  const sourceIds = [...new Set(recs.flatMap((r) => r.sources))];
  const byClass = tally(sourceIds, (id) => provClass(id));
  const gaps = OQ.filter((q) => OQ_DIM[q.id] === dim.key).map((q) => q.id);
  const notFound =
    dim.key === "financials" ? (d.financials?.notFound || []).length : dim.key === "procurement" ? 1 : 0;
  const state = coverageState(recs, sourceIds);
  return {
    dimension: dim.key,
    label: dim.label,
    coverage: state,
    coverageCs: CS_COVERAGE[state],
    recordsExamined: recs.length,
    sourcesChecked: sourceIds,
    sourceClasses: byClass,
    statusDistribution: tally(recs),
    openGaps: gaps,
    notFoundCount: notFound,
    hasPrimaryFiled: sourceIds.some(isPrimaryFiled),
    derivedFrom: recs.map((r) => r.id),
    note:
      dim.key === "procurement"
        ? "Hlídač státu / registr smluv / dotační registry nebyly v tomto průchodu dotázány — viz OQ-04."
        : undefined,
  };
});

// ===========================================================================
// 2. GAP ANALYSIS
// ---------------------------------------------------------------------------
// Every open question, every financials.notFound line, and every NOT_FOUND-
// flagged item becomes a structured gap with an ASSESSED materiality and the
// recommended source to close it (taken from the dossier's own methodology
// notes where it names one).
// ===========================================================================
const GAP_MATERIALITY = {
  "OQ-01": "high", // filed financials — now partly closed, but headcount/full set open
  "OQ-02": "moderate",
  "OQ-03": "moderate",
  "OQ-04": "moderate",
  "OQ-05": "moderate",
  "OQ-06": "moderate", // CON-02 split
  "OQ-07": "low",
  "OQ-08": "low",
  "OQ-09": "low",
  "OQ-10": "high", // provenance ceiling: aggregator vs primary
};
const GAP_SOURCE = {
  "OQ-01": "justice.cz — Sbírka listin (úplná účetní závěrka)",
  "OQ-02": "or.justice.cz — výpis statutárního orgánu Able.cz",
  "OQ-03": "nezávislé potvrzení od klientů (mimo web Able)",
  "OQ-04": "Hlídač státu / registr smluv / dotační registry",
  "OQ-05": "justice.cz — Sbírka listin (Able i Blackfish)",
  "OQ-06": "or.justice.cz — přímý výpis IČO 02474727 (one label s.r.o.)",
  "OQ-07": "or.justice.cz — Ventoux Studio s.r.o. (IČO 23749636)",
  "OQ-08": "média / veřejné prohlášení k odchodu L. Oslzly z Blackfish",
  "OQ-09": "veřejný zdroj k rodinnému vztahu P. a V. Faragy (nenalezen)",
  "OQ-10": "přímý or.justice.cz fetch (nahradit aggregator mirrors SRC-10/11)",
};
const gaps = OQ.map((q) => ({
  id: "GAP-" + q.id.slice(3),
  category: "open_question",
  affectedDimension: OQ_DIM[q.id] || "identity",
  expectedDatum: q.text,
  materiality: GAP_MATERIALITY[q.id] || "moderate",
  materialityCs: CS_MAT[GAP_MATERIALITY[q.id] || "moderate"],
  recommendedSource: GAP_SOURCE[q.id] || null,
  status: "open",
  derivedFrom: [q.id],
}));
// financials.notFound → one aggregate gap per missing line item.
(d.financials?.notFound || []).forEach((line, i) => {
  gaps.push({
    id: "GAP-FIN-" + String(i + 1).padStart(2, "0"),
    category: "missing_datum",
    affectedDimension: "financials",
    expectedDatum: line,
    materiality: /employee|headcount|zaměstna/i.test(line) ? "moderate" : "low",
    materialityCs: CS_MAT[/employee|headcount|zaměstna/i.test(line) ? "moderate" : "low"],
    recommendedSource: "justice.cz — Sbírka listin / auditorská zpráva",
    status: "open",
    derivedFrom: ["financials.notFound"],
  });
});

// ===========================================================================
// 3. HYPOTHESIS LAYER
// ---------------------------------------------------------------------------
// The dossier already isolates its inferences and labels the "why" NOT_FOUND.
// Each such inference is a hypothesis: a proposition the evidence speaks to but
// does not settle. Ordinal state only (proposed | plausible | supported |
// contradicted | rejected | unresolved) — never a numeric probability. Every
// hypothesis lists supporting/contradicting record IDs and its falsification
// condition, so it can never be mistaken for a fact.
// ===========================================================================
const hypotheses = [
  {
    id: "HYP-01",
    proposition: "Petr Faraga je v příbuzenském vztahu s Václavem Faragou.",
    subject: "petr_faraga",
    predicate: "related_to",
    object: "faraga",
    state: "plausible",
    supporting: ["CLM-18"],
    supportingNote:
      "Sdílený znojemský adresní klastr, souběžná funkční historie (FaMe logistics, FaMe trade) a ~23letý věkový rozdíl.",
    contradicting: [],
    alternatives: ["Nesouvisející osoby se shodou příjmení a lokality."],
    falsification: "Přímý veřejný zdroj (rejstřík/matrika) potvrzující nebo vyvracející příbuznost.",
    nextBestEvidence: "or.justice.cz výpisy obou osob; veřejné rodinné vazby.",
    materiality: "low",
    derivedFrom: ["CLM-18", "OQ-09"],
  },
  {
    id: "HYP-02",
    proposition:
      "Souběžný podíl Víta Schlesingera ve Ventoux Studio s.r.o. má provozní souvislost s Able.cz.",
    subject: "schlesinger",
    predicate: "operational_bearing_on",
    object: "able",
    state: "unresolved",
    supporting: [],
    supportingNote:
      "Nezveřejněný souběžný podíl registrovaný ~2 měsíce po uzavření akvizice Blackfish (CLM-23).",
    contradicting: [],
    alternatives: ["Nezávislý soukromý zájem bez vazby na Able.cz (u aktivního podnikatele obvyklé)."],
    falsification: "Doklad o obchodním/smluvním vztahu mezi Ventoux Studio a Able.cz — žádný nenalezen.",
    nextBestEvidence: "or.justice.cz Ventoux Studio; registr smluv; média.",
    materiality: "moderate",
    derivedFrom: ["CLM-23", "OQ-07"],
  },
  {
    id: "HYP-03",
    proposition:
      "Marketingové role CTO (Grolig) a CSO (Juhaňák) odpovídají současné statutární funkci v Able.cz.",
    subject: "grolig",
    predicate: "holds_statutory_office_at",
    object: "able",
    state: "contradicted",
    supporting: [],
    supportingNote: "Web Able je prezentuje jako C-level vedení (SELF_REPORTED).",
    contradicting: ["CLM-20"],
    contradictingNote:
      "Nezávislý research nenašel Groliga ve statutárním orgánu ani mezi společníky Able.cz; Juhaňák je společník, ne potvrzený statutár.",
    alternatives: ["Čistě marketingové tituly bez statutární funkce (nejpravděpodobnější dle rejstříku)."],
    falsification: "Zápis ve statutárním orgánu Able.cz v rejstříku.",
    nextBestEvidence: "or.justice.cz — statutární orgán Able.cz.",
    materiality: "low",
    derivedFrom: ["CLM-20", "OQ-02"],
  },
  {
    id: "HYP-04",
    proposition:
      "Odchod Lukáše Oslzly z Blackfish (únor 2024) souvisí s jeho rolí v Artstay / Lovs & Co.",
    subject: "oslzla",
    predicate: "departure_linked_to",
    object: "artstay_lovs",
    state: "unresolved",
    supporting: [],
    supportingNote:
      "Časová shoda: Oslzla je jednatelem téže entity (IČO 10847031) od 2021 a jejím výhradním vlastníkem od 2022 (CLM-24).",
    contradicting: [],
    alternatives: ["Nesouvisející odchod; příčina je jinde a veřejně nedoložená."],
    falsification: "Veřejný zdroj vysvětlující důvod odchodu — žádný nenalezen (NOT_FOUND).",
    nextBestEvidence: "média / prohlášení; rejstříkové změny Blackfish v období.",
    materiality: "low",
    derivedFrom: ["CLM-24", "OQ-08"],
  },
];

// ===========================================================================
// 4. INVESTIGATION FRONTIER
// ---------------------------------------------------------------------------
// Prioritized next actions, one per unresolved lead (gaps + contradictions +
// provenance ceiling). Priority is an ASSESSED ordinal from a written rule
// combining materiality, resolvability (is a concrete public source known?),
// and current confidence — NOT graph degree.
// ===========================================================================
const MAT_RANK = { high: 3, moderate: 2, low: 1 };
function priorityOf(materiality, hasSource, confidenceWeak) {
  const score = (MAT_RANK[materiality] || 1) + (hasSource ? 1 : 0) + (confidenceWeak ? 1 : 0);
  if (score >= 4) return "high";
  if (score >= 3) return "medium";
  return "low";
}

const frontier = [];
// From contradictions — each is a concrete, resolvable lead.
(d.contradictions || []).forEach((c) => {
  const resolvable = /or\.justice\.cz|lookup|výpis|přímý/i.test(c.resolution || "");
  frontier.push({
    id: "TASK-" + c.id,
    target: c.field,
    question: "Vyřešit rozpor " + c.id + ": " + c.field,
    reason: c.resolution,
    expectedInformationGain: "high",
    recommendedSource:
      c.id === "CON-02"
        ? "or.justice.cz — přímý výpis IČO 02474727 (one label s.r.o.)"
        : "or.justice.cz — spisová značka Able.cz (C 85425)",
    materiality: c.id === "CON-02" ? "moderate" : "low",
    currentConfidence: "disputed",
    graphDepth: 2,
    status: "proposed",
    priority: priorityOf(c.id === "CON-02" ? "moderate" : "low", resolvable, true),
    derivedFrom: [c.id],
  });
});
// From gaps — skip already-closed; carry recommended source and materiality.
gaps.forEach((g) => {
  const hasSource = !!g.recommendedSource;
  frontier.push({
    id: "TASK-" + g.id,
    target: g.affectedDimension,
    question: g.expectedDatum,
    reason: "Otevřená mezera v evidenci (" + g.category + ") v dimenzi " + g.affectedDimension + ".",
    expectedInformationGain: g.materiality === "high" ? "high" : g.materiality === "moderate" ? "medium" : "low",
    recommendedSource: g.recommendedSource,
    materiality: g.materiality,
    currentConfidence: "unknown",
    graphDepth: g.affectedDimension === "identity" ? 0 : 1,
    status: "proposed",
    priority: priorityOf(g.materiality, hasSource, false),
    derivedFrom: g.derivedFrom,
  });
});
// From unresolved hypotheses — a hypothesis with an open falsification is a task.
hypotheses
  .filter((h) => h.state === "unresolved" || h.state === "plausible")
  .forEach((h) => {
    frontier.push({
      id: "TASK-" + h.id,
      target: h.subject,
      question: "Otestovat hypotézu " + h.id + ": " + h.proposition,
      reason: "Falzifikace: " + h.falsification,
      expectedInformationGain: h.materiality === "moderate" ? "medium" : "low",
      recommendedSource: h.nextBestEvidence,
      materiality: h.materiality,
      currentConfidence: h.state,
      graphDepth: 2,
      status: "proposed",
      priority: priorityOf(h.materiality, !!h.nextBestEvidence, false),
      derivedFrom: h.derivedFrom,
    });
  });
// Deterministic order: priority desc, then id.
const PRANK = { high: 3, medium: 2, low: 1 };
frontier.sort((a, b) => PRANK[b.priority] - PRANK[a.priority] || a.id.localeCompare(b.id));
frontier.forEach((t) => {
  t.priorityCs = CS_PRI[t.priority];
  t.materialityCs = CS_MAT[t.materiality] || t.materiality;
});

// ===========================================================================
// 5. LINEAGE INDEX
// ---------------------------------------------------------------------------
// One row per public claim: claim → source assertions → source records →
// retrieval metadata. The provenance chain the UI's "Why is this here?" walks.
// ===========================================================================
const lineage = claims.map((c) => ({
  claim: c.id,
  proposition: c.text,
  epistemicState: c.status,
  assertions: (c.sources || []).map((sid) => ({
    source: sid,
    sourceClass: provClass(sid),
    title: (SRCX[sid] || {}).title || null,
    tier: (SRCX[sid] || {}).tier ?? null,
    retrievedAt: (SRCX[sid] || {}).retrievedAt || null,
    primaryFiled: isPrimaryFiled(sid),
  })),
}));

// ---- write ----------------------------------------------------------------
const written = [];
written.push(
  write("coverage.json", "coverage", { dimensions: coverage }, {
    count: coverage.length,
    byState: tally(coverage, "coverage"),
    stateLegend: {
      strong: "Primární doložený zdroj + VERIFIED_PRIMARY, bez rozporu.",
      adequate: "Ověřeno primárně nebo více nezávislými zdroji; drobné mezery.",
      partial: "Převážně CORROBORATED přes agregátory/média, nebo významná mezera.",
      weak: "Pouze SELF_REPORTED — čeká na nezávislé potvrzení.",
      absent: "Dimenze v tomto průchodu nebyla dotázána.",
    },
  })
);
written.push(
  write("gaps.json", "gaps", { gaps }, { count: gaps.length, byMateriality: tally(gaps, "materiality") })
);
written.push(
  write("hypotheses.json", "hypotheses", { hypotheses }, {
    count: hypotheses.length,
    byState: tally(hypotheses, "state"),
    disclaimer:
      "Hypotézy jsou ASSESSED tvrzení, k nimž se evidence vyjadřuje, ale neuzavírá je. Nejsou to fakta ani obvinění; každá nese podmínku falzifikace.",
  })
);
written.push(
  write("frontier.json", "frontier", { tasks: frontier }, {
    count: frontier.length,
    byPriority: tally(frontier, "priority"),
    note: "Priorita je ASSESSED ordinál (materialita + řešitelnost + slabost důvěry), ne stupeň grafu.",
  })
);
written.push(write("lineage.json", "lineage", { lineage }, { count: lineage.length }));

console.log("Derived " + written.length + " epistemic exports to static/data/able-cz/:");
for (const w of written) console.log("  - " + w);
console.log(
  "  coverage byState: " + JSON.stringify(tally(coverage, "coverage")) +
    " | gaps: " + gaps.length + " | hypotheses: " + hypotheses.length + " | frontier: " + frontier.length
);
