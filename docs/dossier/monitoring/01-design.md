# PROMPT-11 §3 — Bounded First Monitoring Loop (Design)

> **Repo**: `unable.cz` (Node.js `.mjs` + Zola static dossier) · branch `main`
> **Continues**: [`00-current-state-audit.md`](./00-current-state-audit.md) (Phase-1 audit)
> **Status**: DESIGN of the single bounded loop (§70 "first make ONE complete loop correct").
> **Governing principle**: audit, reuse and extend — do not rebuild. No monitoring capability is
> claimed IMPLEMENTED or VALIDATED by this document; it specifies the loop the next phase builds.
> **Language**: technical identifiers in English (per CZE), prose consistent with the audit doc.

## 1. Scope of loop-1

One policy, one target, fully correct, bounded, reproducible — before any generalization:

- **Policy A — Corporate identity** (`cz-ares` / `cz-justice-or`), cadence `30d`.
- **Target** = seed company **Able.cz only**.
- Deterministic `due-state` derived from the **existing** temporal freshness / revalidation records
  (`static/data/dossier/revalidation/{freshness,monitoring,plan}.json`) — reuse, do NOT recompute.
- Output = the latest published monitoring snapshot under `static/data/dossier/monitoring/`.

## 2. Domain model

First-class objects, kept **separate from canonical truth** (`data/dossier/able/dossier.json`):

| Object | Meaning | Key fields |
|--------|---------|-----------|
| `MonitoringPolicy` | Reusable rule set. Loop-1 ships exactly one: **Policy A**. | `id`, `providers[]`, `cadence_days`, `due_rule`, `materiality_rule`, `review_policy`, `publication_policy`, `budget` (max provider calls) |
| `MonitoringSubscription` | Per-target enrolment of a policy. Loop-1: Able.cz. | `target`, `policy_id`, `next_due_at`, `failure_count`, `last_completed_check`, `discovery_chain` |
| `MonitoringRun` | One execution of a subscription. | `id`, `state`, `started_at`, `provider_executions[]`, `observations[]`, `candidates[]`, `budget_used` |
| `ProviderExecution` | One bounded provider call within a run. | `provider`, `outcome` (`OK` / `FAILED` / `SKIPPED`), `artifact_ref`, `error` |
| `ChangeCandidate` | Pre-approval proposed change vs current temporal snapshot. **Not** canonical truth. | `id`, `field`, `old`, `new`, `materiality`, `review_state` (`AUTO_OK` / `NEEDS_HUMAN` / `APPROVED` / `REJECTED`), `evidence_ref` |
| `HealthRecord` | Loop health projection. | `open_failures`, `circuit_state`, `coverage`, `last_snapshot_at` |

### States

- `MonitoringRun.state`: `PLANNED → OBSERVING → DIFFING → REVIEW → PUBLISHED` (terminal:
  `PUBLISHED`, or `NO_CHANGE`, or `FAILED`). Restart-safe / idempotent / leased / budgeted.
- `ChangeCandidate.review_state`: `AUTO_OK` | `NEEDS_HUMAN` | `APPROVED` | `REJECTED`.
  Ownership / statutory / role changes are forced to `NEEDS_HUMAN` by `materiality_rule`.

## 3. Deterministic bounded cycle

```
providers → observe → diff → candidate → review → publish
```

1. **providers** — resolve Policy A's provider plan for Able.cz; enforce the per-run **budget**
   (bounded number of provider calls). Loop-1 reads **deterministic fixtures**, no live network.
2. **observe** — normalize each `ProviderExecution` into an observation + preserved artifact ref.
   A `FAILED`/`SKIPPED` provider yields **no observation** (never a synthetic negative).
3. **diff** — compare observations against the **current temporal snapshot**
   (`static/data/dossier/snapshots/`), reusing the temporal semantic-diff primitives.
4. **candidate** — emit `NO_CHANGE`, or a `ChangeCandidate` per changed field (kept out of canonical
   truth). Materiality classified by `materiality_rule`.
5. **review** — `AUTO_OK` candidates may publish; `NEEDS_HUMAN` (ownership/statutory) **block**
   until a human approves. No silent overwrite of published records.
