/*
 * Monitoring publication integrity gate (PROMPT-10 §monitoring-validate).
 *
 *   node scripts/dossier/monitoring/monitoring-validate.mjs
 *
 * Fails the build (exit 1) on any invariant breach in the published monitoring
 * tree (static/data/dossier/monitoring/*.json). The load-bearing invariants:
 *
 *   1. manifest / summary / runs / candidates / health all exist and parse.
 *   2. NO unreviewed change leaks: every candidate in candidates.json is
 *      publishable (never PENDING_REVIEW / REJECTED). This is the whole point of
 *      the review gate — the published tree must contain only reviewed facts.
 *   3. manifest.counts is consistent with the published arrays.
 *   4. NO run exceeds LIMITS.MAX_PROVIDER_CALLS_PER_RUN provider executions — the
 *      loop-speed / blast-radius fence must hold on every persisted run.
 *   5. manifest.note is present (honest, human-readable provenance line).
 *
 * Pure read-only: never writes, mutates, or repairs. Exit 0 iff all pass.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

import { LIMITS } from "./model.mjs";
import { isPublishable } from "./candidate.mjs";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const PUB_DIR = join(ROOT, "static/data/dossier/monitoring");

/**
 * Normalize a published document to an array. Accepts a bare array, or an object
 * carrying the array under `key` or a generic `items` key.
 * @param {*} doc parsed JSON document
 * @param {string} key preferred wrapper key (e.g. "runs")
 * @returns {*[]|null} the array, or null when no array can be found
 */
function asArray(doc, key) {
  if (Array.isArray(doc)) return doc;
  if (doc && Array.isArray(doc[key])) return doc[key];
  if (doc && Array.isArray(doc.items)) return doc.items;
  return null;
}

/**
 * Count provider executions recorded on a published run, tolerating either the
 * full `providerExecutions` array or a pre-computed numeric field.
 * @param {object} run a published run record
 * @returns {number} number of provider executions attributed to the run
 */
function providerCallCount(run) {
  if (run && Array.isArray(run.providerExecutions)) return run.providerExecutions.length;
  for (const k of ["provider_calls", "providerExecutionCount", "provider_call_count"]) {
    if (run && typeof run[k] === "number") return run[k];
  }
  // Fall back to health rows that carry a providerId (engine records one per call).
  if (run && Array.isArray(run.health)) return run.health.filter((h) => h && h.providerId).length;
  return 0;
}

/**
 * Validate the published monitoring tree against its integrity invariants.
 * @returns {Promise<{ ok: boolean, errors: string[], warnings: string[] }>}
 */
export async function validate() {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  // --- 1. every expected file exists + parses --------------------------------
  const FILES = ["manifest", "summary", "runs", "candidates", "health"];
  const docs = {};
  for (const name of FILES) {
    const p = join(PUB_DIR, name + ".json");
    if (!existsSync(p)) {
      err(`missing published file: ${name}.json`);
      continue;
    }
    try {
      docs[name] = JSON.parse(readFileSync(p, "utf8"));
    } catch (e) {
      err(`${name}.json does not parse: ${e && e.message ? e.message : e}`);
    }
  }
  // Cannot check deeper invariants if the core documents are absent/broken.
  if (errors.length) return finish(errors, warnings);

  const manifest = docs.manifest;
  const runs = asArray(docs.runs, "runs");
  const candidates = asArray(docs.candidates, "candidates");
  const health = asArray(docs.health, "health");
  if (!runs) err("runs.json is not an array (nor {runs:[...]})");
  if (!candidates) err("candidates.json is not an array (nor {candidates:[...]})");
  if (!health) err("health.json is not an array (nor {health:[...]})");
  if (errors.length) return finish(errors, warnings);

  // --- 2. no unreviewed candidate may leak into the published tree -----------
  candidates.forEach((c, i) => {
    if (!isPublishable(c)) {
      err(`candidates.json[${i}] (${c && c.id ? c.id : "?"}) is not publishable — leaked status '${c && c.status}'`);
    }
  });

  // --- 3. manifest.counts consistent with the published arrays ---------------
  const counts = manifest && manifest.counts;
  if (!counts || typeof counts !== "object" || Array.isArray(counts)) {
    err("manifest.counts is missing or not an object");
  } else {
    // Recognized, cross-checkable count keys → actual array length.
    const actual = { runs: runs.length, candidates: candidates.length, health: health.length };
    const ALIASES = {
      runs: ["runs", "run_count", "runsCount"],
      // published candidates == the whole candidates array (pending are skipped upstream)
      candidates: ["candidates", "candidate_count", "candidatesCount", "published", "published_count"],
      health: ["health", "health_count", "healthCount", "health_events"],
    };
    let recognized = 0;
    for (const [target, keys] of Object.entries(ALIASES)) {
      for (const k of keys) {
        if (k in counts) {
          recognized++;
          if (counts[k] !== actual[target]) {
            err(`manifest.counts.${k} = ${counts[k]} but ${target}.json has ${actual[target]}`);
          }
        }
      }
    }
    if (recognized === 0) err("manifest.counts has no recognizable keys to cross-check against runs/candidates/health");
  }

  // --- 4. per-run provider-call fence ----------------------------------------
  const cap = LIMITS.MAX_PROVIDER_CALLS_PER_RUN;
  runs.forEach((r, i) => {
    const n = providerCallCount(r);
    if (n > cap) err(`runs.json[${i}] (${r && r.id ? r.id : "?"}) executed ${n} providers > LIMITS.MAX_PROVIDER_CALLS_PER_RUN (${cap})`);
  });

  // --- 5. manifest.note present ----------------------------------------------
  if (!manifest || typeof manifest.note !== "string" || manifest.note.trim() === "") {
    err("manifest.note is missing or empty");
  }

  return finish(errors, warnings);
}

/**
 * Assemble the final result object.
 * @param {string[]} errors
 * @param {string[]} warnings
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
function finish(errors, warnings) {
  return { ok: errors.length === 0, errors, warnings };
}

/* ------------------------------------------------------------- CLI guard */

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validate().then(
    ({ ok, errors, warnings }) => {
      for (const w of warnings) console.warn("WARN  " + w);
      if (!ok) {
        for (const e of errors) console.error("ERROR " + e);
        console.error(`Monitoring validation FAILED: ${errors.length} error(s), ${warnings.length} warning(s).`);
        process.exit(1);
      }
      console.log(`Monitoring validation OK (${warnings.length} warning(s)).`);
      process.exit(0);
    },
    (err) => {
      console.error("Monitoring validation ERRORED (programmer error): " + (err && err.stack ? err.stack : err));
      process.exit(1);
    },
  );
}
