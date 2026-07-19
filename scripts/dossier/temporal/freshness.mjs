/*
 * Freshness, relationship currentness and revalidation planning
 * (PROMPT-09 §12–§14, §31).
 *
 * Deterministic: freshness is evaluated AS OF an explicit reference date —
 * by default the current snapshot's evidence cutoff (so a rebuild without new
 * evidence never manufactures state drift). Pass --as-of=YYYY-MM-DD to
 * re-evaluate against a later date. The published UI additionally compares
 * next_due_at against the viewer's clock client-side, clearly labelled.
 *
 * Never mechanically decays epistemic truth: evidence quality (how well the
 * preserved artifact supported the record) is kept separate from currentness
 * (whether the real-world state may have moved since). Historical facts with
 * closed validity are NOT_APPLICABLE for revalidation.
 *
 * Output: static/data/dossier/revalidation/{freshness,plan,monitoring}.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { TEMPORAL_SCHEMA_VERSION, CASE_ID } from "./lib.mjs";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const SNAP_DIR = join(ROOT, "static/data/dossier/snapshots");
const OUT = join(ROOT, "static/data/dossier/revalidation");
const RUNS = join(ROOT, "cases/DD-Able-CZ-2026-07-17/provider-runs.ndjson");

const index = JSON.parse(readFileSync(join(SNAP_DIR, "index.json"), "utf8"));
const current = index.snapshots[index.snapshots.length - 1];
const objects = JSON.parse(readFileSync(join(SNAP_DIR, current.snapshot_id, "objects.json"), "utf8")).objects;
const cutoff = current.evidence_cutoff;

const asOfArg = process.argv.find((a) => a.startsWith("--as-of="));
const asOf = asOfArg ? asOfArg.split("=")[1] : cutoff;
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) { console.error("Invalid --as-of date"); process.exit(1); }

const addDays = (iso, days) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);

/* ---------------------------------------------------- provider run states */

const providerState = {}; // sourceId -> { lastAttempt, lastSuccess, failedAttempts, state }
if (existsSync(RUNS)) {
  for (const line of readFileSync(RUNS, "utf8").split("\n").filter(Boolean)) {
    let run; try { run = JSON.parse(line); } catch { continue; }
    const sid = run.sourceId; if (!sid) continue;
    const st = (providerState[sid] ||= { lastAttempt: null, lastSuccessTs: null, lastFailTs: null, failedAttempts: 0, state: "UNKNOWN" });
    const ts = run.finishedAt || run.startedAt || "";
    const t = ts.slice(0, 10);
    if (!st.lastAttempt || t > st.lastAttempt) st.lastAttempt = t;
    if (run.outcome === "ok") { if (!st.lastSuccessTs || ts > st.lastSuccessTs) st.lastSuccessTs = ts; }
    else { st.failedAttempts++; st.lastFailState = run.httpStatus >= 500 ? "PROVIDER_ERROR" : "BLOCKED"; if (!st.lastFailTs || ts > st.lastFailTs) st.lastFailTs = ts; }
  }
  // The most recent attempt decides: a failed substantive query after a
  // successful landing-page fetch means the provider is NOT available.
  for (const st of Object.values(providerState)) {
    if (st.lastFailTs && (!st.lastSuccessTs || st.lastFailTs > st.lastSuccessTs)) st.state = st.lastFailState;
    else if (st.lastSuccessTs) st.state = "AVAILABLE";
  }
}

/* -------------------------------------------------------------- policies */

/*
 * Revalidation policies (documented in docs/dossier/temporal/09). Intervals
 * express how quickly the REAL-WORLD state can plausibly move, not how old
 * the preserved artifact is — a preserved filing never rots, but the company
 * can file a new one.
 */
