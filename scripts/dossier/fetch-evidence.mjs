/*
 * Evidence retrieval for DD-Able-CZ: fetch lawful primary/official sources,
 * preserve them content-addressed, hash them, and record provider runs.
 *
 * This script INVENTS NOTHING and never writes a body it did not receive.
 * Every fetch — success or failure — is appended to
 * cases/DD-Able-CZ-2026-07-17/provider-runs.ndjson. Successful bodies whose
 * publication class allows storage are written to
 * cases/DD-Able-CZ-2026-07-17/artifacts/sha256/<p2>/<hash> and indexed in
 * cases/DD-Able-CZ-2026-07-17/artifacts/manifest.ndjson.
 *
 * Publication classes:
 *   OFFICIAL_PUBLIC   – official/open-data records (ARES, justice.cz docs,
 *                       VIES, dns.google, crt.sh): body stored, publishable.
 *   FIRST_PARTY       – able.cz pages (subject authorized the DD on record):
 *                       body stored, publishable with attribution.
 *   METADATA_ONLY     – copyrighted third-party pages (media): body hashed,
 *                       NOT stored (this repo is public — storing would
 *                       republish); hash + headers + length recorded as
 *                       retrieval proof.
 *   BLOCKED           – not fetched (e.g. LinkedIn: terms prohibit automated
 *                       retrieval); recorded as a blocked run, no artifact.
 *
 * Usage: node scripts/dossier/fetch-evidence.mjs [--only <tag>] [--run-id <id>]
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CASE = join(ROOT, "cases/DD-Able-CZ-2026-07-17");
const ART = join(CASE, "artifacts");
const RUNS = join(CASE, "provider-runs.ndjson");
const MANIFEST = join(ART, "manifest.ndjson");

const args = process.argv.slice(2);
const onlyTag = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const runBatch = args.includes("--run-id") ? args[args.indexOf("--run-id") + 1] : `run-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}`;

const UA = "unable.cz-dd-evidence/1.0 (public-source due diligence; contact: korczis@gmail.com)";

/** Entities in scope (IČO resolved from dossier.json; two resolved by ARES search). */
const ENTITIES = [
  { slug: "able-cz", ico: "24278815", name: "Able.cz s.r.o." },
  { slug: "blackfish", ico: "06526411", name: "Blackfish & Co. s.r.o." },
  { slug: "one-label", ico: "02474727", name: "one label s.r.o." },
  { slug: "mindee-app", ico: "06437877", name: "Mindee app s.r.o." },
  { slug: "era25", ico: "23630051", name: "ERA25 s.r.o." },
  { slug: "verzuz-com", ico: "24094323", name: "Verzuz.com s.r.o." },
  { slug: "fame-logistics", ico: "02019396", name: "FaMe logistics s.r.o. v likvidaci" },
  { slug: "fame-trade", ico: "29292859", name: "FaMe trade s.r.o." },
  { slug: "fama-media", ico: "04481275", name: "FaMa Media s.r.o." },
  { slug: "mm-plan", ico: "01812840", name: "M&M plan s.r.o." },
  { slug: "ventoux-studio", ico: "23749636", name: "Ventoux Studio s.r.o." },
  { slug: "vit-schlesinger-sro", ico: "21032432", name: "Vít Schlesinger s.r.o." },
  { slug: "artstay-lovs", ico: "10847031", name: "Artstay / Lovs & Co. s.r.o." },
  { slug: "mysasy", ico: "04786220", name: "mySASY a.s." },
  { slug: "bgo", ico: "19173661", name: "BGO s.r.o." },
  { slug: "usporix", ico: "29725364", name: "Usporix, s.r.o." },
  { slug: "verasto", ico: "06116159", name: "VERASTO s.r.o." },
  // IČOs below resolved 2026-07-18 via official ARES name search (see ares-search artifacts).
  { slug: "zenx-capital", ico: "09289127", name: "ZenX Capital, a.s." },
  { slug: "5326g", ico: "19540051", name: "5326G s.r.o." },
];

/** Non-registry targets. */
const TARGETS = [];

for (const e of ENTITIES) {
  TARGETS.push({
    tag: "ares-basic", entity: e.slug, sourceId: "SRC-12",
    url: `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${e.ico}`,
    kind: "structured-record", mime: "application/json", pubClass: "OFFICIAL_PUBLIC",
    headers: { accept: "application/json" },
  });
  TARGETS.push({
    tag: "ares-vr", entity: e.slug, sourceId: "SRC-12",
    url: `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/${e.ico}`,
    kind: "structured-record", mime: "application/json", pubClass: "OFFICIAL_PUBLIC",
    headers: { accept: "application/json" },
  });
}

// Resolve missing IČOs by official ARES name search (POST).
const SEARCHES = [
  { tag: "ares-search", entity: "zenx-capital", body: { obchodniJmeno: "ZenX Capital" } },
  { tag: "ares-search", entity: "5326g", body: { obchodniJmeno: "5326G" } },
];

