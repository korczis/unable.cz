/*
 * Candidate classification + human-review gate for the monitoring loop.
 *
 * Pure functions only. No I/O, no mutation of inputs — every function returns a
 * NEW candidate object. This module encodes the review policy: material changes
 * (ownership / statutory-body) can NEVER reach PUBLISHED without an explicit
 * human approval record. Auto-approval is reserved for non-material fields.
 *
 * Depends on the FROZEN contract in ./model.mjs (CANDIDATE_STATUS).
 */
import { CANDIDATE_STATUS } from "./model.mjs";

/* --------------------------------------------------------- classification */

/**
 * Classify a candidate against its policy, deriving materiality + review need.
 *
 * A field listed in `policy.reviewRequiredFields` (e.g. statutoryBody, owners)
 * is ALWAYS material and ALWAYS requires human review — it can never be
 * auto-approved. Any other field is `normal` materiality and eligible for
 * auto-approval.
 *
 * Pure: does not mutate `candidate`; returns a shallow copy with `materiality`
 * and `requiresReview` set.
 *
 * @param {object} candidate a candidate record (see model.makeCandidate)
 * @param {{ reviewRequiredFields: string[] }} policy owning policy
 * @returns {object} a NEW candidate with materiality + requiresReview set
 */
export function classifyCandidate(candidate, policy) {
  const reviewFields = Array.isArray(policy?.reviewRequiredFields) ? policy.reviewRequiredFields : [];
  const isMaterial = reviewFields.includes(candidate.field);
  return {
    ...candidate,
    materiality: isMaterial ? "high" : "normal",
    requiresReview: isMaterial,
  };
}

/* ------------------------------------------------------------ review gate */

/**
 * Human-review gate: decide a candidate's status from the approval ledger.
 *
 * Rules:
 *   - requiresReview && matching `approve` decision  → APPROVED
 *   - requiresReview && matching `reject` decision   → REJECTED
 *   - requiresReview && NO matching decision         → PENDING_REVIEW (held)
 *   - !requiresReview && no explicit decision        → AUTO_APPROVED
 *   - !requiresReview && explicit approve/reject     → APPROVED / REJECTED
 *
 * A matching approval is one whose `candidateId === candidate.id`. Material
 * ownership/statutory changes therefore CANNOT leave PENDING_REVIEW without an
 * explicit human record — the gate never silently promotes them.
 *
 * Pure: does not mutate `candidate`; returns a shallow copy with `status` set.
 *
 * @param {object} candidate a classified candidate (has requiresReview)
 * @param {{ approvals: Array<{ candidateId: string, decision: 'approve'|'reject', reviewer: string, at: string }> }} ledger
 * @returns {object} a NEW candidate with updated `status`
 */
export function reviewGate(candidate, { approvals } = {}) {
  const records = Array.isArray(approvals) ? approvals : [];
  const match = records.find((a) => a && a.candidateId === candidate.id);

  let status;
  if (match && match.decision === "reject") {
    status = CANDIDATE_STATUS.REJECTED;
  } else if (match && match.decision === "approve") {
    status = CANDIDATE_STATUS.APPROVED;
  } else if (candidate.requiresReview) {
    // Material change with no matching decision: held, never published.
    status = CANDIDATE_STATUS.PENDING_REVIEW;
  } else {
    // Non-material change with no explicit decision: eligible for auto-approval.
    status = CANDIDATE_STATUS.AUTO_APPROVED;
  }

  return { ...candidate, status };
}

/* -------------------------------------------------------------- publish check */

/**
 * Whether a candidate is publishable as fact.
 *
 * True only for APPROVED, AUTO_APPROVED, or PUBLISHED. PENDING_REVIEW and
 * REJECTED are never publishable — this is the invariant the publish path relies
 * on to keep unreviewed material changes out of the published snapshot.
 *
 * @param {object} candidate a candidate record with a `status`
 * @returns {boolean}
 */
export function isPublishable(candidate) {
  return (
    candidate.status === CANDIDATE_STATUS.APPROVED ||
    candidate.status === CANDIDATE_STATUS.AUTO_APPROVED ||
    candidate.status === CANDIDATE_STATUS.PUBLISHED
  );
}