const POLICIES = {
  "ownership-statutory": { intervalDays: 30, dueSoonDays: 7, provider: "ARES / Veřejný rejstřík (SRC-12)", why: "Vlastnická struktura a statutární orgán se mohou změnit zápisem do rejstříku kdykoli; nejvyšší materialita." },
  "corporate-identity": { intervalDays: 90, dueSoonDays: 14, provider: "ARES / Veřejný rejstřík (SRC-12)", why: "Identifikační údaje (sídlo, kapitál, spisová značka) se mění zřídka." },
  "financial-filings": { intervalDays: 90, dueSoonDays: 30, provider: "Sbírka listin (justice.cz)", why: "Účetní závěrka FY2025 se očekává v průběhu roku 2026; kontrola po kvartálech." },
  "insolvency": { intervalDays: 7, dueSoonDays: 2, provider: "ISIR (SRC-21)", why: "Autoritativní registr byl při posledních pokusech BLOCKED (HTTP 500); dokud se dotaz nepodaří, je screening neuzavřený." },
  "dns-tls": { intervalDays: 30, dueSoonDays: 7, provider: "DNS / crt.sh (SRC-07, SRC-09)", why: "Provozní infrastruktura; certifikáty mají vlastní expirační cyklus." },
  "contracts-register": { intervalDays: 90, dueSoonDays: 14, provider: "Registr smluv (SRC-20)", why: "Nové veřejné zakázky se objevují průběžně." },
  "web-media": { intervalDays: 180, dueSoonDays: 30, provider: "web + archivace", why: "Publikované články jsou nemenné artefakty; hlídá se jen dostupnost URL — zachovaná evidence zůstává platná i při výpadku zdroje." },
  "historical-immutable": { intervalDays: null, dueSoonDays: null, provider: null, why: "Uzavřená historická fakta (ukončená platnost) se revalidací nemění; NOT_APPLICABLE." },
};

const SRC_POLICY = { "SRC-07": "dns-tls", "SRC-08": "dns-tls", "SRC-09": "dns-tls", "SRC-20": "contracts-register", "SRC-21": "insolvency", "SRC-12": "ownership-statutory" };

function policyFor(o) {
  if (o.object_type === "shareholding" || o.object_type === "statutory_role") {
    if (o.valid_to || /historical/i.test(o.payload.role || "")) return "historical-immutable";
    return "ownership-statutory";
  }
  if (o.object_type === "relationship") {
    if (/historical|do \d{4}|until/i.test(o.payload.label || "") || o.valid_to) return "historical-immutable";
    if (["OWNS", "OWNERSHIP", "SHAREHOLDER_OF", "ACQUIRED", "STATUTORY_REPRESENTATIVE_OF"].includes(o.payload.predicate)) return "ownership-statutory";
    return null; // relationships outside ownership/statutory are covered via their sources
  }
  if (o.object_type === "identity_field") return "corporate-identity";
  if (o.object_type === "financial_fact" && o.payload.bucket === "verified") return "financial-filings";
  if (o.object_type === "claim" && o.payload.status === "BLOCKED") return "insolvency";
  if (o.object_type === "source") {
    const p = SRC_POLICY[o.object_id];
    if (p) return p;
    if (/media|press|article|czechcrunch|forbes/i.test(o.payload.kind || "")) return "web-media";
    if (/registry|register|rejstřík|filed/i.test(o.payload.kind || "")) return "corporate-identity";
    return "web-media";
  }
  return null;
}

function lastVerificationOf(o) {
  if (o.object_type === "source") return o.payload.retrievedAt || cutoff;
  // Non-source objects: verified no later than the retrieval of their newest
  // cited source; fall back to the snapshot cutoff.
  const dates = (o.payload.sources || [])
    .map((sid) => objects.find((x) => x.object_type === "source" && x.object_id === sid)?.payload?.retrievedAt)
    .filter(Boolean);
  return dates.length ? dates.sort().at(-1) : cutoff;
}

function stateFor(policy, lastVerified, provState, o) {
  if (!policy.intervalDays) return { state: "NOT_APPLICABLE", nextDue: null };
  const nextDue = addDays(lastVerified, policy.intervalDays);
  // A record whose own status is BLOCKED stays BLOCKED until the provider
  // query actually succeeds — freshness never launders a blocked screening.
  if (o?.payload?.status === "BLOCKED") return { state: "BLOCKED", nextDue };
  if (provState && (provState.state === "BLOCKED" || provState.state === "PROVIDER_ERROR")) return { state: "BLOCKED", nextDue };
  if (asOf >= nextDue) {
    return { state: daysBetween(nextDue, asOf) > policy.intervalDays ? "STALE" : "DUE", nextDue };
  }
  if (daysBetween(asOf, nextDue) <= policy.dueSoonDays) return { state: "DUE_SOON", nextDue };
  return { state: "FRESH", nextDue };
}

