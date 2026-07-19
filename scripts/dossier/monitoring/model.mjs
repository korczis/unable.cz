/*
 * Domain-model foundation for the due-diligence monitoring loop.
 *
 * Pure data + pure functions only. No I/O, no external dependencies,
 * Node >= 18 built-ins only. Fully deterministic: there is NO Math.random
 * and NO Date.now() / new Date() with no argument anywhere. All wall-clock
 * time enters through an injected `now` ISO string (or ISO strings parsed
 * from stored records) — Date parsing of an explicit ISO string is pure and
 * reproducible, and is the only Date usage permitted here.
 *
 * This module is the FROZEN INTERFACE CONTRACT other monitoring modules
 * depend on: run/candidate state machines, subscription lifecycle, cadence
 * due-date math, factory constructors and shape validation. Exports MUST NOT
 * change shape without coordinating every dependent module.
 */

/* ------------------------------------------------------------ enumerations */

/** Lifecycle states of a single monitoring run. */
export const RUN_STATES = {
  PLANNED: "PLANNED",
  RUNNING: "RUNNING",
  OBSERVED: "OBSERVED",
  CANDIDATE: "CANDIDATE",
  NO_CHANGE: "NO_CHANGE",
  PUBLISHED: "PUBLISHED",
  FAILED: "FAILED",
};

/** Review/publication status of a change candidate. */
export const CANDIDATE_STATUS = {
  PENDING_REVIEW: "PENDING_REVIEW",
  AUTO_APPROVED: "AUTO_APPROVED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PUBLISHED: "PUBLISHED",
};

/** Hard safety limits for a single run (loop-speed + blast-radius fences). */
export const LIMITS = {
  MAX_PROVIDER_CALLS_PER_RUN: 4,
  MAX_RECURSION_DEPTH: 1,
  RUN_WALL_MS: 30000,
};

/** Monitoring policies. Each policy binds a cadence to a set of providers and
 *  the material fields whose change is worth surfacing. */
export const POLICIES = [
  {
    id: "corporate-identity",
    label: "Corporate identity (CZ registers)",
    cadenceDays: 30,
    providers: ["cz-ares", "cz-justice-or"],
    materialFields: ["legalName", "ico", "statutoryBody", "owners", "address", "status"],
    reviewRequiredFields: ["statutoryBody", "owners"],
  },
];

/* ---------------------------------------------------------------- policies */

/**
 * Look up a policy by id.
 * @param {string} policyId
 * @returns {typeof POLICIES[number]} the matching policy object
 * @throws {Error} if no policy with that id exists
 */
export function getPolicy(policyId) {
  const policy = POLICIES.find((p) => p.id === policyId);
  if (!policy) throw new Error(`Unknown policy: ${policyId}`);
  return policy;
}

/* ----------------------------------------------------------- subscriptions */

/**
 * Build a monitoring subscription binding a target to a policy.
 * @param {{ target: string, policyId: string, now: string }} params
 * @returns {{ id: string, target: string, policyId: string, createdAt: string,
 *            lastRunAt: null, nextDueAt: string, failureCount: number, state: string }}
 * @throws {Error} on empty target/policyId or unknown policy
 */
export function makeSubscription({ target, policyId, now }) {
  if (!target || typeof target !== "string") throw new Error("makeSubscription: target must be a non-empty string");
  if (!policyId || typeof policyId !== "string") throw new Error("makeSubscription: policyId must be a non-empty string");
  if (!now || typeof now !== "string") throw new Error("makeSubscription: now must be a non-empty ISO string");
  getPolicy(policyId); // validate policy exists (throws if unknown)
  return {
    id: `sub:${target}:${policyId}`,
    target,
    policyId,
    createdAt: now,
    lastRunAt: null,
    nextDueAt: now,
    failureCount: 0,
    state: "IDLE",
  };
}

/**
 * Whole days between two ISO strings (b - a), truncated toward zero.
 * Deterministic: both endpoints are explicit ISO strings.
 */
function ageInDays(fromIso, toIso) {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  return Math.floor((to - from) / 86400000);
}

/**
 * Evaluate whether a subscription is due for a run as of `now`.
 * @param {ReturnType<typeof makeSubscription>} subscription
 * @param {string} now ISO string
 * @returns {{ due: boolean, reason: string, ageDays: number|null }}
 */
