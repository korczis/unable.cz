/*
 * Deterministic, bounded monitoring cycle (PROMPT-10 §monitoring-engine).
 *
 * `runCycle` executes ONE monitoring run for a subscription: it calls the
 * policy's providers (never more than LIMITS.MAX_PROVIDER_CALLS_PER_RUN),
 * merges the observations of the healthy ones, diffs the material fields
 * against a prior snapshot and emits change candidates. It is deterministic:
 * every timestamp comes from the caller-supplied `clock.now` ISO string, never
 * from Date.now(). Provider I/O is the only non-pure part and it is fully
 * quarantined — a failing provider becomes a HEALTH event, never a data change.
 *
 * Two safety invariants are load-bearing:
 *   1. provider-failure-as-negative-finding is impossible — ok:false providers
 *      contribute NOTHING to observed fields, so an unreachable register can
 *      never masquerade as "the value was removed".
 *   2. first-run mass-fabrication is impossible — a null priorSnapshot yields
 *      zero candidates (there is no baseline to diff against), so bootstrap
 *      never floods the review queue with every field as a "change".
 *
 * See model.mjs for the frozen record shapes and providers/index.mjs for the
 * provider contract. Wall-clock enforcement (LIMITS.RUN_WALL_MS) attaches at
 * the CLI/scheduler layer — deterministic pure code cannot time itself.
 */
import { RUN_STATES, LIMITS, getPolicy, makeRun, makeCandidate } from "./model.mjs";
import { runProvider } from "./providers/index.mjs";

/**
 * Deep structural equality for scalars, arrays and plain objects.
 * Uses JSON.stringify so array/object payloads compare by content, not identity.
 * @param {*} a
 * @param {*} b
 * @returns {boolean} true when semantically identical
 */
function deepEqual(a, b) {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Whether a value counts as "present" for diffing purposes.
 * null / undefined / "" are treated as absent so an empty provider payload is
 * never mistaken for a real value.
 * @param {*} v
 * @returns {boolean}
 */
function hasValue(v) {
  return v !== undefined && v !== null && v !== "";
}

/**
 * Execute a single deterministic, bounded monitoring cycle for a subscription.
 *
 * @param {object} params
 * @param {{ id: string, target: string, policyId: string }} params.subscription
 *        Subscription to run (must reference a known policy).
 * @param {{ fields: Object<string, *> }|null} params.priorSnapshot
 *        Last known-good field snapshot, or null when no baseline exists yet.
 * @param {string} params.fixturesDir Directory passed through to providers.
 * @param {{ now: string }} params.clock Deterministic clock; `now` is an ISO
 *        string and is the ONLY source of time in this function.
 * @returns {Promise<{ run: object, candidates: object[], health: object[],
 *          stopReason: string|null }>}
 * @throws {Error} only on programmer errors (missing subscription/policy) —
 *         never on provider failure, which is captured as a health event.
 */
export async function runCycle({ subscription, priorSnapshot, fixturesDir, clock }) {
  // --- programmer-error guards (these SHOULD throw) --------------------------
  if (!subscription || typeof subscription !== "object") {
    throw new Error("runCycle: subscription is required");
  }
  if (!clock || typeof clock.now !== "string") {
    throw new Error("runCycle: clock.now (ISO string) is required");
  }
  const policy = getPolicy(subscription.policyId); // throws on unknown policy

  // --- 1. plan the run ------------------------------------------------------
  const run = makeRun({ subscription, now: clock.now });
  run.startedAt = clock.now;
  run.state = RUN_STATES.RUNNING;

  const health = [];
  const candidates = [];
  let stopReason = null;

  // --- 2. call providers under a hard call cap ------------------------------
  const providerIds = Array.isArray(policy.providers) ? policy.providers : [];
  const maxCalls = LIMITS.MAX_PROVIDER_CALLS_PER_RUN;
  const observations = []; // { providerId, fields } from ok:true providers only

  for (let i = 0; i < providerIds.length; i++) {
    if (i >= maxCalls) {
      // Cap reached — refuse further calls and record why we stopped.
      stopReason = "provider-call-limit";
      health.push({
        providerId: null,
        ok: false,
        status: "provider-call-limit",
        at: clock.now,
      });
      break;
    }

    const providerId = providerIds[i];
    // runProvider never throws per contract; guard anyway so an unexpected
    // rejection degrades to a health event rather than aborting the run.
    let result;
    try {
      result = await runProvider(providerId, { target: subscription.target, fixturesDir, clock });
    } catch (err) {
      result = {
        providerId,
        ok: false,
        status: "provider-threw",
        fetchedAt: clock.now,
        observation: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    run.providerExecutions.push(result);
    health.push({
      providerId: result.providerId ?? providerId,
      ok: result.ok === true,
      status: result.status ?? null,
      at: result.fetchedAt ?? clock.now,
    });

    // Only healthy providers with an actual observation contribute data.
    if (result.ok === true && result.observation && result.observation.fields) {
      observations.push({ providerId: result.providerId ?? providerId, fields: result.observation.fields });
    }
  }

  // --- 3. merge observations (ok:true only, later provider wins per field) ---
  const observedFields = {};
  const fieldSources = {};
  for (const obs of observations) {
    for (const [field, value] of Object.entries(obs.fields)) {
      observedFields[field] = value; // shallow merge; later provider wins
      fieldSources[field] = obs.providerId; // record provenance
    }
  }
  const observed = { fields: observedFields, sources: fieldSources };
  run.observation = observed;

  // --- 4. diff material fields against the prior snapshot --------------------
  const materialFields = Array.isArray(policy.materialFields) ? policy.materialFields : [];
  const candidateIds = [];

  if (!priorSnapshot || !priorSnapshot.fields) {
    // No baseline → first run. Emitting candidates now would fabricate a full
    // set of bogus "changes", so we deliberately emit NONE.
    health.push({ providerId: null, ok: true, status: "no-prior-snapshot", at: clock.now });
  } else {
    const priorFields = priorSnapshot.fields;
    for (const field of materialFields) {
      const before = priorFields[field];
      const after = observedFields[field];

      // Only compare where BOTH sides have a genuine value. A missing/empty
      // observed value where prior had one is NOT a "removed" candidate — the
      // most likely cause is provider unavailability (already a health event),
      // not a real removal. We never emit a candidate on absence alone.
      if (!hasValue(before) || !hasValue(after)) continue;

      if (!deepEqual(before, after)) {
        const candidate = makeCandidate({ run, field, before, after, now: clock.now });
        candidates.push(candidate);
        candidateIds.push(candidate.id);
      }
    }
  }

  // --- 5. terminal state ----------------------------------------------------
  if (candidates.length === 0) {
    run.state = RUN_STATES.NO_CHANGE;
  } else {
    run.state = RUN_STATES.CANDIDATE;
    run.candidateId = candidateIds[0];
    run.candidateIds = candidateIds; // store all ids too
  }

  // --- 6. wall-clock bookkeeping (enforcement lives at CLI/scheduler) --------
  // We record start/end from clock.now only. LIMITS.RUN_WALL_MS cannot be
  // enforced inside deterministic pure code that has no real elapsed time — the
  // scheduler wraps runCycle with a real timeout and aborts on RUN_WALL_MS.
  run.endedAt = clock.now;

  // --- 7. mirror aggregates onto the run and return -------------------------
  run.health = health;
  run.stopReason = stopReason;

  return { run, candidates, health, stopReason: stopReason ?? null };
}