6. **publish** — on approval, emit a temporal revision via the existing `changes-gen` / snapshot path
   + reasoning-impact via `reasoning-gen`, then write the monitoring snapshot
   (`manifest,summary,runs,candidates,health.json`) stamped
   `Data shown represents the latest published monitoring snapshot.`

## 4. Key safety invariants (non-negotiable)

- **provider-failure ≠ negative-finding** — a `FAILED`/`SKIPPED` `ProviderExecution` produces no
  observation and no candidate. Absence of data is never rendered as an adverse conclusion.
- **no first-run mass fabrication** — the first run over a fresh target does **not** manufacture a
  wave of "changes". With no prior snapshot to diff, the baseline is recorded, not diffed into
  candidates.
- **ownership / statutory changes require human review before publish** — `materiality_rule` forces
  these candidates to `NEEDS_HUMAN`; they never auto-publish.
- **no silent overwrite** — published canonical records are only revised through the temporal
  `changes-gen` / snapshot path after approval; candidates never mutate truth in place.
- **no live network in loop-1** — providers read **deterministic fixtures**, making the loop
  reproducible and CI-safe. Re-running over unchanged fixtures yields zero new
  artifacts/candidates/alerts (idempotency proof).
- **bounded provider calls** — every run enforces Policy A's `budget`; no unbounded fan-out, no
  recursive discovery in loop-1.

## 5. How to run

```bash
# Run the bounded loop once (deterministic fixtures, no live network):
node scripts/dossier/monitoring/run.mjs

# Force an immediate run regardless of due-state:
MONITOR_NOW=1 node scripts/dossier/monitoring/run.mjs

# Validate the published monitoring snapshot (shape + invariants):
node scripts/dossier/monitoring/validate.mjs
```

Outputs land in `static/data/dossier/monitoring/{manifest,summary,runs,candidates,health}.json`
and are projected by the `/dossier/monitoring/` route (see
[`content/dossier/monitoring/_index.md`](../../../content/dossier/monitoring/_index.md)).

> **Note (honesty)**: the `run.mjs` / `validate.mjs` scripts and the `static/data/dossier/monitoring/`
> data are the **build target of the next phase**; they do not exist in-repo yet (verified absent in
> the audit, §3). This document specifies them; it does not claim them shipped.

## 6. What loop-1 deliberately does NOT do yet

To keep scope honest (audit §4, §67 "a cron entry is not a monitoring system"):

- **No live registry HTTP** — providers are deterministic fixtures only; no real ARES / justice.cz
  network calls.
- **No scheduler / queue / worker** — recurrence is a **manual `node` run**, not a restart-safe
  persistent job. "Continuous monitoring" is not claimed.
- **No recursive discovery** — no traversal of newly discovered related entities; `discovery_chain`
  exists as a field but stays length-1.
- **No multi-target / multi-policy** — exactly one policy (A) and one target (Able.cz). Policies B–E
  and additional targets/providers come only after loop-1 is proven correct (§70).
- **No auto-publish of material changes** — ownership/statutory candidates always wait for a human.

## 7. File references

| Concern | File |
|---------|------|
| Phase-1 audit (continued here) | `docs/dossier/monitoring/00-current-state-audit.md` |
| Zola route (stub, `render = false`) | `content/dossier/monitoring/_index.md` |
| Reused freshness / due-state | `static/data/dossier/revalidation/{freshness,monitoring,plan}.json` |
| Reused snapshots + semantic diff | `static/data/dossier/snapshots/`, `scripts/dossier/temporal/` |
| Reused reasoning-impact | `scripts/dossier/reasoning/reasoning-gen.mjs`, `static/data/dossier/reasoning/` |
| Canonical truth (never overwritten by candidates) | `data/dossier/able/dossier.json` |
| Loop runner (next phase, absent) | `scripts/dossier/monitoring/run.mjs` |
| Snapshot validator (next phase, absent) | `scripts/dossier/monitoring/validate.mjs` |
| Published snapshot (next phase, absent) | `static/data/dossier/monitoring/{manifest,summary,runs,candidates,health}.json` |
| Render template to bind (next phase, absent) | `templates/dossier/monitoring-index.html` (mirror `dossier/reasoning-index.html`) |
