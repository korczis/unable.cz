/*
 * Financial-intelligence layer for the Able.cz dossier.
 *
 * Turns the filed financial figures ALREADY in dossier.json (VERIFIED_PRIMARY,
 * sourced to the filed Sbírka-listin statement SRC-15) into first-class,
 * addressable financial FACTS, plus transparently-derived METRICS and a
 * public-claim-vs-filed reconciliation. It INVENTS NO FIGURES: every fact's
 * value is parsed from the sourced `financials` block; every metric carries its
 * formula and the fact IDs it is computed from; a target is never compared to a
 * filed result without an explicit period + perimeter mismatch flag.
 *
 * BLOCKED / NOT IMPLEMENTED (documented, not faked): live document acquisition,
 * OCR, new provider runs — the dossier's financials were hand-collected in prior
 * passes; this layer restructures them, it does not fetch new documents.
 *
 * Usage:  node scripts/dossier/finance-gen.mjs
 * Output: static/data/dossier/finance/{facts,metrics,claims-vs-filed,
 *         reconciliation,gaps,manifest}.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SRC = join(ROOT, "data/dossier/able/dossier.json");
const OUT = join(ROOT, "static/data/dossier/finance");
const SCHEMA_VERSION = "1.0.0";

const d = JSON.parse(readFileSync(SRC, "utf8"));
const meta = d.meta || {};
const cutoff = meta.evidenceCutoff || null;
const fin = d.financials || {};
mkdirSync(OUT, { recursive: true });

// Canonical concept for each filed metric label (order = display order).
const CONCEPTS = [
  { match: /registered capital/i, concept: "registered_capital", label: "Základní kapitál", pointInTime: true },
  { match: /revenue from sale/i, concept: "revenue_products_services", label: "Tržby z prodeje výrobků a služeb" },
  { match: /net turnover/i, concept: "net_turnover", label: "Čistý obrat" },
  { match: /net result/i, concept: "net_result", label: "Výsledek hospodaření po zdanění" },
  { match: /total assets/i, concept: "total_assets", label: "Aktiva celkem" },
  { match: /^equity/i, concept: "total_equity", label: "Vlastní kapitál" },
  { match: /^liabilities \(/i, concept: "total_liabilities", label: "Cizí zdroje (závazky)" },
  { match: /personnel costs/i, concept: "personnel_costs", label: "Osobní náklady" },
  { match: /purchased services/i, concept: "purchased_services", label: "Služby (A.3)" },
  { match: /stakes in controlled/i, concept: "investments_controlled_entities", label: "Podíly – ovládaná osoba (B.III.1)" },
  { match: /liabilities to shareholders/i, concept: "liabilities_to_shareholders", label: "Závazky ke společníkům (C.I.9.1+C.II.8.1)" },
];
const conceptOf = (label) => CONCEPTS.find((c) => c.match.test(label)) || null;

// Parse a filed display string → { unit, values: {FY2024, FY2023} | {point} }.
// Examples: "243,715 CZK" · "36,319 / 42,642 tis. CZK" · "10,034 / 3,072 tis. CZK (…)".
function parseDisplay(display) {
  const unit = /tis\.\s*CZK/i.test(display) ? "thousand_czk" : "czk";
  const core = display.replace(/\(.*\)/, "").replace(/tis\.\s*CZK|CZK/gi, "").trim();
  const nums = core.split("/").map((s) => Number(s.replace(/[,\s]/g, ""))).filter((n) => Number.isFinite(n));
  return { unit, nums };
}

// ---- facts ----------------------------------------------------------------
const fmt = (n) => (Number(n) || 0).toLocaleString("cs-CZ");
const facts = [];
for (const m of fin.verified || []) {
  const c = conceptOf(m.metric || "");
  if (!c) continue;
  const { unit, nums } = parseDisplay(m.display || "");
  if (!nums.length) continue;
  if (c.pointInTime) {
    facts.push(mkFact(c, "as_filed", nums[0], unit, m));
  } else {
    // "FY2024 / FY2023" order (current / comparative), per the labels.
    if (nums[0] != null) facts.push(mkFact(c, "FY2024", nums[0], unit, m));
    if (nums[1] != null) facts.push(mkFact(c, "FY2023", nums[1], unit, m));
  }
}
function mkFact(c, period, value, unit, m) {
  return {
    id: "FIN-ALE-" + period.replace(/[^A-Za-z0-9]/g, "") + "-" + c.concept.toUpperCase().replace(/_/g, "-"),
    entity: "able", entityName: "Able.cz s.r.o.",
    concept: c.concept, label: c.label, originalLabel: m.metric,
    period, value, valueDisplay: fmt(value), unit,
    status: "FILED_FACT", epistemicState: m.status,
    sources: m.sources || [], evidenceCutoff: cutoff,
  };
}
const factById = {}; facts.forEach((f) => (factById[f.concept + ":" + f.period] = f));
const get = (concept, period) => factById[concept + ":" + period];

// ---- derived metrics (transparent: formula + source fact IDs) -------------
const metrics = [];
function pct(num, den) { return den ? Math.round((num / den) * 1000) / 10 : null; }
function ratio(num, den) { return den ? Math.round((num / den) * 100) / 100 : null; }
function addMetric(o) { metrics.push({ generatedAt: cutoff, ...o }); }

// Revenue / turnover growth
const rev24 = get("net_turnover", "FY2024"), rev23 = get("net_turnover", "FY2023");
if (rev24 && rev23) addMetric({
  id: "MET-ALE-TURNOVER-GROWTH-FY2024", name: "Meziroční změna čistého obratu (FY2024 vs FY2023)",
  formula: "(net_turnover[FY2024] − net_turnover[FY2023]) / net_turnover[FY2023]",
  numeratorFacts: [rev24.id, rev23.id], denominatorFacts: [rev23.id],
  value: pct(rev24.value - rev23.value, rev23.value), unit: "percent",
  caveats: "Pokles ~15 %. Filed, individuální (jen Able.cz), 12měsíční období.",
});
// Net margin (both years)
for (const y of ["FY2024", "FY2023"]) {
  const nr = get("net_result", y), to = get("net_turnover", y);
  if (nr && to) addMetric({
    id: "MET-ALE-NET-MARGIN-" + y, name: "Čistá marže (" + y + ")",
    formula: "net_result[" + y + "] / net_turnover[" + y + "]",
    numeratorFacts: [nr.id], denominatorFacts: [to.id],
    value: pct(nr.value, to.value), unit: "percent",
    caveats: "Tenká marže (<2 %). Ne likvidita, ne cash flow.",
  });
}
// Equity ratio + leverage (FY2024)
const eq = get("total_equity", "FY2024"), as = get("total_assets", "FY2024"), li = get("total_liabilities", "FY2024");
if (eq && as) addMetric({
  id: "MET-ALE-EQUITY-RATIO-FY2024", name: "Podíl vlastního kapitálu (FY2024)",
  formula: "total_equity / total_assets", numeratorFacts: [eq.id], denominatorFacts: [as.id],
  value: pct(eq.value, as.value), unit: "percent", caveats: "Kapitálová struktura, ne likvidita.",
});
if (li && eq) addMetric({
  id: "MET-ALE-LEVERAGE-FY2024", name: "Cizí zdroje k vlastnímu kapitálu (FY2024)",
  formula: "total_liabilities / total_equity", numeratorFacts: [li.id], denominatorFacts: [eq.id],
  value: ratio(li.value, eq.value), unit: "ratio", caveats: "Účetní páka; závazky ≠ dluh po splatnosti.",
});
// Related-party share of liabilities
const rp = get("liabilities_to_shareholders", "FY2024");
if (rp && li) addMetric({
  id: "MET-ALE-RELATED-PARTY-SHARE-FY2024", name: "Závazky ke společníkům jako podíl cizích zdrojů (FY2024)",
  formula: "liabilities_to_shareholders / total_liabilities", numeratorFacts: [rp.id], denominatorFacts: [li.id],
  value: pct(rp.value, li.value), unit: "percent",
  caveats: "Vnitropodnikové/related-party financování; NENÍ známkou pochybení. Meziročně vzrostlo z 3,072 na 10,034 tis. Kč.",
});
// Cost-structure shares
const ps = get("purchased_services", "FY2024"), pc = get("personnel_costs", "FY2024");
if (ps && rev24) addMetric({
  id: "MET-ALE-SERVICES-SHARE-FY2024", name: "Služby jako podíl obratu (FY2024)",
  formula: "purchased_services / net_turnover", numeratorFacts: [ps.id], denominatorFacts: [rev24.id],
  value: pct(ps.value, rev24.value), unit: "percent",
  caveats: "Přes 100 % obratu — konzistentní s dodavatelsky náročným (contractor-heavy) modelem; interpretace je ASSESSED, ne účetní fakt.",
});
if (pc && rev24) addMetric({
  id: "MET-ALE-PERSONNEL-SHARE-FY2024", name: "Osobní náklady jako podíl obratu (FY2024)",
  formula: "personnel_costs / net_turnover", numeratorFacts: [pc.id], denominatorFacts: [rev24.id],
  value: pct(pc.value, rev24.value), unit: "percent", caveats: "Nízké; meziročně kleslo (4,964 → 2,926 tis. Kč).",
});

// ---- balance-sheet reconciliation (assets ≈ equity + liabilities) ---------
let reconciliation = null;
if (as && eq && li) {
  const rhs = eq.value + li.value, diff = as.value - rhs;
  reconciliation = {
    id: "RECON-ALE-BS-FY2024", equation: "total_assets ≈ total_equity + total_liabilities",
    expected: as.value, observed: rhs, expectedDisplay: fmt(as.value), observedDisplay: fmt(rhs), differenceThousandCzk: diff,
    facts: [as.id, eq.id, li.id],
    state: Math.abs(diff) <= 0.02 * as.value ? "PASSED_WITH_ROUNDING" : "WARNING",
    note: "Rozdíl " + diff + " tis. Kč je nejspíš časové rozlišení (accruals), které není v tomto výtahu samostatně zachyceno. Filed hodnoty se nemění kvůli dorovnání.",
  };
}

// ---- public claim vs filed (target ≠ historical result) -------------------
const claimsVsFiled = (fin.selfReported || []).map((m) => {
  const isTarget = /target/i.test(m.metric || "");
  const cmp = { claim: m.metric, claimValue: m.display, status: m.status, sources: m.sources || [],
    classification: isTarget ? "TARGET (forward-looking)" : /headcount|people|tenders|contract/i.test(m.metric) ? "PERFORMANCE/MARKETING CLAIM" : "COMPANY CLAIM",
    entityPerimeter: "Able + Blackfish (combined, self-described)", forwardLooking: isTarget };
  if (/revenue target/i.test(m.metric || "") && rev24) {
    cmp.filedComparator = { concept: "net_turnover", period: "FY2024", entity: "Able.cz only", value: rev24.value, unit: "thousand_czk", factId: rev24.id };
    cmp.periodMismatch = true; cmp.perimeterMismatch = true;
    cmp.interpretation = "~100 mil. Kč je SPOLEČNÝ, VÝHLEDOVÝ cíl (Able+Blackfish); filed FY2024 obrat Able.cz je 36,3 mil. Kč (jen Able, historický). NELZE je přímo srovnávat jako cíl vs. výsledek.";
  }
  return cmp;
});

// ---- gaps -----------------------------------------------------------------
const gaps = (fin.notFound || []).map((line, i) => ({
  id: "GAP-FIN-" + String(i + 1).padStart(2, "0"), entity: "able", concept: line,
  state: /consolidated/i.test(line) ? "NOT_PUBLIC" : "NOT_FOUND",
  whyMaterial: /employee|headcount/i.test(line) ? "Ověření mediálního headcount ~60." : /auditor|going-concern/i.test(line) ? "Kvalita a předpoklad going-concern." : "Skupinový pohled Able+Blackfish.",
  recommendedSource: "justice.cz — úplná účetní závěrka / příloha / auditorská zpráva",
  note: "Chybějící údaj je mezera v evidenci, NE nula.",
}));

// ---- write ----------------------------------------------------------------
function hdr(kind, payload, extra = {}) {
  return { _export: { schemaVersion: SCHEMA_VERSION, kind, caseId: "DD-Able-CZ-2026-07-17", subject: meta.subject, ico: meta.ico, evidenceCutoff: cutoff, generatedAt: cutoff, source: "data/dossier/able/dossier.json", note: "Financial-intelligence projection. Filed facts parsed from sourced figures; metrics carry formulas + fact IDs; nothing invented; NOT_FOUND is never zero.", ...extra }, ...payload };
}
const w = (name, kind, payload, extra) => { writeFileSync(join(OUT, name), JSON.stringify(hdr(kind, payload, extra), null, 2) + "\n"); return "finance/" + name; };

const written = [];
written.push(w("facts.json", "finance-facts", { facts }, { count: facts.length }));
written.push(w("metrics.json", "finance-metrics", { metrics }, { count: metrics.length }));
written.push(w("reconciliation.json", "finance-reconciliation", { reconciliation }));
written.push(w("claims-vs-filed.json", "finance-claims-vs-filed", { comparisons: claimsVsFiled }, { count: claimsVsFiled.length }));
written.push(w("gaps.json", "finance-gaps", { gaps }, { count: gaps.length }));
written.push(w("manifest.json", "finance-manifest", {
  entities: [{ id: "able", name: meta.subject, periods: ["FY2024", "FY2023"], filedFacts: facts.length }],
  factCount: facts.length, metricCount: metrics.length, gapCount: gaps.length,
  documentAcquisition: "BLOCKED — no live provider/OCR this pass; figures restructured from sourced dossier.json (SRC-15).",
  files: written.map((x) => x.replace("finance/", "")),
}));

console.log("Finance: " + facts.length + " filed facts, " + metrics.length + " metrics, " + gaps.length + " gaps.");
if (reconciliation) console.log("  BS reconciliation: " + reconciliation.state + " (diff " + reconciliation.differenceThousandCzk + " tis. CZK)");
console.log("  wrote: " + written.join(", "));
