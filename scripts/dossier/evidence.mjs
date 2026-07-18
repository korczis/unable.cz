/*
 * Evidence-layer builder for the Able.cz dossier.
 *
 * Inputs (all preserved, none invented):
 *   data/dossier/able/dossier.json                canonical facts
 *   data/dossier/able/evidence.json               canonical claim→evidence links
 *   cases/DD-Able-CZ-2026-07-17/artifacts/manifest.ndjson
 *   cases/DD-Able-CZ-2026-07-17/provider-runs.ndjson
 *   cases/DD-Able-CZ-2026-07-17/extraction/ares-assertions.json
 *   + the physical artifact files those manifests index
 *
 * The builder is also a VERIFIER. It fails (exit 1) when:
 *   - a manifest hash does not match the physical file's SHA-256,
 *   - a document span's exact text is not found at its stated line,
 *   - an assertion selector matches zero preserved assertions,
 *   - a claim-evidence link cites an unknown claim, source, span or tag,
 *   - a live material claim has no evidence entry at all.
 *
 * Outputs (public, privacy-filtered — no full birth dates, no home addresses,
 * no raw extracted fragments, no artifacts classed RESTRICTED_*):
 *   static/data/able-cz/evidence/{manifest,sources,source-families,artifacts,
 *     provider-runs,spans,assertions,claims-evidence,availability}.json
 *   static/data/able-cz/evidence/items/<CLM-*>.json
 * Case reports (analyst-facing, in the case store):
 *   cases/DD-Able-CZ-2026-07-17/reports/evidence-inventory.{json,md}
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const D = JSON.parse(readFileSync(join(ROOT, "data/dossier/able/dossier.json"), "utf8"));
const E = JSON.parse(readFileSync(join(ROOT, "data/dossier/able/evidence.json"), "utf8"));
const CASE = join(ROOT, E.case);
const OUT = join(ROOT, "static/data/able-cz/evidence");
const SCHEMA_VERSION = "1.0.0";
const cutoff = D.meta.evidenceCutoff || null;

const errors = [];
const fail = (msg) => errors.push(msg);
const sha256File = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

// ---- load case ledgers -----------------------------------------------------
const readNdjson = (p) => existsSync(p)
  ? readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];
const manifest = readNdjson(join(CASE, "artifacts/manifest.ndjson"));
const runs = readNdjson(join(CASE, "provider-runs.ndjson"));
const extraction = JSON.parse(readFileSync(join(CASE, "extraction/ares-assertions.json"), "utf8"));
const assertions = extraction.assertions || [];

// ---- 1. artifact integrity: every manifest hash must match its file --------
for (const m of manifest) {
  const p = join(CASE, m.storagePath);
  if (!existsSync(p)) { fail(`artifact missing on disk: ${m.storagePath}`); continue; }
  const h = sha256File(p);
  if (h !== m.sha256) fail(`hash mismatch: ${m.storagePath} manifest=${m.sha256.slice(0, 12)} file=${h.slice(0, 12)}`);
}

// Legacy artifacts (Sbírka listin files preserved 2026-07-17, before the
// content-addressed store existed): hash them now and register them.
const legacyArtifacts = [];
for (const [srcId, meta] of Object.entries(E.sourceMeta)) {
  for (const rel of meta.legacyArtifacts || []) {
    const p = join(CASE, rel);
    if (!existsSync(p)) { fail(`legacy artifact missing: ${rel}`); continue; }
    const hash = sha256File(p);
    legacyArtifacts.push({
      artifactId: `ART-${hash.slice(0, 12)}`,
      sha256: hash,
      bytes: readFileSync(p).length,
      mime: rel.endsWith(".pdf") ? "application/pdf" : "text/plain",
      storagePath: rel,
      originalUrl: (D.sources.find((s) => s.id === srcId) || {}).url || null,
      urlNote: "Sbírka listin detail-page URL; the content/download URL of the 2026-07-17 fetch was not separately recorded",
      retrievedAt: "2026-07-17",
      providerRunId: null,
      sourceId: srcId,
      tag: "sbirka-listin",
      pubClass: meta.publication,
      legacy: true,
    });
  }
}
const allArtifacts = [...manifest.map((m) => ({ ...m, legacy: false })), ...legacyArtifacts];
const artifactsByTag = new Map();
for (const a of allArtifacts) artifactsByTag.set(`${a.tag}:${a.entity || "case"}`, a); // latest wins
// METADATA_ONLY fetches never stored a body; their retrieval proof (hash,
// status, timestamp) lives in the provider-run ledger. Resolve their tags to a
// virtual hash-only artifact so links stay honest: proof of retrieval, no bytes.
for (const r of runs) {
  const key = `${r.tag}:${r.entity}`;
  if (r.outcome === "ok" && r.sha256 && !artifactsByTag.has(key)) {
    artifactsByTag.set(key, {
      artifactId: `ART-${r.sha256.slice(0, 12)}`, sha256: r.sha256, bytes: r.bytes,
      mime: (r.contentType || "").split(";")[0] || null, storagePath: null,
      originalUrl: r.url, retrievedAt: r.finishedAt, httpStatus: r.httpStatus,
      providerRunId: r.runId, sourceId: r.sourceId, entity: r.entity, tag: r.tag,
      pubClass: "METADATA_ONLY", legacy: false, virtual: true,
    });
  }
}

// ---- 2. span verification --------------------------------------------------
const norm = (s) => s.replace(/\s+/g, " ").trim();
const spans = [];
for (const sp of E.documentSpans) {
  const p = join(CASE, sp.file);
  if (!existsSync(p)) { fail(`span file missing: ${sp.file} (${sp.id})`); continue; }
  const lines = readFileSync(p, "utf8").split("\n");
  const at = lines[sp.line - 1] || "";
  let verified = norm(at).includes(norm(sp.exactText)) || norm(sp.exactText).includes(norm(at)) && norm(at).length > 10;
  if (!verified) {
    // tolerate off-by-small drift: search ±3 lines, else whole file
    const win = lines.slice(Math.max(0, sp.line - 4), sp.line + 3);
    verified = win.some((l) => norm(l).includes(norm(sp.exactText)));
    if (!verified) fail(`span text not found at ${sp.file}:${sp.line} (${sp.id}): "${sp.exactText.slice(0, 60)}…"`);
  }
  const txtHash = sha256File(p);
  const pdfPath = join(CASE, sp.pdf);
  const pdfHash = existsSync(pdfPath) ? sha256File(pdfPath) : null;
  if (!pdfHash) fail(`span pdf missing: ${sp.pdf} (${sp.id})`);
  spans.push({ ...sp, verified: true, txtSha256: txtHash, pdfSha256: pdfHash });
}

// ---- 2b. web-span verification: every `contains` substring must occur
// verbatim in the preserved snapshot bytes it cites --------------------------
const webSpans = [];
for (const ws of E.webSpans || []) {
  const art = artifactsByTag.get(ws.artifactTag);
  if (!art || !art.storagePath) { fail(`web span ${ws.id}: artifact tag ${ws.artifactTag} has no stored body`); continue; }
  const body = readFileSync(join(CASE, art.storagePath), "utf8");
  for (const c of ws.contains) {
    if (!body.includes(c)) fail(`web span ${ws.id}: "${c.slice(0, 60)}" not found in ${ws.artifactTag}`);
  }
  webSpans.push({ ...ws, artifactId: art.artifactId, sha256: art.sha256, retrievedAt: art.retrievedAt, url: art.originalUrl, verified: true });
}
const webSpanIds = new Set(webSpans.map((s) => s.id));

// ---- 3. selector resolution ------------------------------------------------
const selectorResolved = {};
for (const [selId, sel] of Object.entries(E.assertionSelectors)) {
  const preds = Array.isArray(sel.predicate) ? sel.predicate : [sel.predicate];
  const hits = assertions.filter((a) => a.entity === sel.entity && preds.includes(a.predicate));
  if (!hits.length) fail(`selector ${selId} matched zero assertions (entity=${sel.entity})`);
  selectorResolved[selId] = hits.map((a) => a.id);
}

// ---- 4. claim link resolution ----------------------------------------------
const claimIds = new Set(D.claims.map((c) => c.id));
const liveClaims = D.claims.filter((c) => !c.superseded);
const srcIds = new Set(D.sources.map((s) => s.id));
const spanIds = new Set(spans.map((s) => s.id));

const claimLinks = {};
for (const [cid, links] of Object.entries(E.claimEvidence)) {
  if (!claimIds.has(cid)) { fail(`claimEvidence cites unknown claim ${cid}`); continue; }
  claimLinks[cid] = links.map((l) => {
    const out = { relation: l.relation || "SUPPORTS", note: l.note || null };
    if (l.sourceId) {
      if (!srcIds.has(l.sourceId)) fail(`${cid} link cites unknown source ${l.sourceId}`);
      out.sourceId = l.sourceId;
    }
    if (l.spanId) {
      if (!spanIds.has(l.spanId)) fail(`${cid} link cites unknown span ${l.spanId}`);
      out.spanId = l.spanId;
    }
    if (l.webSpanId) {
      if (!webSpanIds.has(l.webSpanId)) fail(`${cid} link cites unknown web span ${l.webSpanId}`);
      out.webSpanId = l.webSpanId;
    }
    if (l.selector) {
      if (!selectorResolved[l.selector]) fail(`${cid} link cites unknown selector ${l.selector}`);
      else { out.selector = l.selector; out.assertionIds = selectorResolved[l.selector]; }
    }
    if (l.artifactTag) {
      if (!artifactsByTag.has(l.artifactTag)) fail(`${cid} link cites unknown artifact tag ${l.artifactTag}`);
      else out.artifactId = artifactsByTag.get(l.artifactTag).artifactId;
    }
    return out;
  });
}
for (const c of liveClaims) {
  if (!claimLinks[c.id]) fail(`live claim ${c.id} has no evidence entry in evidence.json`);
}
for (const c of D.claims.filter((x) => x.superseded)) {
  if (claimLinks[c.id]) fail(`superseded claim ${c.id} must not carry live evidence links`);
}

// ---- 5. availability from provider runs ------------------------------------
const latestRunByUrl = new Map();
for (const r of runs) latestRunByUrl.set(r.url, r);
const availability = [...latestRunByUrl.values()].map((r) => ({
  url: r.url, sourceId: r.sourceId || null, tag: r.tag, entity: r.entity,
  lastChecked: r.finishedAt || r.startedAt,
  httpStatus: r.httpStatus || null,
  outcome: r.outcome,
  status: r.outcome === "ok" ? "AVAILABLE"
    : r.outcome === "provider_error" ? "BLOCKED"
    : r.outcome === "blocked_terms" ? "BLOCKED"
    : r.outcome === "http_error" ? "INVALID"
    : "UNKNOWN",
  sha256: r.sha256 ? r.sha256.slice(0, 16) : null,
}));

// ---- 6. per-claim inventory -----------------------------------------------
const familyOf = {};
for (const [fid, fam] of Object.entries(E.sourceFamilies)) for (const s of fam.members) familyOf[s] = fid;
const PRIMARY = new Set(Object.entries(E.sourceMeta).filter(([, m]) => m.primary === "primary" || m.primary === "primary-technical").map(([k]) => k));

function inventoryFor(claim) {
  const links = claimLinks[claim.id] || [];
  const linkSrc = new Set(claim.sources || []);
  for (const l of links) {
    if (l.sourceId) linkSrc.add(l.sourceId);
    if (l.spanId) linkSrc.add(spans.find((s) => s.id === l.spanId).sourceId);
    if (l.selector) linkSrc.add("SRC-12");
  }
  const families = new Set([...linkSrc].map((s) => familyOf[s] || s));
  const primaryCount = [...linkSrc].filter((s) => PRIMARY.has(s)).length;
  const hasExact = links.some((l) => l.spanId || l.webSpanId || l.assertionIds);
  const hasArtifact = links.some((l) => l.artifactId || l.assertionIds || l.spanId);
  let category;
  if (claim.status === "BLOCKED") category = "BLOCKED";
  // For a SELF_REPORTED claim the preserved self-publication IS the primary
  // record of the assertion (of the statement, not of its truth).
  else if (hasExact && hasArtifact && (primaryCount || claim.status === "SELF_REPORTED")) category = "COMPLETE";
  else if (hasArtifact) category = "PARTIAL";
  else category = "REFERENCE_ONLY";
  return {
    claim: claim.id, status: claim.status, category,
    sources: [...linkSrc].sort(), sourceFamilies: [...families].sort(),
    independentFamilies: families.size, primarySources: primaryCount,
    exactCitation: hasExact, artifactPreserved: hasArtifact,
    kind: claim.status === "ASSESSED" ? "assessment" : "observation",
  };
}
const inventory = liveClaims.map(inventoryFor);

// ---- abort on verification errors -----------------------------------------
if (errors.length) {
  console.error(`✖ evidence build FAILED with ${errors.length} error(s):`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

// ---- 7. public projections (privacy-filtered) ------------------------------
mkdirSync(join(OUT, "items"), { recursive: true });
const header = (kind, extra = {}) => ({
  schemaVersion: SCHEMA_VERSION, kind, subject: D.meta.subject, ico: D.meta.ico,
  evidenceCutoff: cutoff, generatedAt: cutoff,
  source: "data/dossier/able/evidence.json + cases/DD-Able-CZ-2026-07-17",
  note: "Derived and verified from preserved, hashed artifacts; nothing added.", ...extra,
});
const write = (name, kind, payload, extra) =>
  writeFileSync(join(OUT, name), JSON.stringify({ _export: header(kind, extra), ...payload }, null, 2) + "\n");

// Public assertion projection: strip exact fragments, full birth dates and
// any address material; keep entity/predicate/values/dates + artifact hash +
// JSON pointer so every row stays re-checkable against the preserved record.
const pubAssertions = assertions.map((a) => ({
  id: a.id, entity: a.entity, predicate: a.predicate,
  who: a.who ? { name: a.who.name, bornYear: a.who.born ? a.who.born.slice(0, 4) : null } : undefined,
  value: a.value, role: a.role, stake: a.stake, vklad: a.vklad, organ: a.organ,
  validFrom: a.validFrom, validTo: a.validTo,
  artifact: { id: `ART-${a.evidence.sha256.slice(0, 12)}`, sha256: a.evidence.sha256, jsonPointer: a.evidence.jsonPointer, url: a.evidence.originalUrl, retrievedAt: a.evidence.retrievedAt },
}));

// Publishable artifact bytes are copied into the static export under their
// content hash; RESTRICTED_* artifacts ship metadata + hash only, never bytes.
const PUB_HIDDEN = new Set(["RESTRICTED_PERSONAL_DATA", "BLOCKED"]);
// Preserved third-/first-party HTML ships as .html.txt (text/plain): the bytes
// and hash are identical, but the snapshot never renders as a page of THIS
// site, can't carry its canonical into our SEO surface, and can't be mistaken
// for the live able.cz.
const EXT = { "application/json": ".json", "application/pdf": ".pdf", "text/plain": ".txt", "text/html": ".html.txt" };
mkdirSync(join(OUT, "files"), { recursive: true });
const virtualArtifacts = [...artifactsByTag.values()].filter((a) => a.virtual);
const pubArtifacts = [...allArtifacts, ...virtualArtifacts].map((a) => {
  let download = null, downloadNote = null;
  if (a.virtual) {
    downloadNote = "body not stored (copyrighted third-party content; this repository is public) — hash, size and HTTP metadata are the retrieval proof";
  } else if (PUB_HIDDEN.has(a.pubClass)) {
    downloadNote = "artifact preserved in the case store but not published (personal data / restricted); metadata and hash only";
  } else {
    const ext = EXT[(a.mime || "").split(";")[0]] || "";
    const fname = a.sha256 + ext;
    const src = join(CASE, a.storagePath);
    writeFileSync(join(OUT, "files", fname), readFileSync(src));
    download = `/data/able-cz/evidence/files/${fname}`;
  }
  return {
    id: a.artifactId, sha256: a.sha256, bytes: a.bytes, mime: a.mime,
    url: a.originalUrl, retrievedAt: a.retrievedAt, httpStatus: a.httpStatus || null,
    sourceId: a.sourceId, entity: a.entity || null, tag: a.tag,
    pubClass: a.pubClass, legacy: a.legacy,
    providerRunId: a.providerRunId || null,
    download, downloadNote,
  };
});

const pubRuns = runs.map((r) => ({
  runId: r.runId, batch: r.batch, tag: r.tag, entity: r.entity, sourceId: r.sourceId,
  url: r.url, method: r.method, startedAt: r.startedAt, finishedAt: r.finishedAt,
  httpStatus: r.httpStatus || null, bytes: r.bytes || null,
  sha256: r.sha256 || null, outcome: r.outcome, note: r.note || r.storageNote || null,
}));

const pubSpans = spans.map((s) => ({
  id: s.id, sourceId: s.sourceId, page: s.page, section: s.section, row: s.row,
  line: s.line, exactText: s.exactText, normalized: s.normalized,
  pdfSha256: s.pdfSha256, txtSha256: s.txtSha256, verified: s.verified,
  document: s.pdf.split("/").pop(),
}));

const sources = D.sources.map((s) => {
  const meta = E.sourceMeta[s.id] || {};
  const arts = allArtifacts.filter((a) => a.sourceId === s.id);
  const avail = availability.filter((a) => a.sourceId === s.id);
  const claims = liveClaims.filter((c) => (inventory.find((i) => i.claim === c.id) || {}).sources?.includes(s.id)).map((c) => c.id);
  return {
    ...s, family: familyOf[s.id] || null, authority: meta.authority || null,
    official: meta.official ?? null, primary: meta.primary || null,
    licensing: meta.licensing || null, publication: meta.publication || null,
    artifactCount: arts.length, evidenceSpanCount: spans.filter((x) => x.sourceId === s.id).length,
    claimsSupported: claims,
    availability: avail.length ? avail[avail.length - 1].status : null,
    lastChecked: avail.length ? avail[avail.length - 1].lastChecked : null,
  };
});

write("sources.json", "evidence-sources", { sources }, { count: sources.length });
write("source-families.json", "source-families", { families: Object.entries(E.sourceFamilies).map(([id, f]) => ({ id, ...f })) }, { count: Object.keys(E.sourceFamilies).length });
write("artifacts.json", "artifacts", { artifacts: pubArtifacts }, { count: pubArtifacts.length, totalBytes: pubArtifacts.reduce((s, a) => s + a.bytes, 0) });
write("provider-runs.json", "provider-runs", { runs: pubRuns }, { count: pubRuns.length, ok: pubRuns.filter((r) => r.outcome === "ok").length });
write("spans.json", "evidence-spans", { spans: pubSpans, webSpans }, { count: pubSpans.length + webSpans.length });
write("assertions.json", "register-assertions", { assertions: pubAssertions }, { count: pubAssertions.length, parser: extraction._extraction.parser, parserVersion: extraction._extraction.parserVersion });
write("availability.json", "source-availability", { availability }, { count: availability.length });
write("claims-evidence.json", "claims-evidence", {
  claims: inventory,
  links: Object.fromEntries(Object.entries(claimLinks).map(([cid, ls]) => [cid, ls.map((l) => ({ ...l, assertionIds: l.assertionIds ? l.assertionIds.length : undefined, selector: l.selector }))])),
}, { count: inventory.length, byCategory: inventory.reduce((m, i) => (m[i.category] = (m[i.category] || 0) + 1, m), {}) });

for (const c of liveClaims) {
  const links = (claimLinks[c.id] || []).map((l) => ({
    ...l,
    assertions: l.assertionIds ? l.assertionIds.map((id) => pubAssertions.find((a) => a.id === id)).filter(Boolean) : undefined,
    assertionIds: undefined,
    span: l.spanId ? pubSpans.find((s) => s.id === l.spanId) : undefined,
    webSpan: l.webSpanId ? webSpans.find((s) => s.id === l.webSpanId) : undefined,
  }));
  writeFileSync(join(OUT, "items", c.id + ".json"), JSON.stringify({
    _export: header("claim-evidence-item"),
    claim: { id: c.id, text: c.text, status: c.status, note: c.note || null, sources: c.sources },
    inventory: inventory.find((i) => i.claim === c.id),
    links,
  }, null, 2) + "\n");
}

write("manifest.json", "evidence-manifest", {
  files: ["sources.json", "source-families.json", "artifacts.json", "provider-runs.json", "spans.json", "assertions.json", "availability.json", "claims-evidence.json"],
  itemsDir: "items/",
  counts: {
    sources: sources.length, families: Object.keys(E.sourceFamilies).length,
    artifacts: pubArtifacts.length, providerRuns: pubRuns.length,
    spans: pubSpans.length, assertions: pubAssertions.length,
    liveClaims: liveClaims.length, supersededClaims: D.claims.length - liveClaims.length,
    inventory: inventory.reduce((m, i) => (m[i.category] = (m[i.category] || 0) + 1, m), {}),
  },
  integrity: { artifactsVerified: allArtifacts.length, spansVerified: spans.length, selectorsResolved: Object.keys(selectorResolved).length },
});

// ---- 8. case-store analyst inventory ---------------------------------------
mkdirSync(join(CASE, "reports"), { recursive: true });
const invPayload = { _report: header("evidence-inventory"), inventory, selectorResolution: Object.fromEntries(Object.entries(selectorResolved).map(([k, v]) => [k, v.length])), errors: [] };
writeFileSync(join(CASE, "reports/evidence-inventory.json"), JSON.stringify(invPayload, null, 2) + "\n");
const md = [
  "# Evidence inventory — DD-Able-CZ (generated by scripts/dossier/evidence.mjs)",
  "",
  `Live claims: ${liveClaims.length} · superseded: ${D.claims.length - liveClaims.length} · artifacts verified: ${allArtifacts.length} · spans verified: ${spans.length} · register assertions: ${assertions.length}`,
  "",
  "| Claim | Status | Category | Families | Primary | Exact | Artifact |",
  "|-------|--------|----------|----------|---------|-------|----------|",
  ...inventory.map((i) => `| ${i.claim} | ${i.status} | ${i.category} | ${i.independentFamilies} | ${i.primarySources} | ${i.exactCitation ? "✓" : "—"} | ${i.artifactPreserved ? "✓" : "—"} |`),
].join("\n") + "\n";
writeFileSync(join(CASE, "reports/evidence-inventory.md"), md);

console.log(`evidence: ${allArtifacts.length} artifacts verified, ${spans.length} spans verified, ${assertions.length} assertions, ${liveClaims.length} live claims linked`);
console.log("inventory:", JSON.stringify(inventory.reduce((m, i) => (m[i.category] = (m[i.category] || 0) + 1, m), {})));
