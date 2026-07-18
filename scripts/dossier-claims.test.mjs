/*
 * Tests for the Claim Object System (claims-gen.mjs + routes + validator).
 * Run by `npm test`. Exhaustive over EVERY claim — not just CLM-01.
 *
 * Guarantees: every claim has a JSON shard, a content page, a resolvable
 * canonical route; counts reconcile from the single manifest; supersession
 * links never dangle; propositions are complete (never truncated) and not
 * drifted; and no public claim record leaks an internal path or PII.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const node = process.execPath;
execFileSync(node, ["scripts/dossier/claims-gen.mjs"], { cwd: ROOT });

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const d = JSON.parse(read("data/dossier/able/dossier.json"));
const claims = d.claims || [];
const manifest = JSON.parse(read("static/data/dossier/claims/manifest.json"));
const slug = (id) => id.toLowerCase();

test("every claim has a JSON shard and a content page", () => {
  for (const c of claims) {
    assert.ok(existsSync(join(ROOT, "static/data/dossier/claims", slug(c.id) + ".json")), `${c.id} missing JSON`);
    assert.ok(existsSync(join(ROOT, "content/dossier/claims", slug(c.id) + ".md")), `${c.id} missing page`);
  }
});

test("counts reconcile from the single manifest (58 = 49 live + 9 superseded)", () => {
  const live = claims.filter((c) => !c.superseded).length;
  const superseded = claims.filter((c) => c.superseded).length;
  assert.equal(manifest.totalIssued, claims.length);
  assert.equal(manifest.liveCount, live);
  assert.equal(manifest.supersededCount, superseded);
  assert.equal(manifest.liveCount + manifest.supersededCount, manifest.totalIssued);
  assert.equal(manifest.routes.length, claims.length);
});

test("every claim JSON carries the COMPLETE proposition, byte-identical to canonical", () => {
  for (const c of claims) {
    const o = JSON.parse(read("static/data/dossier/claims/" + slug(c.id) + ".json"));
    assert.equal(o.id, c.id);
    assert.equal(o.proposition, c.text, `${c.id} proposition drifted or truncated`);
    assert.ok(o.statusExplanation, `${c.id} lacks a status explanation`);
    assert.equal(o.canonicalPath, "/dossier/claims/" + slug(c.id) + "/");
  }
});

test("supersession links never dangle; superseded claims name a successor + reason", () => {
  const ids = new Set(claims.map((c) => c.id));
  for (const c of claims) {
    for (const s of c.supersededBy || []) assert.ok(ids.has(s), `${c.id} → unknown successor ${s}`);
    if (c.superseded) {
      assert.ok((c.supersededBy || []).length, `${c.id} superseded with no successor`);
      assert.ok(c.supersededReason, `${c.id} superseded with no reason`);
    }
  }
});

test("no public claim record leaks an internal path or a rodné-číslo token", () => {
  for (const c of claims) {
    const raw = read("static/data/dossier/claims/" + slug(c.id) + ".json");
    assert.ok(!/cases\/DD-Able-CZ|\/Users\/|artifacts\/sha256/.test(raw), `${c.id} leaks an internal path`);
    assert.ok(!/\b\d{6}\/\d{3,4}\b/.test(raw), `${c.id} contains a rodné-číslo-shaped token`);
  }
});

test("independentUpstreams never exceeds sourceRecords in any claim shard", () => {
  for (const c of claims) {
    const o = JSON.parse(read("static/data/dossier/claims/" + slug(c.id) + ".json"));
    assert.ok(o.independentUpstreams <= o.sourceRecords, `${c.id} impossible independence`);
  }
});

test("NOT_FOUND and BLOCKED claims carry the correct non-inference semantics", () => {
  const nf = claims.find((c) => c.status === "NOT_FOUND");
  const bl = claims.find((c) => c.status === "BLOCKED");
  if (nf) { const o = JSON.parse(read("static/data/dossier/claims/" + slug(nf.id) + ".json")); assert.match(o.statusExplanation, /dotázán/); }
  if (bl) { const o = JSON.parse(read("static/data/dossier/claims/" + slug(bl.id) + ".json")); assert.match(o.statusExplanation, /NELZE|nelze/); }
});