// First-party pages (subject authorized this DD on the record, 2026-07-17).
for (const [entity, url] of [
  ["able-cz-home", "https://www.able.cz/"],
  ["able-cz-en", "https://www.able.cz/en/"],
  ["able-cz-gdpr", "https://www.able.cz/legal/gdpr"],
]) {
  TARGETS.push({ tag: "web-snapshot", entity, sourceId: entity === "able-cz-gdpr" ? "SRC-01" : "SRC-02", url, kind: "web-page", mime: "text/html", pubClass: "FIRST_PARTY" });
}

// Technical observations (official/open endpoints).
TARGETS.push({ tag: "dns", entity: "able-cz-dns-a", sourceId: "SRC-07", url: "https://dns.google/resolve?name=able.cz&type=A", kind: "structured-record", mime: "application/json", pubClass: "OFFICIAL_PUBLIC" });
TARGETS.push({ tag: "dns", entity: "able-cz-dns-mx", sourceId: "SRC-07", url: "https://dns.google/resolve?name=able.cz&type=MX", kind: "structured-record", mime: "application/json", pubClass: "OFFICIAL_PUBLIC" });
TARGETS.push({ tag: "dns", entity: "able-cz-dns-ns", sourceId: "SRC-07", url: "https://dns.google/resolve?name=able.cz&type=NS", kind: "structured-record", mime: "application/json", pubClass: "OFFICIAL_PUBLIC" });
TARGETS.push({ tag: "ct", entity: "able-cz-crtsh", sourceId: "SRC-09", url: "https://crt.sh/?q=able.cz&output=json", kind: "structured-record", mime: "application/json", pubClass: "OFFICIAL_PUBLIC" });
TARGETS.push({ tag: "vies", entity: "able-cz-vies", sourceId: "SRC-08", url: "https://ec.europa.eu/taxation_customs/vies/rest-api/ms/CZ/vat/24278815", kind: "structured-record", mime: "application/json", pubClass: "OFFICIAL_PUBLIC" });

// Public contracts: registr smluv (ISRS) party search by IČO. The /api/v2
// endpoints return 404 (probed 2026-07-18); the server-rendered search page
// works and is itself the official register output, so it is preserved.
TARGETS.push({ tag: "registr-smluv", entity: "able-cz-contracts", sourceId: "SRC-20", url: "https://smlouvy.gov.cz/vyhledavani?vyhledavani%5Bsmluvni_strana%5D%5Bico%5D=24278815", kind: "web-page", mime: "text/html", pubClass: "OFFICIAL_PUBLIC" });
TARGETS.push({ tag: "registr-smluv", entity: "blackfish-contracts", sourceId: "SRC-20", url: "https://smlouvy.gov.cz/vyhledavani?vyhledavani%5Bsmluvni_strana%5D%5Bico%5D=06526411", kind: "web-page", mime: "text/html", pubClass: "OFFICIAL_PUBLIC" });

// Media pages: hash + headers only (copyrighted; this repo is public).
TARGETS.push({ tag: "media", entity: "forbes-blackfish", sourceId: "SRC-04", url: "https://forbes.cz/vyvojar-able-ziskava-studio-blackfish-firmam-planuji-radit-jak-vyuzit-umelou-inteligenci-v-byznysu/", kind: "web-page", mime: "text/html", pubClass: "METADATA_ONLY" });
TARGETS.push({ tag: "media", entity: "cc-blackfish", sourceId: "SRC-05", url: "https://cc.cz/desetimilionove-presuny-na-trhu-agentur-able-kupuje-blackfish-chteji-slapat-na-paty-strv/", kind: "web-page", mime: "text/html", pubClass: "METADATA_ONLY" });
TARGETS.push({ tag: "media", entity: "cc-blackfish-dansko-2021", sourceId: "SRC-13", url: "https://cc.cz/2021/03/cesti-blackfish-dobyvaji-dansko-tamnimu-startupu-pomohli-k-investici-73-milionu-dolaru/", kind: "web-page", mime: "text/html", pubClass: "METADATA_ONLY" });

// Insolvency: ISIR subject search (lustrace). The landing page answers 200 but
// the lustrace endpoint returns HTTP 500 (2026-07-17 and again 2026-07-18) —
// recorded as a provider failure, i.e. BLOCKED, never NOT_FOUND.
TARGETS.push({ tag: "isir", entity: "able-cz-isir", sourceId: "SRC-21", url: "https://isir.justice.cz/isir/ucastnik/vysledek_lustrace.do?ic=24278815&aktualnost=AKTUALNI_I_UKONCENA", kind: "web-page", mime: "text/html", pubClass: "OFFICIAL_PUBLIC" });

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/* Idempotence: a (sha256, originalUrl) pair already in the manifest is not
 * appended again; an unchanged remote yields no duplicate rows. A changed
 * remote (new hash for the same URL) becomes a new manifest row — a new
 * artifact version — and the old row is never touched. */
