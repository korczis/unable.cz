/*
 * Production snapshot proof (PROMPT-09 §45).
 *
 * Compares four layers and refuses to call production current unless they all
 * agree on snapshot id AND semantic content hash:
 *   canonical  — data/dossier/able/dossier.json, hashed right now,
 *   generated  — generated/dossier/snapshots/current.json (pipeline output),
 *   built      — public/data/dossier/snapshots/current.json (zola build output),
 *   deployed   — https://<base_url>/data/dossier/snapshots/current.json + the
 *                snapshot id/hash rendered into the production /dossier/ page.
 *
 * Writes reports/dossier-snapshot-proof.json; exit 1 on any disagreement.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { extractObjects, snapshotContentHash } from "./lib.mjs";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const baseUrl = (readFileSync(join(ROOT, "config.toml"), "utf8").match(/^base_url\s*=\s*"([^"]+)"/m) || [])[1];
if (!baseUrl) { console.error("config.toml base_url not found"); process.exit(1); }

const canonicalHash = snapshotContentHash(extractObjects(JSON.parse(readFileSync(join(ROOT, "data/dossier/able/dossier.json"), "utf8"))));
const layer = (p) => (existsSync(join(ROOT, p)) ? JSON.parse(readFileSync(join(ROOT, p), "utf8")) : null);
const generated = layer("generated/dossier/snapshots/current.json");
const built = layer("public/data/dossier/snapshots/current.json");

const fetchJson = (u) => fetch(u, { headers: { "user-agent": "unable.cz-snapshot-proof/1.0" } }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(u + " → HTTP " + r.status))));
const fetchText = (u) => fetch(u, { headers: { "user-agent": "unable.cz-snapshot-proof/1.0" } }).then((r) => (r.ok ? r.text() : Promise.reject(new Error(u + " → HTTP " + r.status))));

const deployed = await fetchJson(baseUrl + "/data/dossier/snapshots/current.json").catch((e) => ({ error: String(e) }));
const page = await fetchText(baseUrl + "/dossier/").catch((e) => "");
const pageId = (page.match(/id="dossier-snapshot-id"[^>]*>([^<]+)</) || [])[1]
  || (page.match(/data-content-hash="[0-9a-f]{64}"[^>]*>\s*([a-z0-9-]+)\s*</) || [])[1] || null;
const pageHash = (page.match(/data-content-hash="([0-9a-f]{64})"/) || [])[1] || null;

const proof = {
  proved_at: new Date().toISOString(),
  base_url: baseUrl,
  canonical_snapshot_id: generated?.snapshot_id ?? null,
  generated_snapshot_id: generated?.snapshot_id ?? null,
  built_snapshot_id: built?.snapshot_id ?? null,
  deployed_snapshot_id: deployed?.snapshot_id ?? null,
  deployed_page_snapshot_id: pageId,
  canonical_hash: canonicalHash,
  generated_hash: generated?.content_hash ?? null,
  built_hash: built?.content_hash ?? null,
  deployed_hash: deployed?.content_hash ?? null,
  deployed_page_hash: pageHash,
  object_count_match: null,
  validation_status: null,
  notes: [],
};

const ids = [proof.generated_snapshot_id, proof.built_snapshot_id, proof.deployed_snapshot_id, proof.deployed_page_snapshot_id];
const hashes = [proof.canonical_hash, proof.generated_hash, proof.built_hash, proof.deployed_hash, proof.deployed_page_hash];
const idsOk = ids.every((x) => x && x === ids[0]);
const hashesOk = hashes.every((x) => x && x === hashes[0]);

if (deployed?.snapshot_id) {
  const local = JSON.parse(readFileSync(join(ROOT, "static/data/dossier/snapshots", deployed.snapshot_id, "objects.json"), "utf8"));
  const remote = await fetchJson(baseUrl + "/data/dossier/snapshots/" + deployed.snapshot_id + "/objects.json").catch(() => null);
  proof.object_count_match = remote ? local.object_count === remote.object_count : false;
}

proof.validation_status = idsOk && hashesOk && proof.object_count_match ? "PROVEN" : "FAILED";
if (!idsOk) proof.notes.push("snapshot ids disagree: " + JSON.stringify(ids));
if (!hashesOk) proof.notes.push("content hashes disagree: " + JSON.stringify(hashes.map((h) => (h || "").slice(0, 12))));

mkdirSync(join(ROOT, "reports"), { recursive: true });
writeFileSync(join(ROOT, "reports/dossier-snapshot-proof.json"), JSON.stringify(proof, null, 2) + "\n");
console.log("Snapshot proof: " + proof.validation_status);
console.log("  id       " + (proof.deployed_snapshot_id || "—") + (idsOk ? " (all layers agree)" : " MISMATCH"));
console.log("  hash     " + (proof.deployed_hash || "—").slice(0, 16) + "…" + (hashesOk ? " (canonical=generated=built=deployed=page)" : " MISMATCH"));
console.log("  objects  " + (proof.object_count_match ? "match" : "MISMATCH/unknown"));
if (proof.validation_status !== "PROVEN") process.exit(1);
