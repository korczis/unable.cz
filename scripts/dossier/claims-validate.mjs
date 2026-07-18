/*
 * Claim Object System validator — count reconciliation + link integrity.
 *
 * Fails the build if the claim accounting is inconsistent, a claim lacks its
 * route/JSON, a supersession link dangles, or a CLM-* referenced in the
 * narrative has no generated route. Runs against the canonical source, the
 * generated JSON/content, and (when present) the built public/ output.
 *
 * Exit 0 = all pass. Exit 1 = at least one ERROR.
 *
 * Usage: node scripts/dossier/claims-validate.mjs
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SRC = join(ROOT, "data/dossier/able/dossier.json");
const DATA = join(ROOT, "static/data/dossier/claims");
const CONTENT = join(ROOT, "content/dossier/claims");
const PUBLIC = join(ROOT, "public/dossier/claims");

const errors = [];
const err = (code, msg) => errors.push(`[${code}] ${msg}`);

const d = JSON.parse(readFileSync(SRC, "utf8"));
const claims = d.claims || [];
const ids = new Set(claims.map((c) => c.id));
const slug = (id) => id.toLowerCase();

// ---- 1. generated artifacts exist for every claim ------------------------
if (!existsSync(join(DATA, "manifest.json"))) err("NO_MANIFEST", "manifest.json not generated — run claims-gen.mjs");
const manifest = existsSync(join(DATA, "manifest.json")) ? JSON.parse(readFileSync(join(DATA, "manifest.json"), "utf8")) : null;

for (const c of claims) {
  const s = slug(c.id);
  if (!existsSync(join(DATA, s + ".json"))) err("NO_JSON", `${c.id} has no JSON shard`);
  if (!existsSync(join(CONTENT, s + ".md"))) err("NO_PAGE", `${c.id} has no content page`);
}

// ---- 2. count reconciliation (the single-source-of-truth check) ----------
if (manifest) {
  const byStatus = {}; claims.forEach((c) => (byStatus[c.status] = (byStatus[c.status] || 0) + 1));
  const live = claims.filter((c) => !c.superseded).length;
  const superseded = claims.filter((c) => c.superseded).length;
  if (manifest.totalIssued !== claims.length) err("COUNT_ISSUED", `manifest totalIssued ${manifest.totalIssued} ≠ ${claims.length}`);
  if (manifest.liveCount !== live) err("COUNT_LIVE", `manifest liveCount ${manifest.liveCount} ≠ ${live}`);
  if (manifest.supersededCount !== superseded) err("COUNT_SUPERSEDED", `manifest supersededCount ${manifest.supersededCount} ≠ ${superseded}`);
  if (manifest.liveCount + manifest.supersededCount !== manifest.totalIssued) err("COUNT_ARITHMETIC", `live+superseded ≠ issued in manifest`);
  const sum = Object.values(byStatus).reduce((a, b) => a + b, 0);
  if (sum !== claims.length) err("COUNT_STATUS_SUM", `status counts sum ${sum} ≠ ${claims.length}`);
  for (const k of Object.keys(byStatus)) if (manifest.statusCounts[k] !== byStatus[k]) err("COUNT_STATUS", `manifest status ${k} mismatch`);
  if (manifest.routes.length !== claims.length) err("COUNT_ROUTES", `manifest routes ${manifest.routes.length} ≠ ${claims.length}`);
}

// ---- 3. supersession link integrity (no dangling successors) -------------
for (const c of claims) {
  for (const s of c.supersededBy || []) if (!ids.has(s)) err("DANGLING_SUCCESSOR", `${c.id} superseded by unknown ${s}`);
  if (c.superseded && (!c.supersededBy || !c.supersededBy.length)) err("SUPERSEDED_NO_SUCCESSOR", `${c.id} is superseded but names no successor`);
  if (c.superseded && !c.supersededReason) err("SUPERSEDED_NO_REASON", `${c.id} is superseded without a reason`);
}

// ---- 4. per-claim JSON internal integrity --------------------------------
for (const c of claims) {
  const p = join(DATA, slug(c.id) + ".json");
  if (!existsSync(p)) continue;
  const o = JSON.parse(readFileSync(p, "utf8"));
  if (o.id !== c.id) err("JSON_ID", `${p} id ${o.id} ≠ ${c.id}`);
  if (!o.proposition) err("JSON_NO_PROP", `${c.id} JSON has no proposition`);
  if (o.proposition !== c.text) err("JSON_PROP_DRIFT", `${c.id} JSON proposition drifted from canonical text`);
  if (!o.statusExplanation) err("JSON_NO_STATUS_EXPL", `${c.id} has no status explanation`);
  if (o.canonicalPath !== "/dossier/claims/" + slug(c.id) + "/") err("JSON_BAD_PATH", `${c.id} canonicalPath wrong`);
  // independence can never exceed source records (copies aren't authorities)
  if (o.independentUpstreams > o.sourceRecords) err("JSON_INDEP", `${c.id} independentUpstreams > sourceRecords`);
  // no private/internal leakage: no local filesystem path in the public shard
  if (/cases\/DD-Able-CZ|\/Users\/|artifacts\/sha256/.test(JSON.stringify(o))) err("JSON_INTERNAL_PATH", `${c.id} JSON leaks an internal path`);
  // no rodné-číslo-shaped token
  if (/\b\d{6}\/\d{3,4}\b/.test(JSON.stringify(o))) err("JSON_PII", `${c.id} JSON contains a rodné-číslo-shaped token`);
}

// ---- 5. narrative + template CLM references resolve to a route ------------
// Every CLM-\d+ mentioned in published prose/templates must have a generated route.
const scanFiles = [join(ROOT, "content/dossier.md")];
for (const f of scanFiles) {
  if (!existsSync(f)) continue;
  const txt = readFileSync(f, "utf8");
  const refs = txt.match(/\bCLM-\d+\b/g) || [];
  for (const r of new Set(refs)) if (!ids.has(r)) err("NARRATIVE_UNKNOWN_CLM", `${f} references ${r} which is not a canonical claim`);
}

// ---- 6. post-build: every route resolves in public/ (if built) -----------
if (existsSync(PUBLIC)) {
  for (const c of claims) {
    if (!existsSync(join(PUBLIC, slug(c.id), "index.html"))) err("NO_ROUTE_HTML", `${c.id} route not built in public/`);
  }
  const jsonPub = join(ROOT, "public/data/dossier/claims");
  if (existsSync(jsonPub)) for (const c of claims) if (!existsSync(join(jsonPub, slug(c.id) + ".json"))) err("NO_JSON_PUB", `${c.id} JSON not in public/`);
}

// ---- report --------------------------------------------------------------
console.log("Claim Object System validator");
console.log(`  claims ${claims.length} · live ${claims.filter((c) => !c.superseded).length} · superseded ${claims.filter((c) => c.superseded).length}`);
if (errors.length) {
  console.log(`\n  ${errors.length} ERROR(S):`);
  for (const e of errors) console.log("    ✖ " + e);
  console.log("\n✖ Claim validation FAILED.");
  process.exit(1);
}
console.log("\n✓ Claim Object System: routes, JSON, counts and links all reconcile.");