import { readFileSync } from "node:fs";
const seen = new Set();
try {
  for (const line of readFileSync(MANIFEST, "utf8").trim().split("\n")) {
    const m = JSON.parse(line);
    seen.add(m.sha256 + " " + m.originalUrl);
  }
} catch { /* no manifest yet */ }

function appendNdjson(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(obj) + "\n");
}

async function fetchOne(t, i) {
  const runId = `${runBatch}-${String(i + 1).padStart(3, "0")}`;
  const started = new Date().toISOString();
  const run = { runId, batch: runBatch, tag: t.tag, entity: t.entity, sourceId: t.sourceId || null, url: t.url, method: t.body ? "POST" : "GET", startedAt: started, ua: UA };
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 45000);
    const res = await fetch(t.url, {
      method: t.body ? "POST" : "GET",
      headers: { "user-agent": UA, ...(t.headers || {}), ...(t.body ? { "content-type": "application/json" } : {}) },
      body: t.body ? JSON.stringify(t.body) : undefined,
      signal: ctl.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    const buf = Buffer.from(await res.arrayBuffer());
    const hash = sha256(buf);
    run.httpStatus = res.status;
    run.finalUrl = res.url;
    run.contentType = res.headers.get("content-type");
    run.bytes = buf.length;
    run.sha256 = hash;
    run.finishedAt = new Date().toISOString();
    if (!res.ok) {
      run.outcome = res.status >= 500 ? "provider_error" : "http_error";
      appendNdjson(RUNS, run);
      return { t, run };
    }
    run.outcome = "ok";
    if (t.pubClass !== "METADATA_ONLY" && !(t.note === "availability probe only")) {
      const p2 = hash.slice(0, 2);
      const dir = join(ART, "sha256", p2);
      mkdirSync(dir, { recursive: true });
      const path = join(dir, hash);
      if (!existsSync(path)) writeFileSync(path, buf);
      run.stored = `artifacts/sha256/${p2}/${hash}`;
      if (!seen.has(hash + " " + t.url)) appendNdjson(MANIFEST, {
        artifactId: `ART-${hash.slice(0, 12)}`,
        sha256: hash,
        bytes: buf.length,
        mime: (res.headers.get("content-type") || t.mime).split(";")[0],
        storagePath: run.stored,
        originalUrl: t.url,
        finalUrl: res.url,
        retrievedAt: run.finishedAt,
        httpStatus: res.status,
        providerRunId: runId,
        sourceId: t.sourceId || null,
        entity: t.entity,
        tag: t.tag,
        pubClass: t.pubClass,
      });
    } else {
      run.stored = null;
      run.storageNote = t.pubClass === "METADATA_ONLY"
        ? "body hashed but not stored: copyrighted third-party content; repo is public"
        : "availability probe; body not stored";
    }
    appendNdjson(RUNS, run);
    return { t, run, buf };
  } catch (err) {
    run.outcome = "fetch_failed";
    run.error = String(err && err.message || err);
    run.finishedAt = new Date().toISOString();
    appendNdjson(RUNS, run);
    return { t, run };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const targets = TARGETS.filter((t) => !onlyTag || t.tag === onlyTag);
  const searches = SEARCHES.filter((s) => !onlyTag || s.tag === onlyTag);
  const results = [];
  let i = 0;
  for (const s of searches) {
    const t = {
      tag: s.tag, entity: s.entity, sourceId: "SRC-12",
      url: "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/vyhledat",
      body: { ...s.body, pocet: 10 },
      kind: "structured-record", mime: "application/json", pubClass: "OFFICIAL_PUBLIC",
      headers: { accept: "application/json" },
    };
    results.push(await fetchOne(t, i++));
    await sleep(400);
  }
  for (const t of targets) {
    results.push(await fetchOne(t, i++));
    await sleep(400);
  }
  // LinkedIn is intentionally NOT fetched: automated retrieval prohibited by terms.
  appendNdjson(RUNS, {
    runId: `${runBatch}-skip-linkedin`, batch: runBatch, tag: "blocked", entity: "linkedin-faraga",
    sourceId: "SRC-06", url: "https://cz.linkedin.com/in/vaclavfaraga/en", method: "NONE",
    outcome: "blocked_terms", note: "LinkedIn user agreement prohibits automated retrieval; not fetched. Facts sourced to SRC-06 remain self/media-reported.",
    startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
  });
  const summary = results.map(({ t, run }) => ({ tag: t.tag, entity: t.entity, outcome: run.outcome, http: run.httpStatus || null, bytes: run.bytes || 0, sha256: run.sha256 ? run.sha256.slice(0, 12) : null, stored: run.stored || null }));
  console.log(JSON.stringify({ batch: runBatch, total: results.length, ok: summary.filter((s) => s.outcome === "ok").length, summary }, null, 2));
}

main();
