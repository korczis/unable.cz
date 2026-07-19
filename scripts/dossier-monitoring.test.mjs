/*
 * Due-diligence monitoring loop tests (PROMPT-10 §monitoring).
 *
 * Unit + integration coverage of the FROZEN monitoring contract:
 *   model.mjs · providers/index.mjs · engine.mjs · candidate.mjs · publish.mjs
 *
 * Everything is deterministic: a fixed injected clock, temp fixture/output dirs,
 * no network. The load-bearing behaviours under guard here are:
 *   - a provider failure is HEALTH-only and can NEVER manufacture a change,
 *   - a first run (no baseline) never mass-fabricates candidates,
 *   - material (ownership/statutory) changes cannot publish without approval,
 *   - publish is idempotent and never silently overwrites.
 *
 * publish.mjs is imported dynamically inside its own tests only, so that if it
 * is still being built in parallel the rest of this suite still runs (those
 * tests fail with an explicit 'module not found yet' rather than blanking the
 * whole file).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  LIMITS,
  POLICIES,
  CANDIDATE_STATUS,
  getPolicy,
  makeSubscription,
  dueState,
  makeRun,
  makeCandidate,
} from "./dossier/monitoring/model.mjs";
import { runProvider, KNOWN_PROVIDERS } from "./dossier/monitoring/providers/index.mjs";
import { runCycle } from "./dossier/monitoring/engine.mjs";
import { classifyCandidate, reviewGate, isPublishable } from "./dossier/monitoring/candidate.mjs";

const CLOCK = { now: "2026-07-19T12:00:00Z" };
const POLICY_ID = "corporate-identity";
const TARGET = "able-cz";

/* ----------------------------------------------------------- temp helpers */

/** Create an empty temp dir (auto-namespaced). */
async function tmp(prefix) {
  return mkdtemp(join(tmpdir(), `mon-${prefix}-`));
}

/**
 * Materialise provider fixtures into a fresh temp dir.
 * `fixtures` maps providerId -> fixture object (written as
 * `${providerId}.${TARGET}.json`). Missing providers stay UNAVAILABLE.
 */
async function fixtureDir(fixtures = {}) {
  const dir = await tmp("fx");
  for (const [providerId, body] of Object.entries(fixtures)) {
    await writeFile(join(dir, `${providerId}.${TARGET}.json`), JSON.stringify(body), "utf8");
  }
  return dir;
}

function sub(now = CLOCK.now) {
  return makeSubscription({ target: TARGET, policyId: POLICY_ID, now });
}

/** ISO string `days` before CLOCK.now. */
function isoDaysBefore(days) {
  return new Date(Date.parse(CLOCK.now) - days * 86400000).toISOString();
}

/* =====================================================================
 * 1. dueState cadence math
 * ===================================================================== */

test("dueState: never-run subscription is due", () => {
  const s = sub(); // lastRunAt starts null
  assert.equal(s.lastRunAt, null);
  const d = dueState(s, CLOCK.now);
  assert.equal(d.due, true);
  assert.equal(d.reason, "never-run");
});

test("dueState: age below cadenceDays is NOT due", () => {
  const policy = getPolicy(POLICY_ID);
  const s = { ...sub(), lastRunAt: isoDaysBefore(policy.cadenceDays - 5) };
  const d = dueState(s, CLOCK.now);
  assert.equal(d.due, false);
  assert.equal(d.reason, "within-cadence");
  assert.ok(d.ageDays < policy.cadenceDays);
});

test("dueState: age >= cadenceDays is due", () => {
  const policy = getPolicy(POLICY_ID);
  const s = { ...sub(), lastRunAt: isoDaysBefore(policy.cadenceDays) };
  const d = dueState(s, CLOCK.now);
  assert.equal(d.due, true);
  assert.equal(d.reason, "cadence-elapsed");
  assert.ok(d.ageDays >= policy.cadenceDays);
});

/* =====================================================================
 * 2. Provider UNAVAILABLE — KEY ANTI-PATTERN GUARD
 * ===================================================================== */

test("runProvider: missing fixture -> ok:false, observation:null (UNAVAILABLE)", async () => {
  const dir = await fixtureDir(); // empty: no fixtures at all
  const res = await runProvider("cz-ares", { target: TARGET, fixturesDir: dir, clock: CLOCK });
  assert.equal(res.ok, false);
  assert.equal(res.observation, null);
  assert.equal(res.status, "UNAVAILABLE");
  await rm(dir, { recursive: true, force: true });
});

