# 01 — Prismatic capability map (planner pass)

**Date:** 2026-07-18. Which Prismatic planner/agent capabilities exist, and
whether they are used here. This consolidates the prior deep audits
([depth/00](../depth/00-prismatic-deep-capability-audit.md),
[depth/19](../depth/19-adversarial-implementation-audit.md)) for the planner scope.

| Capability the brief asks for | Prismatic reality | Used here? |
|---|---|---|
| Investigation orchestrator / task queue | **WORKING** — `apps/prismatic_osint_core/.../investigation/orchestrator.ex` + Oban queues | **No** — not wired; planner tasks are derived statically |
| Hypothesis engine | **WORKING** — `apps/prismatic_osint_core/.../hypothesis/hypothesis.ex` (+ ACH strategies) | **No** — hypotheses derived in `derive.mjs` |
| Contradiction objects | **WORKING** — `apps/prismatic_nabla/.../contradiction.ex` | **No** — CON-01/02 hand-authored in the case |
| Source/provider adapters (ARES/justice/ISIR) | **WORKING** (ARES reference-grade) | **No live call** this pass |
| Confidence / scoring | **WORKING** — `dd_score_cards` | **No** — ordinal ASSESSED locally |
| Nabla ClaimMap / TraceGraph | **ABSENT by those names** (ReasoningTrace is the closest) | **No** |
| Meilisearch derived index | **WORKING** in Prismatic | **No** — static tables only |

**Verdict.** Prismatic genuinely has the planner/hypothesis/contradiction/provider
machinery this brief describes — but unable.cz does **not** execute it (proved in
depth/19: zero engine references at runtime/build). The planner implemented here
is the **honest static derivation**, schema-aligned to those Prismatic
abstractions, so a future serializer over `dd_*` + the Oban orchestrator could
replace it without changing the export shapes. Live wiring = **NOT IMPLEMENTED**.
