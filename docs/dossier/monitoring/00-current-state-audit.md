# PROMPT-11 §2 — Current-State Monitoring Audit

> **Repo**: `unable.cz` (Node.js + Zola static dossier) @ `9393e0d` (branch `main`)
> **Audit date**: 2026-07-19 · **Method**: read-only inspection of git history, `scripts/dossier/**`,
> `data/dossier/**`, `static/data/**`, `package.json`. No files mutated during the audit.
> **Governing principle**: audit, reuse and extend — do not rebuild (PROMPT-11 §1).

## 1. Ground truth (what actually exists)

| Layer | Reality | Evidence |
|-------|---------|----------|
| Stack | **Node.js `.mjs` scripts + Zola static site + Playwright e2e** (not Python, not the Prismatic Elixir platform) | `scripts/dossier/*.mjs`, `playwright.config.mjs`, `config.toml` |
| Canonical data | single provenance-backed source `data/dossier/able/dossier.json` ("INVENTS NOTHING; every output computed from sourced records") | `planner.mjs` header |
| Pipeline | `export.mjs → derive.mjs → planner.mjs → temporal/ → reasoning/` | `scripts/dossier/`, `package.json` build scripts |
| Prior prompts complete | **PROMPT-09 (temporal) and PROMPT-10 (reasoning) are DONE** | git log: `9ac67e0 feat(dossier): epistemic reasoning engine (PROMPT-10)`, `068d761 …temporal… (PROMPT-09)` |
| Published static data | `static/data/able-cz/{planner,…}` + `static/data/dossier/{changes,claims,finance,history,reasoning,revalidation,snapshots}` | `ls static/data/dossier` |

## 2. Reusable foundations (extend, do NOT rebuild)

| PROMPT-11 need | Already provided by | Where |
|----------------|---------------------|-------|
| Due-state / freshness / staleness | **temporal freshness + revalidation** | `scripts/dossier/temporal/freshness.mjs`, `static/data/dossier/revalidation` |
| Immutable snapshots + semantic diff + change ledger | **temporal** | `temporal/{snapshots,diff,changes-gen,routes-gen}.mjs`, `static/data/dossier/{snapshots,changes,history}` |
| Provider/source planning, **source-independence (upstream authority, monoculture flag)**, verification tasks, questions, information-gain-adjacent priority | **planner.mjs** | outputs `static/data/able-cz/planner/{sources,diversity,questions,tasks,verification,manifest}.json` |
| Reasoning-impact propagation on change | **reasoning engine** | `scripts/dossier/reasoning/reasoning-gen.mjs`, `static/data/dossier/reasoning` |
| Production-proof (prod vs snapshot) | **temporal** | `temporal/production-proof.mjs` |
| Validation harness | `validate.mjs`, `temporal-validate.mjs`, `reasoning-validate.mjs`, `data:validate` | `package.json` |
| Build/deploy | `data:build`, `temporal:build`, `temporal:bootstrap`, `build` npm scripts; Zola; Playwright e2e | `package.json`, `e2e/` |

**Conclusion**: PROMPT-11 is a *layer on top of existing planner + temporal + reasoning*, not a new
scheduler/provider/snapshot system. The static-publication, snapshot, freshness, source-independence
and reasoning-impact primitives already exist and must be reused.

## 3. Gaps (what PROMPT-11 must add)

Not present yet (verified absent): `content/dossier/monitoring/`, `static/data/dossier/monitoring/`,
and any first-class monitoring domain objects. Specifically missing vs the §3 domain model:

- **MonitoringPolicy / Subscription** — planner has tasks/verification but no persisted *policy*
  (cadence, due_rule, materiality_rule, recursion/budget limits, review/publication policy) or
  *subscription* (per-target enrolment with `next_due_at`, `failure_count`, `discovery_chain`).
- **MonitoringRun / Attempt / ProviderExecution** lifecycle (PLANNED→…→PUBLISHED) with restart-safe,
  idempotent, leased, budgeted execution + retry/backoff + circuit breakers.
- **ChangeCandidate** as a first-class object *separate from canonical truth*, with validation,
  auto-approval vs human-review gates, and publication gates. (temporal `changes` records exist but
  are post-approval diffs, not pre-approval candidates.)
- **Alert / Incident / HealthRecord / BacklogItem / Coverage** objects + routes.
- Monitoring **routes** (§40-44) + graph/timeline/finance/reasoning integration modes.
- Bounded **recursive discovery** with hard limits + stop reasons; **information-gain** banding as an
  explicit component model (planner has diversity/independence but not the full §11 component vector).

## 4. Risk flags found (adversarial pre-check, §66)

- No scheduler/worker/queue exists in-repo → monitoring "recurrence" would today be **manual `node`
  runs**, not restart-safe persistent jobs. Any claim of "continuous monitoring" must be qualified as
  *manual-run + static-publish* until a real scheduler is wired (§67: "a cron entry is not a
  monitoring system").
- Static site is Zola/Pages: monitoring is a **static projection of operational records** (§45) — the
  loop's provider execution must run outside publication and only approved snapshots publish.
- `planner.mjs` already models **source-independence/monoculture** — reuse it; do NOT recount
  aggregator mirrors of one Czech register as independent corroboration (§36).

## 5. Bounded first loop (per §70 — "first make ONE complete loop correct")

Recommended first wedge (one policy, one target, fully correct, bounded, reproducible) before
generalizing:

- **Policy A — Corporate identity (cz-ares / cz-justice-or), cadence 30d**, target = seed company
  Able.cz only.
- One `MonitoringSubscription` (Able.cz) with deterministic `due-state` derived from existing temporal
  freshness/revalidation records (reuse, don't recompute).
- One `MonitoringRun` producing an explicit provider plan + a preserved artifact + a normalized
  observation, then a **no-change or ChangeCandidate** compared against the current temporal snapshot.
- Candidate → validation → (ownership/role change ⇒ **human-review required**) → on approval, emit a
  temporal revision via the existing `changes-gen`/snapshot path + reasoning-impact via reasoning-gen.
- Publish `static/data/dossier/monitoring/{manifest,summary,runs,health}.json` + a `/dossier/monitoring/`
  route stating `Data shown represents the latest published monitoring snapshot.`
- Idempotency proven by re-running the loop over unchanged source → zero new artifacts/candidates/alerts.

Only after that single loop is correct, persistent-capable, explainable and reproducible do we
generalize across policies B-E, targets and providers (§70).

## 6. Scope & honesty statement

PROMPT-11 is a 70-section mission (domain model, execution engine, change pipeline, review/approval,
publication gates, ~11 routes, graph/timeline/finance/reasoning integration, unit+integration+browser
tests, CI/CD, deploy, production proof, adversarial audit). This document is the mandated **§2 Phase-1
audit** and the honest starting point: it establishes what exists (reusable planner+temporal+reasoning),
what is genuinely missing (the monitoring layer + routes), and the bounded first loop to build first.
Per the mission's own anti-theater rules, no monitoring capability is claimed as IMPLEMENTED or
VALIDATED here — only the audit is complete. The next step is Phase-2 domain model + the single
bounded loop above.