test("runCycle: unavailable provider is health-only and NEVER a change candidate", async () => {
  // prior snapshot HAS a value; every provider is unavailable (no fixtures).
  // A failure must not masquerade as "the value was removed/changed".
  const dir = await fixtureDir();
  const priorSnapshot = { fields: { legalName: "Able s.r.o." } };
  const { candidates, health, run } = await runCycle({
    subscription: sub(),
    priorSnapshot,
    fixturesDir: dir,
    clock: CLOCK,
  });
  assert.equal(candidates.length, 0, "provider failure must not produce a change candidate");
  assert.ok(health.length > 0, "a health record must be present for the failure");
  // every provider execution recorded as unhealthy, none contributed observation
  assert.ok(health.some((h) => h.ok === false));
  assert.equal(run.observation.fields.legalName, undefined);
  await rm(dir, { recursive: true, force: true });
});

/* =====================================================================
 * 3. First run (no baseline) — no mass fabrication
 * ===================================================================== */

test("runCycle: priorSnapshot=null yields zero candidates + no-baseline health note", async () => {
  const dir = await fixtureDir({
    "cz-ares": { status: "OK", fields: { legalName: "Able s.r.o.", ico: "12345678" } },
  });
  const { candidates, health } = await runCycle({
    subscription: sub(),
    priorSnapshot: null,
    fixturesDir: dir,
    clock: CLOCK,
  });
  assert.equal(candidates.length, 0, "first run must not fabricate candidates");
  assert.ok(
    health.some((h) => h.status === "no-prior-snapshot"),
    "expected a health note about missing baseline",
  );
  await rm(dir, { recursive: true, force: true });
});

/* =====================================================================
 * 4. Genuine change detection
 * ===================================================================== */

test("runCycle: genuine legalName change -> exactly one candidate on 'legalName'", async () => {
  const dir = await fixtureDir({
    "cz-ares": { status: "OK", fields: { legalName: "B" } },
    // cz-justice-or intentionally absent (unavailable) — must not interfere.
  });
  const priorSnapshot = { fields: { legalName: "A" } };
  const { candidates } = await runCycle({
    subscription: sub(),
    priorSnapshot,
    fixturesDir: dir,
    clock: CLOCK,
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].field, "legalName");
  assert.equal(candidates[0].before, "A");
  assert.equal(candidates[0].after, "B");
  await rm(dir, { recursive: true, force: true });
});

/* =====================================================================
 * 5. Review gate — material vs non-material
 * ===================================================================== */

function candidateForField(field, before, after) {
  const s = sub();
  const run = makeRun({ subscription: s, now: CLOCK.now });
  return makeCandidate({ run, field, before, after, now: CLOCK.now });
}

test("reviewGate: material field (owners) with NO approval stays PENDING_REVIEW and is not publishable", () => {
  const policy = getPolicy(POLICY_ID);
  assert.ok(policy.reviewRequiredFields.includes("owners"));
  const classified = classifyCandidate(candidateForField("owners", "X", "Y"), policy);
  assert.equal(classified.requiresReview, true);
  const gated = reviewGate(classified, { approvals: [] });
  assert.equal(gated.status, CANDIDATE_STATUS.PENDING_REVIEW);
  assert.equal(isPublishable(gated), false);
});

test("reviewGate: material field with an approve record -> APPROVED and publishable", () => {
  const policy = getPolicy(POLICY_ID);
  const classified = classifyCandidate(candidateForField("owners", "X", "Y"), policy);
  const approvals = [
    { candidateId: classified.id, decision: "approve", reviewer: "analyst", at: CLOCK.now },
  ];
  const gated = reviewGate(classified, { approvals });
  assert.equal(gated.status, CANDIDATE_STATUS.APPROVED);
  assert.equal(isPublishable(gated), true);
});

test("reviewGate: non-material field with no decision -> AUTO_APPROVED and publishable", () => {
  const policy = getPolicy(POLICY_ID);
  assert.equal(policy.reviewRequiredFields.includes("legalName"), false);
  const classified = classifyCandidate(candidateForField("legalName", "A", "B"), policy);
  assert.equal(classified.requiresReview, false);
  const gated = reviewGate(classified, { approvals: [] });
  assert.equal(gated.status, CANDIDATE_STATUS.AUTO_APPROVED);
  assert.equal(isPublishable(gated), true);
});

/* =====================================================================
 * 6. publishMonitoring — pending skipped + idempotent
 *    (dynamic import so a not-yet-built module fails only these tests)
 * ===================================================================== */

