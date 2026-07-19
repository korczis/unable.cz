/*
 * Temporal route generator (PROMPT-09 §18–§20, §31, §37).
 *
 * Writes the Zola content pages for:
 *   /dossier/changes/            (+ one static page per MATERIAL change)
 *   /dossier/snapshots/          (+ one static page per snapshot)
 *   /dossier/history/
 *   /dossier/revalidation/
 *   /dossier/monitoring/
 *
 * Only material changes (MEDIUM+) get their own static route — generating a
 * page for every LOW/INFORMATIONAL record would be route noise; they remain
 * fully addressable in the changes manifest and index table (§37 explicitly
 * scopes static routes to material change objects). Adjacent snapshot
 * comparisons are URL-addressable via /dossier/changes/?from=…&to=… — the
 * table is pre-rendered per pair, so the filter works without JavaScript
 * for the default (latest) pair and with JS for any selected pair.
 *
 * Deterministic and idempotent; stale generated pages are removed first.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const CHG = JSON.parse(readFileSync(join(ROOT, "static/data/dossier/changes/manifest.json"), "utf8"));
const SNAP_INDEX = JSON.parse(readFileSync(join(ROOT, "static/data/dossier/snapshots/index.json"), "utf8"));

const esc = (s) => String(s || "").replace(/"/g, "'").replace(/\n/g, " ");
// SEO: keep <title> within 60 chars (CHG-1234 + " — " leaves ~48 for the text).
const shortTitle = (s, n) => {
  const x = String(s || "").replace(/\s+/g, " ").trim();
  return x.length > n ? x.slice(0, n - 1).replace(/[\s,;:—-]+\S*$/, "") + "…" : x;
};
const CONTENT = join(ROOT, "content/dossier");

/* ------------------------------------------------------------- changes */

const chDir = join(CONTENT, "changes");
mkdirSync(chDir, { recursive: true });
for (const f of readdirSync(chDir)) if (/^chg-\d+\.md$/.test(f)) rmSync(join(chDir, f));

const material = CHG.changes.filter((c) => c.public_route);
for (const c of material) {
  const slug = c.id.toLowerCase();
  const fm =
    "+++\n" +
    `title = "${c.id} — ${esc(shortTitle(c.public_summary, 47))}"\n` +
    `description = "${esc(`Změna ${c.id} (${c.materiality}, ${c.change_type}) v dossieru Able.cz: ${c.public_summary}`).slice(0, 155)}"\n` +
    'template = "dossier/change.html"\n' +
    "[extra]\n" +
    `change_id = "${c.id}"\n` +
    `data_path = "static/data/dossier/changes/${slug}.json"\n` +
    "+++\n";
  writeFileSync(join(chDir, slug + ".md"), fm);
}
writeFileSync(join(chDir, "_index.md"),
  "+++\n" +
  'title = "Změny — Able.cz DD"\n' +
  `description = "Ledger změn dossieru Able.cz: ${CHG.total_changes} sémantických změn napříč ${SNAP_INDEX.snapshot_count} snapshoty; ${CHG.material_changes} materiálních s vlastní stránkou."\n` +
  'sort_by = "slug"\n' +
  'template = "dossier/changes-index.html"\n' +
  'page_template = "dossier/change.html"\n' +
  "[extra]\n" +
  'manifest_path = "static/data/dossier/changes/manifest.json"\n' +
  'snapshots_path = "static/data/dossier/snapshots/index.json"\n' +
  "+++\n");

/* ------------------------------------------------------------ snapshots */

const snDir = join(CONTENT, "snapshots");
mkdirSync(snDir, { recursive: true });
for (const f of readdirSync(snDir)) if (/^able-cz-.*\.md$/.test(f)) rmSync(join(snDir, f));

for (const s of SNAP_INDEX.snapshots) {
  const fm =
    "+++\n" +
    `title = "Snapshot ${s.snapshot_id}"\n` +
    `description = "${esc(`Neměnný publikovaný snapshot dossieru Able.cz ${s.snapshot_id} (evidence k ${s.evidence_cutoff}): ${s.counts.claims_live} živých tvrzení, ${s.counts.sources} zdrojů. ${s.note || ""}`).slice(0, 155)}"\n` +
    'template = "dossier/snapshot.html"\n' +
    "[extra]\n" +
    `snapshot_id = "${s.snapshot_id}"\n` +
    `manifest_path = "static/data/dossier/snapshots/${s.snapshot_id}/manifest.json"\n` +
    'index_path = "static/data/dossier/snapshots/index.json"\n' +
    'changes_path = "static/data/dossier/changes/manifest.json"\n' +
    "+++\n";
  writeFileSync(join(snDir, s.snapshot_id + ".md"), fm);
}
writeFileSync(join(snDir, "_index.md"),
  "+++\n" +
  'title = "Snapshoty — Able.cz DD"\n' +
  `description = "Rejstřík neměnných publikovaných snapshotů dossieru Able.cz: ${SNAP_INDEX.snapshot_count} verzí od prvního vydání 2026-07-17, každá s manifestem, hashem a diffem."\n` +
  'sort_by = "slug"\n' +
  'template = "dossier/snapshots-index.html"\n' +
  'page_template = "dossier/snapshot.html"\n' +
  "[extra]\n" +
  'index_path = "static/data/dossier/snapshots/index.json"\n' +
  'changes_path = "static/data/dossier/changes/manifest.json"\n' +
  "+++\n");

/* ------------------------------------- history / revalidation / monitoring */

writeFileSync(join(CONTENT, "history.md"),
  "+++\n" +
  'title = "Historie objektů — Able.cz DD"\n' +
  'description = "Revizní řetězce každého kanonického objektu dossieru Able.cz napříč publikovanými snapshoty: kdy se záznam objevil, změnil, byl nahrazen a proč."\n' +
  'template = "dossier/history.html"\n' +
  "[extra]\n" +
  'histories_path = "static/data/dossier/history/objects.json"\n' +
  'index_path = "static/data/dossier/snapshots/index.json"\n' +
  'changes_path = "static/data/dossier/changes/manifest.json"\n' +
  "+++\n");

writeFileSync(join(CONTENT, "revalidation.md"),
  "+++\n" +
  'title = "Revalidace — Able.cz DD"\n' +
  'description = "Prioritizovaná fronta revalidace dossieru Able.cz: co je čerstvé, co je po termínu, co je blokované a co ověřit jako další — s poctivým oddělením kvality evidence od aktuálnosti."\n' +
  'template = "dossier/revalidation.html"\n' +
  "[extra]\n" +
  'freshness_path = "static/data/dossier/revalidation/freshness.json"\n' +
  'plan_path = "static/data/dossier/revalidation/plan.json"\n' +
  "+++\n");

writeFileSync(join(CONTENT, "monitoring.md"),
  "+++\n" +
  'title = "Monitoring — Able.cz DD"\n' +
  'description = "Plán monitoringu dossieru Able.cz: sledované subjekty, poskytovatelé, kadence a stav poslední dokončené kontroly. Plán, ne běžící infrastruktura — poctivě označeno."\n' +
  'template = "dossier/monitoring.html"\n' +
  "[extra]\n" +
  'monitoring_path = "static/data/dossier/revalidation/monitoring.json"\n' +
  'freshness_path = "static/data/dossier/revalidation/freshness.json"\n' +
  "+++\n");

console.log(`Routes: ${material.length} change pages, ${SNAP_INDEX.snapshots.length} snapshot pages, + changes/snapshots indexes, history, revalidation, monitoring.`);