/* ------------------------------------------------------------- freshness */

const items = [];
for (const o of objects) {
  const pid = policyFor(o);
  if (!pid) continue;
  const policy = POLICIES[pid];
  const provState = o.object_type === "source" ? providerState[o.object_id] : (o.payload.sources || []).map((s) => providerState[s]).find(Boolean);
  const lastVerified = lastVerificationOf(o);
  const { state, nextDue } = stateFor(policy, lastVerified, provState, o);
  const dependents = objects.filter((x) => (x.payload.sources || []).includes(o.object_id)).length;
  items.push({
    object_id: o.object_id,
    object_type: o.object_type,
    label: o.payload.label || o.payload.name || o.payload.title || o.payload.metric || o.payload.field || o.payload.text || o.object_id,
    policy_id: pid,
    last_successful_verification: lastVerified,
    last_attempt: provState?.lastAttempt || lastVerified,
    next_due_at: nextDue,
    current_state: state,
    stale_reason: state === "BLOCKED" ? "Poskytovatel je blokovaný / vrací chybu — nejde o zjištěnou negativní skutečnost."
      : (state === "DUE" || state === "STALE") ? `Od poslední verifikace (${lastVerified}) uplynul interval politiky ${pid} (${policy.intervalDays} dní).`
      : null,
    failed_attempt_count: provState?.failedAttempts || 0,
    provider_state: provState?.state || "UNKNOWN",
    materiality: pid === "ownership-statutory" || pid === "insolvency" ? "HIGH" : pid === "financial-filings" || pid === "corporate-identity" ? "MEDIUM" : "LOW",
    recommended_action: state === "BLOCKED" ? "Opakovat dotaz na poskytovatele; do úspěchu držet stav BLOCKED."
      : state === "FRESH" ? null : `Znovu ověřit přes: ${policy.provider}`,
    dependent_record_count: dependents,
  });
}

/* -------------------------------------- relationship currentness (§13) */

const relationshipCurrentness = objects.filter((o) => o.object_type === "relationship").map((o) => {
  const pid = policyFor(o);
  const historical = pid === "historical-immutable";
  const lastVerified = lastVerificationOf(o);
  const policy = pid && POLICIES[pid].intervalDays ? POLICIES[pid] : null;
  const dueAt = policy ? addDays(lastVerified, policy.intervalDays) : null;
  return {
    object_id: o.object_id,
    label: o.payload.label,
    evidence_quality: o.payload.status, // how well preserved evidence supported it — never decays
    currentness_state: historical ? "HISTORICAL" : !policy ? "UNSCHEDULED" : asOf >= dueAt ? "REVALIDATION_DUE" : "CURRENT_AS_VERIFIED",
    last_verified_at: lastVerified,
    revalidation_due_at: dueAt,
    expiry_policy: pid,
    decay_reason: historical ? "Uzavřená platnost — vztah je historický fakt, revalidace není aplikovatelná." : null,
  };
});

/* --------------------------------------------------- revalidation plan */