export function dueState(subscription, now) {
  const policy = getPolicy(subscription.policyId);
  if (!subscription.lastRunAt) {
    return { due: true, reason: "never-run", ageDays: null };
  }
  const ageDays = ageInDays(subscription.lastRunAt, now);
  if (ageDays >= policy.cadenceDays) {
    return { due: true, reason: "cadence-elapsed", ageDays };
  }
  return { due: false, reason: "within-cadence", ageDays };
}

/**
 * Compute the next-due ISO timestamp = lastRunAt + policy.cadenceDays.
 * @param {string} lastRunAtIso
 * @param {typeof POLICIES[number]} policy
 * @returns {string} ISO string
 */
export function nextDueAt(lastRunAtIso, policy) {
  const d = new Date(Date.parse(lastRunAtIso));
  d.setUTCDate(d.getUTCDate() + policy.cadenceDays);
  return d.toISOString();
}

/* ------------------------------------------------------------------- runs */

/**
 * Build a fresh run in the PLANNED state for a subscription.
 * @param {{ subscription: ReturnType<typeof makeSubscription>, now: string }} params
 * @returns {object} run record
 */
export function makeRun({ subscription, now }) {
  return {
    id: `run:${subscription.id}:${now}`,
    subscriptionId: subscription.id,
    target: subscription.target,
    policyId: subscription.policyId,
    startedAt: now,
    state: RUN_STATES.PLANNED,
    providerExecutions: [],
    observation: null,
    candidateId: null,
    health: [],
    stopReason: null,
    endedAt: null,
  };
}

/* ------------------------------------------------------------- candidates */

/**
 * Build a change candidate for a single field transition (before -> after).
 * @param {{ run: object, field: string, before: *, after: *, now: string }} params
 * @returns {object} candidate record
 */
export function makeCandidate({ run, field, before, after, now }) {
  return {
    id: `cand:${run.id}:${field}`,
    runId: run.id,
    target: run.target,
    field,
    before,
    after,
    detectedAt: now,
    materiality: "unknown",
    requiresReview: false,
    status: CANDIDATE_STATUS.PENDING_REVIEW,
  };
}

/* ------------------------------------------------------------- validation */

const REQUIRED_KEYS = {
  subscription: {
    id: "string",
    target: "string",
    policyId: "string",
    createdAt: "string",
    lastRunAt: "string?",
    nextDueAt: "string",
    failureCount: "number",
    state: "string",
  },
  run: {
    id: "string",
    subscriptionId: "string",
    target: "string",
    policyId: "string",
    startedAt: "string",
    state: "string",
    providerExecutions: "array",
    observation: "object?",
    candidateId: "string?",
    health: "array",
    stopReason: "string?",
    endedAt: "string?",
  },
  candidate: {
    id: "string",
    runId: "string",
    target: "string",
    field: "string",
    before: "any",
    after: "any",
    detectedAt: "string",
    materiality: "string",
    requiresReview: "boolean",
    status: "string",
  },
};

/** Test a value against one of the internal type tokens. `?` allows null. */
function matchesType(value, token) {
  if (token === "any") return true;
  const nullable = token.endsWith("?");
  const base = nullable ? token.slice(0, -1) : token;
  if (value === null || value === undefined) return nullable;
  switch (base) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && !Array.isArray(value);
    default:
      return false;
  }
}

/**
 * Validate that an object matches the required shape for a model kind.
 * @param {'subscription'|'run'|'candidate'} kind
 * @param {object} obj
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateModelObject(kind, obj) {
  const errors = [];
  const spec = REQUIRED_KEYS[kind];
  if (!spec) {
    return { ok: false, errors: [`Unknown model kind: ${kind}`] };
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { ok: false, errors: [`Expected an object for kind '${kind}'`] };
  }
  for (const [key, token] of Object.entries(spec)) {
    if (!(key in obj)) {
      errors.push(`Missing required key: ${key}`);
      continue;
    }
    if (!matchesType(obj[key], token)) {
      errors.push(`Key '${key}' expected type ${token} but got ${obj[key] === null ? "null" : typeof obj[key]}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
