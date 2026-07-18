/*
 * Claim Object System generator for the Able.cz dossier.
 *
 * Turns every CLM-* record in the canonical source of truth into a first-class,
 * addressable object: a manifest with honest accounting, one public JSON shard
 * per claim, and one static Zola page per claim (live AND superseded), plus the
 * claims index. Deterministic and idempotent — stamped to the evidence cutoff,
 * not wall-clock, so unchanged input yields byte-identical output.
 *
 * It INVENTS NOTHING. A claim carries only what dossier.json holds (id, text,
 * status, sources, supersession chain); everything else is either DERIVED
 * (independence via the source-upstream model, backlinks from the graph +
 * narrative) or emitted as an explicit null. No fabricated fields.
 *
 * Usage:  node scripts/dossier/claims-gen.mjs
 * Output: static/data/dossier/claims/{manifest,clm-NN}.json
 *         content/dossier/claims/{_index,clm-NN}.md
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SRC = join(ROOT, "data/dossier/able/dossier.json");
const DATA_OUT = join(ROOT, "static/data/dossier/claims");
const CONTENT_OUT = join(ROOT, "content/dossier/claims");
const SCHEMA_VERSION = "1.0.0";

const d = JSON.parse(readFileSync(SRC, "utf8"));
const meta = d.meta || {};
const cutoff = meta.evidenceCutoff || null;
const claims = d.claims || [];
const SRCX = {}; (d.sources || []).forEach((s) => (SRCX[s.id] = s));
const nodes = (d.graph?.nodes || []).map((n) => n.data);
const narrative = existsSync(join(ROOT, "content/dossier.md")) ? readFileSync(join(ROOT, "content/dossier.md"), "utf8") : "";

mkdirSync(DATA_OUT, { recursive: true });
mkdirSync(CONTENT_OUT, { recursive: true });

// Source upstream authority — same model as planner.mjs (docs/dossier/planner/09).
const UPSTREAM = {
  "SRC-01": "able_cz", "SRC-02": "able_cz", "SRC-03": "cz_register", "SRC-04": "forbes",
  "SRC-05": "czechcrunch", "SRC-06": "linkedin", "SRC-07": "dns", "SRC-08": "vies",
  "SRC-09": "crtsh", "SRC-10": "cz_register", "SRC-11": "cz_register", "SRC-12": "cz_register",
  "SRC-13": "czechcrunch", "SRC-14": "cz_register", "SRC-15": "cz_register", "SRC-16": "cz_register",
  "SRC-17": "cz_register", "SRC-18": "cz_register", "SRC-19": "cz_register", "SRC-20": "contracts_register",
  "SRC-21": "isir", "SRC-22": "media_unknown",
};
const PRIMARY_DOC = /primary registry document|filed financial|court (execution|notice)/i;
const upstream = (id) => UPSTREAM[id] || "unknown";

const STATUS_EXPLAIN = {
  VERIFIED_PRIMARY: "Přímo doloženo primárním/oficiálním zdrojem (např. přímý výpis rejstříku nebo zakládaná listina).",
  CORROBORATED: "Podpořeno více nezávisle vzniklými rodinami zdrojů. Pozor: dvě zrcadla téže autority nejsou nezávislé potvrzení.",
  SELF_REPORTED: "Uvádí subjekt (Able) nebo přidružená strana; bez nezávislého potvrzení.",
  ASSESSED: "Analytické čtení citované evidence, nikoli přímo doložený fakt.",
  CONTRADICTED: "Zdroje si věcně odporují; rozpor není vyřešen.",
  NOT_FOUND: "Zdroj byl úspěšně dotázán, ale žádný odpovídající záznam nevrátil.",
  BLOCKED: "Zdroj nešlo úspěšně dotázat (chyba/blokace). Z absence NELZE vyvodit negativní závěr.",
  RESOLVED: "Dříve rozporné, nyní rozhodnuto primárním zdrojem.",
  UNKNOWN: "Veřejná evidence otázku neuzavírá.",
};

function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; } return ("0000000" + h.toString(16)).slice(-8); }
const slugOf = (id) => id.toLowerCase();
const shortTitle = (c) => { const t = (c.text || "").replace(/\s+/g, " ").trim(); return t.length > 70 ? t.slice(0, 67).replace(/[\s,;:]+\S*$/, "") + "…" : t; };

// Reverse supersession: which claims does THIS claim replace (predecessors)?
function supersedes(id) { return claims.filter((c) => (c.supersededBy || []).includes(id)).map((c) => c.id); }

// Backlinks: entities (graph nodes) that reference the claim + narrative mentions.
function backlinks(id) {
  const entities = nodes.filter((n) => (n.claims || []).includes(id)).map((n) => ({ type: "entity", id: n.id, title: n.label, relation: "týká se entity" }));
  const re = new RegExp("\\b" + id.replace("-", "\\-") + "\\b", "g");
  const narrativeMentions = (narrative.match(re) || []).length;
  return { entities, narrativeMentions, total: entities.length + narrativeMentions + 1 /* always in the claims table */ };
}