async function loadPublish(t) {
  try {
    return await import("./dossier/monitoring/publish.mjs");
  } catch (err) {
    if (err && (err.code === "ERR_MODULE_NOT_FOUND" || /Cannot find module/.test(String(err.message)))) {
      t.diagnostic(`publish.mjs not found yet (parallel build): ${err.message}`);
    }
    throw err;
  }
}

/** Build a publishable + a pending candidate over the same run. */
function candidatePairForPublish() {
  const policy = getPolicy(POLICY_ID);
  const s = sub();
  const run = makeRun({ subscription: s, now: CLOCK.now });

  const auto = reviewGate(
    classifyCandidate(makeCandidate({ run, field: "legalName", before: "A", after: "B", now: CLOCK.now }), policy),
    { approvals: [] },
  ); // AUTO_APPROVED

  const pending = reviewGate(
    classifyCandidate(makeCandidate({ run, field: "owners", before: "X", after: "Y", now: CLOCK.now }), policy),
    { approvals: [] },
  ); // PENDING_REVIEW

  return { s, run, auto, pending };
}

async function findFile(dir, name) {
  const entries = await readdir(dir, { recursive: true }).catch(() => readdir(dir));
  return entries.find((e) => e === name || e.endsWith(`/${name}`) || e.endsWith(`\\${name}`));
}

test("publishMonitoring: pending-review candidates are skipped, not written into candidates.json", async (t) => {
  const publish = await loadPublish(t);
  const outDir = await tmp("out");
  const { s, run, auto, pending } = candidatePairForPublish();

  const res = await publish.publishMonitoring({
    runs: [run],
    candidates: [auto, pending],
    health: run.health ?? [],
    subscription: s,
    outDir,
    now: CLOCK.now,
  });

  assert.ok(res.skippedPending > 0, "pending-review candidate must be counted as skipped");

  const rel = await findFile(outDir, "candidates.json");
  assert.ok(rel, "candidates.json should be written");
  const content = await readFile(join(outDir, rel), "utf8");
  assert.ok(!content.includes(pending.id), "pending candidate id must NOT appear in candidates.json");
  assert.ok(content.includes(auto.id), "auto-approved candidate id must appear in candidates.json");

  await rm(outDir, { recursive: true, force: true });
});

test("publishMonitoring: re-publishing identical content is idempotent (unchanged, no silent overwrite)", async (t) => {
  const publish = await loadPublish(t);
  const outDir = await tmp("out");
  const { s, run, auto, pending } = candidatePairForPublish();

  const args = {
    runs: [run],
    candidates: [auto, pending],
    health: run.health ?? [],
    subscription: s,
    outDir,
    now: CLOCK.now,
  };

  await publish.publishMonitoring(args);
  const res2 = await publish.publishMonitoring(args);

  assert.ok(Array.isArray(res2.unchanged), "second publish must report an 'unchanged' list");
  assert.ok(res2.unchanged.length > 0, "identical re-publish must list files as unchanged");
  assert.equal((res2.written ?? []).length, 0, "identical re-publish must not re-write files");

  await rm(outDir, { recursive: true, force: true });
});

/* =====================================================================
 * 7. Provider call limit respected
 * ===================================================================== */

test("LIMITS.MAX_PROVIDER_CALLS_PER_RUN is a positive cap", () => {
  assert.equal(typeof LIMITS.MAX_PROVIDER_CALLS_PER_RUN, "number");
  assert.ok(LIMITS.MAX_PROVIDER_CALLS_PER_RUN > 0);
});

test("runCycle: never issues more provider calls than MAX_PROVIDER_CALLS_PER_RUN", async () => {
  const dir = await fixtureDir({
    "cz-ares": { status: "OK", fields: { legalName: "Able s.r.o." } },
    "cz-justice-or": { status: "OK", fields: { legalName: "Able s.r.o." } },
  });
  const { run } = await runCycle({
    subscription: sub(),
    priorSnapshot: { fields: { legalName: "Able s.r.o." } },
    fixturesDir: dir,
    clock: CLOCK,
  });
  const policy = getPolicy(POLICY_ID);
  assert.ok(
    run.providerExecutions.length <= LIMITS.MAX_PROVIDER_CALLS_PER_RUN,
    "provider executions must not exceed the per-run cap",
  );
  // sanity: the policy's provider set is within the cap and all are known
  assert.ok(policy.providers.length <= LIMITS.MAX_PROVIDER_CALLS_PER_RUN);
  for (const p of policy.providers) assert.ok(KNOWN_PROVIDERS.includes(p));
  await rm(dir, { recursive: true, force: true });
});
