/*
 * Monitoring loop CLI entry (PROMPT-10 §monitoring-run).
 *
 *   node scripts/dossier/monitoring/run.mjs
 *
 * Executes ONE deterministic monitoring cycle for the Able.cz corporate-identity
 * subscription, gates the resulting change candidates through the human-review
 * ledger, persists loop state, and publishes the reviewed result to the static
 * data tree. It is the impure shell around the pure engine/model/candidate
 * modules: all I/O (state files, fixtures, published output) lives here; none of
 * it lives in the frozen-contract siblings.
 *
 * DETERMINISM: wall-clock time never enters this program. `now` is read from the
 * MONITOR_NOW env var if set, else a FIXED constant. A real scheduler will inject
 * the true wall-clock timestamp later via MONITOR_NOW; until then the fixed value
 * keeps every run byte-reproducible. Date.now()/new Date() with no argument are
 * intentionally NOT called.
 *
 * IDEMPOTENCY: with the same fixtures and an existing baseline, re-running (same
 * MONITOR_NOW) yields a NO_CHANGE run, zero new publishable candidates and an
 * all-`unchanged` publish. Determinism of `now` makes run/candidate ids stable;
 * the run journal upserts by id; the baseline is written byte-identically.
 *
 * BASELINE-SAFETY: the last-observation baseline is overwritten ONLY when at
 * least one provider succeeded, and even then observed fields are MERGED over the
 * prior baseline — a partial or all-unavailable run can never erase a known
 * field or manufacture a "removed" finding (engine.mjs guarantees the diff side).
 *
 * State files (data/dossier/able/monitoring/):
 *   subscription.json      persisted subscription lifecycle record
 *   last-observation.json  { fields:{...} } baseline for the next diff
 *   approvals.json         INPUT: human review ledger (array; absent → [])
 *   runs-journal.json      append/upsert-by-id log of run records (array)
 *   fixtures/              recorded provider fixtures (read by providers)
 * Published output (static/data/dossier/monitoring/): written by publishMonitoring.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

import { makeSubscription, dueState, nextDueAt, getPolicy } from "./model.mjs";
import { runCycle } from "./engine.mjs";
import { classifyCandidate, reviewGate, isPublishable } from "./candidate.mjs";
import { publishMonitoring } from "./publish.mjs";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/** Fixed, reproducible clock. A real scheduler injects wall-clock via MONITOR_NOW. */
const FIXED_NOW = "2026-07-19T12:00:00Z";

const STATE_DIR = join(ROOT, "data/dossier/able/monitoring");
const FIXTURES_DIR = join(STATE_DIR, "fixtures");
const PUBLISH_DIR = join(ROOT, "static/data/dossier/monitoring");

const SUBSCRIPTION_FILE = join(STATE_DIR, "subscription.json");
const BASELINE_FILE = join(STATE_DIR, "last-observation.json");
const APPROVALS_FILE = join(STATE_DIR, "approvals.json");
const JOURNAL_FILE = join(STATE_DIR, "runs-journal.json");

/* ------------------------------------------------------------------ io utils */

/**
 * Read + JSON-parse a file, returning a fallback when it does not exist.
 * @template T
 * @param {string} path absolute file path
 * @param {T} fallback value returned when the file is absent
 * @returns {T|*} parsed JSON, or `fallback` when the file does not exist
 */
function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Write a value as pretty-printed JSON (repo convention: 2-space + trailing NL),
 * creating parent directories as needed.
 * @param {string} path absolute file path
 * @param {*} value JSON-serializable value
 * @returns {void}
 */
function writeJson(path, value) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

/* ---------------------------------------------------------------------- main */

/**
 * Execute one monitoring cycle end-to-end: resolve the clock, load/create the
 * subscription and baseline, run the bounded engine cycle, classify + gate each
 * candidate against the approval ledger, persist loop state (journal, baseline,
 * subscription) and publish the reviewed result.
 *
 * @returns {Promise<{ now: string, run: object, publishable: number,
 *   requiresReview: number, published: {written:number, unchanged:number,
 *   skippedPending:number} }>} a machine-readable summary of the cycle
 * @throws {Error} only on programmer error (unknown policy, malformed engine
 *   contract) — provider unavailability is a health event, never a throw.
 */
