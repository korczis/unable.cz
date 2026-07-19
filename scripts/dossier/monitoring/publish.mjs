/*
 * Publish path for the due-diligence monitoring loop.
 *
 * Serialises the monitoring snapshot (runs, publishable candidates, provider
 * health) to JSON under `outDir` (caller passes static/data/dossier/monitoring).
 *
 * Two hard guarantees:
 *   1. REVIEW GATE — only candidates for which isPublishable() is true are
 *      written as facts. PENDING_REVIEW / REJECTED candidates are dropped and
 *      counted only (manifest.pendingReview). Unreviewed material ownership /
 *      statutory changes therefore never appear in the published data.
 *   2. NO SILENT OVERWRITE — each file is written atomically (tmp + rename) and
 *      only when its bytes differ from what is already on disk. Byte-identical
 *      targets are skipped and reported in `unchanged`.
 *
 * Depends on the FROZEN contract in ./model.mjs and ./candidate.mjs.
 */
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { CANDIDATE_STATUS } from "./model.mjs";
import { isPublishable } from "./candidate.mjs";

/* ------------------------------------------------------------- serializers */

/**
 * Summarise a run's provider executions to compact, publish-safe headers.
 * @param {Array<object>} executions
 * @returns {{ count: number, providers: string[], failures: number }}
 */
function summarizeProviderExecutions(executions) {
  const list = Array.isArray(executions) ? executions : [];
  return {
    count: list.length,
    providers: list.map((e) => e && e.provider).filter(Boolean),
    failures: list.filter((e) => e && (e.ok === false || e.error)).length,
  };
}

/**
 * Reduce a run record to a stable, publishable header.
 * @param {object} run
 * @returns {{ id: string, startedAt: string, state: string,
 *            providerExecutions: object, candidateId: string|null }}
 */
function runHeader(run) {
  return {
    id: run.id,
    startedAt: run.startedAt,
    state: run.state,
    providerExecutions: summarizeProviderExecutions(run.providerExecutions),
    candidateId: run.candidateId ?? null,
  };
}

/* --------------------------------------------------------- atomic no-clobber */

/**
 * Write `content` to `file` atomically, but only if it differs from the file
 * already on disk. Writes `${file}.tmp` then renames it over `file`.
 * @param {string} file absolute path
 * @param {string} content bytes to write
 * @returns {Promise<{ changed: boolean }>} changed=false when skipped (identical)
 */
async function writeIfChanged(file, content) {
  let existing = null;
  try {
    existing = await readFile(file, "utf8");
  } catch {
    existing = null; // missing file → must write
  }
  if (existing === content) {
    return { changed: false };
  }
  const tmp = `${file}.tmp`;
  await writeFile(tmp, content);
  await rename(tmp, file);
  return { changed: true };
}

/** Stable JSON encoding used for every published file (trailing newline). */
function encode(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

/* ------------------------------------------------------------------ publish */

/**
 * Publish the monitoring snapshot to `outDir`.
 *
 * @param {object} params
 * @param {Array<object>} params.runs run records (newest-relevant order preserved)
 * @param {Array<object>} params.candidates classified + gated candidate records
 * @param {Array<object>} params.health provider health records ({ provider, failureCount, ... })
 * @param {object} params.subscription owning subscription (target, policyId, …)
 * @param {string} params.outDir output directory (e.g. static/data/dossier/monitoring)
 * @param {string} params.now ISO timestamp stamped into the manifest
 * @returns {Promise<{ written: string[], unchanged: string[], skippedPending: number }>}
 */
export async function publishMonitoring({ runs, candidates, health, subscription, outDir, now }) {
  const runList = Array.isArray(runs) ? runs : [];
  const candidateList = Array.isArray(candidates) ? candidates : [];
  const healthList = Array.isArray(health) ? health : [];

  await mkdir(outDir, { recursive: true });

  /* --- review gate: split publishable facts from held/rejected candidates --- */
  const publishable = candidateList.filter((c) => isPublishable(c));
  const pendingReview = candidateList.filter((c) => c.status === CANDIDATE_STATUS.PENDING_REVIEW);
  const skippedPending = candidateList.length - publishable.length;

  /* --- run headers (latest first, capped at 20 for summary) --- */
  const headers = runList.map(runHeader);
  const latestRun = runList.length > 0 ? runList[runList.length - 1] : null;
  const lastHeaders = headers.slice(-20).reverse();

  /* --- payloads --- */
  const manifest = {
    generatedAt: now,
    target: subscription?.target ?? null,
    policyId: subscription?.policyId ?? null,
    counts: {
      runs: runList.length,
      candidates: publishable.length,
      publishedCandidates: publishable.length,
      pendingReview: pendingReview.length,
      health: healthList.length,
    },
    note: "Data shown represents the latest published monitoring snapshot.",
  };

  const summary = {
    latestRunState: latestRun ? latestRun.state : null,
    dueState: {
      lastRunAt: subscription?.lastRunAt ?? null,
      nextDueAt: subscription?.nextDueAt ?? null,
      failureCount: subscription?.failureCount ?? 0,
    },
    runs: lastHeaders,
  };

  const runsPayload = headers;

  const candidatesPayload = publishable;

  const healthPayload = healthList.map((h) => ({
    provider: h.provider ?? null,
    ...h,
    failureCount: typeof h.failureCount === "number" ? h.failureCount : 0,
  }));

  /* --- write with no silent overwrite --- */
  const files = [
    ["manifest.json", manifest],
    ["summary.json", summary],
    ["runs.json", runsPayload],
    ["candidates.json", candidatesPayload],
    ["health.json", healthPayload],
  ];

  const written = [];
  const unchanged = [];
  for (const [name, payload] of files) {
    const file = join(outDir, name);
    const { changed } = await writeIfChanged(file, encode(payload));
    if (changed) written.push(file);
    else unchanged.push(file);
  }

  return { written, unchanged, skippedPending };
}
