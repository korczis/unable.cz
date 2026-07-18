/*
 * Evidence-chain integrity tests: preserved artifacts, exact citations,
 * claim-evidence links, publication safety, and gate non-vacuity.
 * Run: node --test scripts/dossier-evidence-chain.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdtempSync, cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CASE = join(ROOT, "cases/DD-Able-CZ-2026-07-17");
const OUT = join(ROOT, "static/data/able-cz");
const node = process.execPath;

execFileSync(node, ["scripts/dossier/export.mjs"], { cwd: ROOT });
execFileSync(node, ["scripts/dossier/evidence.mjs"], { cwd: ROOT });

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const load = (p) => JSON.parse(readFileSync(join(OUT, p), "utf8"));
const D = JSON.parse(readFileSync(join(ROOT, "data/dossier/able/dossier.json"), "utf8"));
const E = JSON.parse(readFileSync(join(ROOT, "data/dossier/able/evidence.json"), "utf8"));
const manifest = readFileSync(join(CASE, "artifacts/manifest.ndjson"), "utf8").trim().split("\n").map(JSON.parse);

test("every manifested artifact exists and its SHA-256 matches the bytes", () => {
  assert.ok(manifest.length >= 40, "expected the full 2026-07-18 retrieval batch");
  for (const m of manifest) {
    const p = join(CASE, m.storagePath);
    assert.ok(existsSync(p), `${m.storagePath} missing`);
    assert.equal(sha256(readFileSync(p)), m.sha256, `${m.storagePath} hash drift`);
  }
});

test("artifact manifest is immutable-append: no duplicate (sha256, url) rows", () => {
  const seen = new Set();
  for (const m of manifest) {
    const k = m.sha256 + " " + m.originalUrl;
    assert.ok(!seen.has(k), `duplicate manifest row ${k.slice(0, 40)}`);
    seen.add(k);
  }
});

test("every exact document citation points at text that exists at its line", () => {
  for (const sp of E.documentSpans) {
    const lines = readFileSync(join(CASE, sp.file), "utf8").split("\n");
    const norm = (s) => s.replace(/\s+/g, " ").trim();
    const window = lines.slice(Math.max(0, sp.line - 4), sp.line + 3).map(norm).join("\n");
    assert.ok(window.includes(norm(sp.exactText)), `${sp.id}: text not near ${sp.file}:${sp.line}`);
  }
});

test("every web span's quoted substrings occur verbatim in the preserved snapshot", () => {
  const byTag = new Map(manifest.map((m) => [`${m.tag}:${m.entity}`, m]));
  for (const ws of E.webSpans) {
    const art = byTag.get(ws.artifactTag);
    assert.ok(art, `${ws.id}: artifact ${ws.artifactTag} missing`);
    const body = readFileSync(join(CASE, art.storagePath), "utf8");
    for (const c of ws.contains) assert.ok(body.includes(c), `${ws.id}: "${c.slice(0, 50)}" not in snapshot`);
  }
});

test("every assertion selector resolves to ≥1 machine-extracted assertion", () => {
  const A = JSON.parse(readFileSync(join(CASE, "extraction/ares-assertions.json"), "utf8")).assertions;
  for (const [id, sel] of Object.entries(E.assertionSelectors)) {
    const preds = Array.isArray(sel.predicate) ? sel.predicate : [sel.predicate];
    assert.ok(A.some((a) => a.entity === sel.entity && preds.includes(a.predicate)), `${id} matches nothing`);
  }
});

test("live claims all have evidence items; superseded claims are excluded and have live successors", () => {
  const live = D.claims.filter((c) => !c.superseded);
  const liveIds = new Set(live.map((c) => c.id));
  for (const c of live) {
    assert.ok(existsSync(join(OUT, "evidence/items", c.id + ".json")), `${c.id} has no item shard`);
  }
  const pubClaims = load("claims.json");
  for (const c of pubClaims.claims) assert.ok(!c.superseded, `${c.id} superseded but live in claims.json`);
  for (const c of D.claims.filter((x) => x.superseded)) {
    assert.ok(c.supersededBy && c.supersededBy.length, `${c.id} no successors`);
    for (const s of c.supersededBy) assert.ok(liveIds.has(s), `${c.id} → ${s} not live`);
  }
});

test("restricted artifacts are not downloadable; published downloads match their hash", () => {
  const arts = load("evidence/artifacts.json").artifacts;
  let published = 0;
  for (const a of arts) {
    if ((a.pubClass || "").startsWith("RESTRICTED")) assert.equal(a.download, null, `${a.id} restricted yet downloadable`);
    if (a.download) {
      const p = join(OUT, "evidence", a.download.replace("/data/able-cz/evidence/", ""));
      assert.ok(existsSync(p), `${a.download} missing`);
      assert.equal(sha256(readFileSync(p)), a.sha256, `${a.download} hash mismatch`);
      published++;
    }
  }
  assert.ok(published >= 40, "expected the ARES batch to be published");
  // The execution documents (personal data) must be metadata-only.
  const restricted = arts.filter((a) => a.pubClass === "RESTRICTED_PERSONAL_DATA");
  assert.ok(restricted.length >= 4, "SL69/SL70 pdf+txt must be registered as restricted");
});

test("public evidence exports leak no PII, no full birth dates, no local paths", () => {
  const files = ["manifest.json", "sources.json", "artifacts.json", "claims-evidence.json", "spans.json", "assertions.json", "provider-runs.json", "availability.json", "source-families.json"]
    .map((f) => join(OUT, "evidence", f))
    .concat(readdirSync(join(OUT, "evidence/items")).map((f) => join(OUT, "evidence/items", f)));
  for (const p of files) {
    const raw = readFileSync(p, "utf8");
    assert.ok(!/\b\d{6}\/\d{3,4}\b/.test(raw), `${p} rodné číslo shape`);
    assert.ok(!/"born"\s*:\s*"\d{4}-\d{2}-\d{2}"/.test(raw), `${p} full birth date`);
    assert.ok(!/\/Users\/|\/home\//.test(raw), `${p} filesystem path`);
  }
});

test("a BLOCKED provider failure is never presented as NOT_FOUND", () => {
  const runs = load("evidence/provider-runs.json").runs;
  // The landing-page availability probe answered 200; the subject search
  // (lustrace) — the query that matters — never did.
  const lustrace = runs.filter((r) => r.tag === "isir" && /lustrace/.test(r.url));
  assert.ok(lustrace.length >= 1, "ISIR lustrace attempts must be on the ledger");
  assert.ok(lustrace.every((r) => r.outcome !== "ok"), "ISIR lustrace never succeeded — if this fails, upgrade CLM-58");
  const clm58 = D.claims.find((c) => c.id === "CLM-58");
  assert.equal(clm58.status, "BLOCKED");
});

test("evidence gate is non-vacuous: corrupting a published artifact fails validate", () => {
  const tmp = mkdtempSync(join(tmpdir(), "able-evd-"));
  try {
    for (const dir of ["data", "static/data", "scripts", "cases"]) cpSync(join(ROOT, dir), join(tmp, dir), { recursive: true });
    const arts = JSON.parse(readFileSync(join(tmp, "static/data/able-cz/evidence/artifacts.json"), "utf8")).artifacts;
    const victim = arts.find((a) => a.download);
    const p = join(tmp, "static/data/able-cz/evidence", victim.download.replace("/data/able-cz/evidence/", ""));
    writeFileSync(p, readFileSync(p, "utf8") + "\n<!-- tampered -->");
    assert.throws(() => execFileSync(node, ["scripts/dossier/validate.mjs"], { cwd: tmp, stdio: "pipe" }));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("the claim inventory never claims an exact citation it cannot show", () => {
  const inv = load("evidence/claims-evidence.json");
  for (const row of inv.claims) {
    if (!row.exactCitation) continue;
    const item = JSON.parse(readFileSync(join(OUT, "evidence/items", row.claim + ".json"), "utf8"));
    const has = (item.links || []).some((l) => l.span || l.webSpan || (l.assertions && l.assertions.length));
    assert.ok(has, `${row.claim} marked exactCitation without a span/assertion in its item`);
  }
});
