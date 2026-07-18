/*
 * Tests for the address-first cadastral layer (cadastre.mjs) and its
 * publication gates in validate.mjs. Run by `npm test`.
 *
 * The load-bearing invariants: only the corporate registered office is
 * published (never a natural person), the address is parsed correctly, no
 * spatial field is invented (RÚIAN/parcel/ownership/coordinates stay null while
 * collected.* is false), and the gate actually fails on planted violations.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "static/data/able-cz");
const node = process.execPath;

execFileSync(node, ["scripts/dossier/export.mjs"], { cwd: ROOT });
execFileSync(node, ["scripts/dossier/derive.mjs"], { cwd: ROOT });
execFileSync(node, ["scripts/dossier/cadastre.mjs"], { cwd: ROOT });

const load = (n) => JSON.parse(readFileSync(join(OUT, n), "utf8"));

test("only the corporate registered office is published; no natural person", () => {
  const { addresses } = load("cadastre/addresses.json");
  assert.equal(addresses.length, 1);
  const a = addresses[0];
  assert.equal(a.publication, "public_with_context");
  assert.equal(a.ownerType, "legal_entity");
  const manifest = load("cadastre/manifest.json");
  assert.equal(manifest.naturalPersonAddressesPublished, 0);
});

test("the registered office parses into correct Czech components", () => {
  const a = load("cadastre/addresses.json").addresses[0];
  assert.equal(a.resolution, "exact");
  assert.equal(a.street, "Vlněna");
  assert.equal(a.cisloPopisne, "526");
  assert.equal(a.cisloOrientacni, "5");
  assert.equal(a.castObce, "Trnitá");
  assert.equal(a.psc, "602 00");
  assert.equal(a.obec, "Brno");
  assert.ok(a.sources.includes("SRC-03"), "must cite the register");
});

test("no spatial field is invented — RÚIAN/parcel/ownership/coordinates stay null", () => {
  const a = load("cadastre/addresses.json").addresses[0];
  assert.equal(a.ruianAddressPointId, null);
  assert.equal(a.coordinates, null);
  assert.equal(a.building, null);
  assert.deepEqual(a.parcels, []);
  assert.equal(a.ownership, null);
  for (const k of ["ruian", "geometry", "building", "parcel", "ownership", "title"]) {
    assert.equal(a.collected[k], false, `collected.${k} must be false (not collected this pass)`);
  }
});

test("cadastral gate FAILS on a planted natural-person address (non-vacuous)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "able-cad-np-"));
  try {
    cpSync(join(ROOT, "data"), join(tmp, "data"), { recursive: true });
    cpSync(join(ROOT, "static/data"), join(tmp, "static/data"), { recursive: true });
    cpSync(join(ROOT, "scripts"), join(tmp, "scripts"), { recursive: true });
    const p = join(tmp, "static/data/able-cz/cadastre/addresses.json");
    const j = JSON.parse(readFileSync(p, "utf8"));
    j.addresses.push({
      id: "address:able:planted-np",
      publication: "public_with_context",
      ownerType: "natural_person",
      resolution: "exact",
      sources: ["SRC-03"],
      collected: { ruian: false, geometry: false, parcel: false, ownership: false },
    });
    writeFileSync(p, JSON.stringify(j, null, 2));
    assert.throws(() => execFileSync(node, ["scripts/dossier/validate.mjs"], { cwd: tmp, stdio: "pipe" }));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("cadastral gate FAILS on invented coordinates (non-vacuous)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "able-cad-geo-"));
  try {
    cpSync(join(ROOT, "data"), join(tmp, "data"), { recursive: true });
    cpSync(join(ROOT, "static/data"), join(tmp, "static/data"), { recursive: true });
    cpSync(join(ROOT, "scripts"), join(tmp, "scripts"), { recursive: true });
    const p = join(tmp, "static/data/able-cz/cadastre/addresses.json");
    const j = JSON.parse(readFileSync(p, "utf8"));
    j.addresses[0].coordinates = { lat: 49.19, lon: 16.61 }; // planted, collected.geometry is false
    writeFileSync(p, JSON.stringify(j, null, 2));
    assert.throws(() => execFileSync(node, ["scripts/dossier/validate.mjs"], { cwd: tmp, stdio: "pipe" }));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