// Translate internal filesystem provenance into safe public metadata (§18):
// strip local paths from public-facing titles. The proposition text is left
// byte-identical to canonical (the validator enforces no drift), so if a leak
// ever appears there it fails loudly rather than being silently rewritten.
function safeTitle(t) {
  return (t || "")
    .replace(/\s*\(?\s*cases\/DD-Able-CZ[^\s")]*\/?\)?/g, "")
    .replace(/\/Users\/[^\s")]+/g, "")
    .replace(/\bartifacts\/sha256\/[^\s")]+/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function claimObject(c) {
  const srcs = (c.sources || []).map((s) => ({
    id: s, title: safeTitle((SRCX[s] || {}).title) || null, url: (SRCX[s] || {}).url || null,
    tier: (SRCX[s] || {}).tier ?? null, upstream: upstream(s),
    primaryDoc: PRIMARY_DOC.test((SRCX[s] || {}).kind || ""),
  }));
  const ups = [...new Set(srcs.map((s) => s.upstream))];
  const obj = {
    schemaVersion: SCHEMA_VERSION,
    id: c.id,
    slug: slugOf(c.id),
    canonicalPath: "/dossier/claims/" + slugOf(c.id) + "/",
    caseId: "DD-Able-CZ-2026-07-17",
    proposition: c.text,
    shortTitle: shortTitle(c),
    status: c.status,
    statusExplanation: STATUS_EXPLAIN[c.status] || null,
    note: c.note || null,
    live: !c.superseded,
    publicationState: "public",
    sources: srcs,
    sourceRecords: srcs.length,
    independentUpstreams: ups.length,
    upstreams: ups,
    primaryDirectCount: srcs.filter((s) => s.primaryDoc).length,
    monoculture: ups.length <= 1,
    superseded: !!c.superseded,
    supersededBy: c.supersededBy || [],
    supersededByLinks: (c.supersededBy || []).map((s) => ({ id: s, contentPath: "@/dossier/claims/" + slugOf(s) + ".md" })),
    supersededReason: c.supersededReason || null,
    supersedes: supersedes(c.id),
    supersedesLinks: supersedes(c.id).map((s) => ({ id: s, contentPath: "@/dossier/claims/" + slugOf(s) + ".md" })),
    backlinks: backlinks(c.id),
    // Explicitly-null canonical fields the source model does not carry (never faked):
    subjectIds: null, predicate: null, objectIds: null, materiality: null,
    validFrom: null, validTo: null, lastVerifiedAt: cutoff, evidenceCutoff: cutoff,
    generatedAt: cutoff,
  };
  obj.contentHash = fnv(JSON.stringify({ t: c.text, s: c.status, src: c.sources, sup: c.supersededBy }));
  return obj;
}

// ---- clean stale generated content pages (idempotent) --------------------
for (const f of readdirSync(CONTENT_OUT)) {
  if (/^clm-\d+\.md$/.test(f)) rmSync(join(CONTENT_OUT, f));
}

// ---- generate per-claim JSON + content pages -----------------------------
const objs = claims.map(claimObject);
for (const o of objs) {
  writeFileSync(join(DATA_OUT, o.slug + ".json"), JSON.stringify(o, null, 2) + "\n");
  const fm =
    "+++\n" +
    'title = "' + o.id + " — " + o.shortTitle.replace(/"/g, "'") + '"\n' +
    'description = "' + (o.status + " tvrzení " + o.id + " v due diligence Able.cz. " + o.shortTitle).replace(/"/g, "'").slice(0, 155) + '"\n' +
    'template = "dossier/claim.html"\n' +
    // Noindex component pages of the main dossier Report — not standalone
    // Reports, so they carry no evidence-policy assertion (avoids faking dates).
    "[extra]\n" +
    'claim_id = "' + o.id + '"\n' +
    'data_path = "static/data/dossier/claims/' + o.slug + '.json"\n' +
    "+++\n";
  writeFileSync(join(CONTENT_OUT, o.slug + ".md"), fm);
}

// ---- manifest (accounting) -----------------------------------------------
const byStatus = {}; claims.forEach((c) => (byStatus[c.status] = (byStatus[c.status] || 0) + 1));
const live = objs.filter((o) => o.live);
const superseded = objs.filter((o) => o.superseded);
const manifest = {
  _export: {
    schemaVersion: SCHEMA_VERSION, kind: "claims-manifest", caseId: "DD-Able-CZ-2026-07-17",
    subject: meta.subject, ico: meta.ico, evidenceCutoff: cutoff, generatedAt: cutoff,
    source: "data/dossier/able/dossier.json",
    note: "Authoritative claim accounting. Every count derives from this manifest — the single reconciliation point for the dossier's claim numbers.",
  },
  totalIssued: claims.length,
  liveCount: live.length,
  supersededCount: superseded.length,
  statusCounts: byStatus,
  // The precise breakdown that reconciles "58" vs "49":
  accounting: {
    issued: claims.length,
    live: live.length,
    superseded: superseded.length,
    note: claims.length + " issued claim records = " + live.length + " live + " + superseded.length + " superseded (split/merged into successors, preserved for audit).",
  },
  issuedIds: claims.map((c) => c.id),
  liveIds: live.map((o) => o.id),
  supersededIds: superseded.map((o) => ({ id: o.id, supersededBy: o.supersededBy, reason: o.supersededReason })),
  routes: objs.map((o) => o.canonicalPath),
  dataHash: fnv(JSON.stringify(objs.map((o) => o.contentHash))),
};
writeFileSync(join(DATA_OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

// ---- claims index page ----------------------------------------------------
const indexFm =
  "+++\n" +
  'title = "Tvrzení (claims) — Able.cz DD"\n' +
  'description = "Úplný rejstřík tvrzení due diligence Able.cz: ' + claims.length + " vydaných záznamů (" + live.length + " živých, " + superseded.length + ' nahrazených), se stavem evidence a vlastní stránkou u každého."\n' +
  'sort_by = "slug"\n' +
  'template = "dossier/claims-index.html"\n' +
  'page_template = "dossier/claim.html"\n' +
  "[extra]\n" +
  "manifest_path = \"static/data/dossier/claims/manifest.json\"\n" +
  "+++\n";
writeFileSync(join(CONTENT_OUT, "_index.md"), indexFm);

console.log("Claims: generated " + objs.length + " claim objects (" + live.length + " live, " + superseded.length + " superseded).");
console.log("  manifest: totalIssued=" + claims.length + " byStatus=" + JSON.stringify(byStatus));
console.log("  routes under /dossier/claims/  ·  JSON under static/data/dossier/claims/  ·  dataHash=" + manifest.dataHash);
