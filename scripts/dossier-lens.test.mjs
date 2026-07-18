/*
 * Tests for the investigation-lens layer (lens.js + wiring). Run by `npm test`.
 *
 * A lens re-prioritises presentation without hiding data. These assert the
 * module is wired and that every section a lens references actually exists in
 * the template — so no lens can point at a missing section (a dead lens).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");

test("template loads the lens module", () => {
  assert.ok(/js\/lens\.js/.test(read("templates/dossier.html")), "lens.js is included");
});

test("lens never hides data (foregrounds via a class, filters the nav only)", () => {
  const js = read("scripts/dossier/lens.js");
  assert.ok(js.includes("lens-in"), "foregrounds sections via .lens-in");
  assert.ok(!/display\s*:\s*none/.test(js.replace(/lens-nav-hide[^;]*/g, "")), "does not display:none page sections (nav filter aside)");
  assert.ok(js.includes("=== true"), "boolean-coerces the toggle (no accidental flip)");
});

test("every section a lens references exists in the template", () => {
  const js = read("scripts/dossier/lens.js");
  const tpl = read("templates/dossier.html");
  // Extract the id lists from the RAW lens table.
  const idsInLenses = new Set();
  const re = /ids:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(js))) {
    (m[1].match(/"([a-z-]+-title)"/g) || []).forEach((q) => idsInLenses.add(q.replace(/"/g, "")));
  }
  assert.ok(idsInLenses.size >= 5, "lenses reference several sections");
  for (const id of idsInLenses) {
    assert.ok(tpl.includes(`id="${id}"`), `lens references section #${id} which is not in the template`);
  }
});