const MAT_W = { HIGH: 40, MEDIUM: 20, LOW: 5 };
const STATE_W = { BLOCKED: 35, STALE: 30, DUE: 25, DUE_SOON: 10, FRESH: 0, NOT_APPLICABLE: 0 };
const due = items.filter((i) => ["BLOCKED", "STALE", "DUE", "DUE_SOON"].includes(i.current_state));
const tasks = due
  .map((i) => ({
    task_id: "REV-" + i.object_id,
    object_id: i.object_id,
    object_type: i.object_type,
    label: i.label,
    reason_due: i.stale_reason || (i.current_state === "DUE_SOON" ? "Blíží se termín revalidace dle politiky." : i.current_state),
    last_verified: i.last_successful_verification,
    next_due_at: i.next_due_at,
    state: i.current_state,
    recommended_provider: POLICIES[i.policy_id].provider,
    expected_information_gain: i.current_state === "BLOCKED" ? "Uzavření screeningu, který dosud nebylo možné provést." : "Potvrzení či aktualizace aktuálního stavu; případná nová změna do snapshot diffu.",
    affected_dependents: i.dependent_record_count,
    estimated_effort: "jeden dotaz poskytovatele + přezkum diffů",
    priority_score: (MAT_W[i.materiality] || 0) + (STATE_W[i.current_state] || 0) + Math.min(i.dependent_record_count, 15),
    materiality: i.materiality,
    stop_condition: "Úspěšný dotaz s uchovaným artefaktem, NEBO 3 neúspěšné pokusy → záznam zůstává BLOCKED s incidentem.",
  }))
  .sort((a, b) => b.priority_score - a.priority_score || a.task_id.localeCompare(b.task_id));

/* ---------------------------------------------------------- monitoring */

const monitoring = {
  wording_note: "Toto je PLÁN monitoringu, ne tvrzení o běžící infrastruktuře. Žádný proces na pozadí neběží; kontroly se provádějí ručně spuštěním evidence:fetch a jsou doložené v provider-runs.ndjson.",
  monitored_entities: [
    { id: "able", name: "Able.cz s.r.o. (IČO 24278815)", why: "subjekt šetření" },
    { id: "blackfish", name: "Blackfish & Co. s.r.o. (IČO 06526411)", why: "100% dceřiná společnost od 07/2025" },
    { id: "zenx", name: "ZenX Capital, a.s. (IČO 09289127)", why: "největší společník (~45,8 %)" },
  ],
  providers: Object.entries(POLICIES).filter(([, p]) => p.provider).map(([pid, p]) => {
    const relevant = items.filter((i) => i.policy_id === pid);
    const lastCheck = relevant.map((i) => i.last_attempt).sort().at(-1) || null;
    const nextDue = relevant.map((i) => i.next_due_at).filter(Boolean).sort()[0] || null;
    return {
      policy_id: pid, provider: p.provider, cadence_days: p.intervalDays, why: p.why,
      last_completed_check: lastCheck, next_recommended_check: nextDue,
      status: relevant.some((i) => i.current_state === "BLOCKED") ? "BLOCKED" : relevant.some((i) => ["DUE", "STALE"].includes(i.current_state)) ? "DUE" : "OK",
      open_failures: relevant.reduce((n, i) => n + i.failed_attempt_count, 0),
      monitored_records: relevant.length,
    };
  }),
};

/* ------------------------------------------------------------- write out */

mkdirSync(OUT, { recursive: true });
const header = (kind) => ({
  schemaVersion: TEMPORAL_SCHEMA_VERSION, kind, caseId: CASE_ID,
  snapshotId: current.snapshot_id, evidenceCutoff: cutoff, asOf,
  asOfNote: asOf === cutoff
    ? "Stav vyhodnocen k meznímu datu evidence (deterministicky). Prohlížeč navíc porovnává next_due_at s aktuálním datem klienta — označeno v UI."
    : "Stav vyhodnocen k explicitnímu --as-of datu.",
  generatedAt: cutoff,
});

const byState = {}; for (const i of items) byState[i.current_state] = (byState[i.current_state] || 0) + 1;
writeFileSync(join(OUT, "freshness.json"), JSON.stringify({ _export: header("freshness"), byState, items, relationshipCurrentness }, null, 2) + "\n");
writeFileSync(join(OUT, "plan.json"), JSON.stringify({ _export: header("revalidation-plan"), taskCount: tasks.length, tasks }, null, 2) + "\n");
writeFileSync(join(OUT, "monitoring.json"), JSON.stringify({ _export: header("monitoring-plan"), ...monitoring }, null, 2) + "\n");
console.log(`Freshness: ${items.length} monitored records ${JSON.stringify(byState)}; ${tasks.length} revalidation tasks; ${monitoring.providers.length} provider policies.`);
