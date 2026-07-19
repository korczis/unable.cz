/*
 * Monitoring provider harness — first bounded loop (fixtures only).
 *
 * This is the deliberate, honest starting point of the due-diligence
 * monitoring loop: providers do NOT touch the network. Each provider reads a
 * deterministic recorded fixture so the whole loop is reproducible and can be
 * diffed against the published dossier with zero non-determinism. Live HTTP is
 * a later phase; until then, absence of a fixture is an availability fact, not
 * a data change.
 *
 * INVARIANT (non-negotiable): a provider that is unavailable or errored is a
 * HEALTH event only (ok:false). It is NEVER converted into a "field changed /
 * removed / negative" observation. Data changes may be derived ONLY from a
 * successful (ok:true) observation carrying fields. Everything else yields
 * observation:null so no downstream diff can manufacture drift from a failure.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Providers this loop knows how to run. */
export const KNOWN_PROVIDERS = ["cz-ares", "cz-justice-or"];

const LABELS = {
  "cz-ares": "ARES (Czech business register)",
  "cz-justice-or": "Justice.cz OR (Commercial Register)",
};

/** Human-readable label for a provider id (falls back to the id itself). */
export function providerLabel(id) {
  return LABELS[id] || id;
}

/**
 * Run a single provider against a recorded fixture.
 *
 * @param {string} providerId - e.g. "cz-ares"
 * @param {object} ctx
 * @param {string} ctx.target       - target slug, e.g. "able-cz"
 * @param {string} ctx.fixturesDir  - directory holding `${providerId}.${target}.json`
 * @param {{now:string}} ctx.clock  - deterministic clock; `now` is an ISO string.
 *                                     Date.now() is intentionally NOT called here.
 * @returns {Promise<{providerId:string, ok:boolean,
 *   status:'OK'|'UNAVAILABLE'|'ERROR', fetchedAt:string,
 *   observation:({providerId:string, fields:object}|null), error:(string|null)}>}
 */
export async function runProvider(providerId, { target, fixturesDir, clock }) {
  const fetchedAt = clock.now;
  const base = {
    providerId,
    ok: false,
    status: "UNAVAILABLE",
    fetchedAt,
    observation: null,
    error: null,
  };

  const fixturePath = join(fixturesDir, `${providerId}.${target}.json`);

  let raw;
  try {
    raw = await readFile(fixturePath, "utf8");
  } catch (err) {
    // Missing fixture is an availability fact, never a negative finding and
    // never a thrown error. A file that exists but cannot be read for another
    // reason is a provider ERROR (still health-only, observation stays null).
    if (err && err.code === "ENOENT") {
      return { ...base, status: "UNAVAILABLE", error: "fixture-missing" };
    }
    return { ...base, status: "ERROR", error: `fixture-read-failed: ${err.code || err.message}` };
  }

  let fixture;
  try {
    fixture = JSON.parse(raw);
  } catch {
    // A corrupt fixture is a health/ERROR event — not a data change.
    return { ...base, status: "ERROR", error: "fixture-parse-failed" };
  }

  const status = fixture && typeof fixture === "object" ? fixture.status : undefined;

  if (status === "OK") {
    const fields = fixture.fields;
    if (!fields || typeof fields !== "object") {
      // OK without fields is not a usable observation — treat as ERROR health,
      // never as "all fields removed".
      return { ...base, status: "ERROR", error: "fixture-ok-missing-fields" };
    }
    return {
      providerId,
      ok: true,
      status: "OK",
      fetchedAt,
      observation: { providerId, fields },
      error: null,
    };
  }

  if (status === "UNAVAILABLE" || status === "ERROR") {
    // Propagate the recorded health state. observation stays null so no diff
    // can read a failure as a field change.
    return {
      ...base,
      status,
      error: fixture.error ?? status.toLowerCase(),
    };
  }

  // Unknown / missing status field — do not guess a data state. Report ERROR.
  return { ...base, status: "ERROR", error: "fixture-unknown-status" };
}