export async function main() {
  const now = process.env.MONITOR_NOW || FIXED_NOW;
  const clock = { now };

  // --- 1. subscription: load, or bootstrap on first ever run -----------------
  let subscription = readJson(SUBSCRIPTION_FILE, null);
  if (!subscription) {
    subscription = makeSubscription({ target: "able-cz", policyId: "corporate-identity", now });
    writeJson(SUBSCRIPTION_FILE, subscription);
  }
  const policy = getPolicy(subscription.policyId);
  const due = dueState(subscription, now);

  // --- 2. prior baseline (null on first run → engine emits zero candidates) --
  const priorSnapshot = readJson(BASELINE_FILE, null);

  // --- 3. bounded, deterministic engine cycle --------------------------------
  const { run, candidates, health, stopReason } = await runCycle({
    subscription,
    priorSnapshot,
    fixturesDir: FIXTURES_DIR,
    clock,
  });

  // --- 4. classify + human-review gate every candidate -----------------------
  const approvals = readJson(APPROVALS_FILE, []);
  const processed = candidates.map((c) => reviewGate(classifyCandidate(c, policy), { approvals }));
  const requiresReview = processed.filter((c) => c.requiresReview).length;
  const publishable = processed.filter(isPublishable);

  // --- 5. provider health accounting -----------------------------------------
  const execs = Array.isArray(run.providerExecutions) ? run.providerExecutions : [];
  const okCount = execs.filter((e) => e && e.ok === true).length;
  const failedCount = execs.length - okCount;
  const anyProviderOk = okCount > 0;

  // --- 6. persist run journal (upsert by id → idempotent for a fixed `now`) ---
  const journal = readJson(JOURNAL_FILE, []);
  const at = journal.findIndex((r) => r && r.id === run.id);
  if (at >= 0) journal[at] = run;
  else journal.push(run);
  journal.sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)) || String(a.id).localeCompare(String(b.id)));
  writeJson(JOURNAL_FILE, journal);

  // --- 7. advance subscription lifecycle -------------------------------------
  subscription = {
    ...subscription,
    lastRunAt: now,
    nextDueAt: nextDueAt(now, policy),
    // Consecutive-failure counter: bump only when NO provider succeeded, reset
    // to zero the moment any provider comes back.
    failureCount: anyProviderOk ? 0 : (subscription.failureCount || 0) + 1,
    state: "IDLE",
  };
  writeJson(SUBSCRIPTION_FILE, subscription);

  // --- 8. baseline update — ONLY on a real observation, and MERGED -----------
  // Never overwrite a known baseline with an all-unavailable result; merge so a
  // partial observation augments rather than truncates the known field set.
  if (anyProviderOk) {
    const priorFields = (priorSnapshot && priorSnapshot.fields) || {};
    const observedFields = (run.observation && run.observation.fields) || {};
    writeJson(BASELINE_FILE, { fields: { ...priorFields, ...observedFields }, updatedAt: now });
  }

  // --- 9. publish the reviewed result ----------------------------------------
  const published = await publishMonitoring({
    runs: journal,
    candidates: processed,
    health,
    subscription,
    outDir: PUBLISH_DIR,
    now,
  });

  // --- 10. human summary -----------------------------------------------------
  console.log(`monitoring run ${run.id}`);
  console.log(`  now (fixed/env)   ${now}`);
  console.log(`  due              ${due.due ? "YES" : "no"} (${due.reason}${due.ageDays == null ? "" : ", age " + due.ageDays + "d"})`);
  console.log(`  providers        ${okCount} ok / ${failedCount} failed${stopReason ? " (stop: " + stopReason + ")" : ""}`);
  console.log(`  run state        ${run.state}`);
  console.log(`  candidates       ${candidates.length} found, ${requiresReview} require review, ${publishable.length} publishable`);
  console.log(`  failureCount     ${subscription.failureCount}`);
  console.log(`  baseline         ${anyProviderOk ? "updated" : "kept (no ok provider)"}`);
  console.log(`  published        ${published.written} written, ${published.unchanged} unchanged, ${published.skippedPending} pending-skipped`);

  return { now, run, publishable: publishable.length, requiresReview, published };
}

/* ------------------------------------------------------------- CLI guard */

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    () => process.exit(0),
    (err) => {
      // Non-zero exit is reserved for programmer error; provider failures never
      // reach here (they are health events inside runCycle).
      console.error("monitoring run FAILED (programmer error): " + (err && err.stack ? err.stack : err));
      process.exit(1);
    },
  );
}
