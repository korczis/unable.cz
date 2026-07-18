# 20 — Adversarial implementation audit (planner)

**Date:** 2026-07-18. Assume the planner cheats; try to catch it.

| Probe | Finding | Evidence |
|---|---|---|
| Synthetic nodes/edges? | **No.** Planner reads `dossier.json` + derived gaps/frontier only; adds no entities/edges. | `planner.mjs` inputs |
| Hardcoded chart values? | **No.** The UI dl/tables iterate the derived JSON; counts come from `_export`. | `templates/dossier.html` |
| Unsupported confidence? | **No.** No confidence is raised; independence is *lowered* to distinct-upstream truth. | diversity.json |
| Duplicate sources counted as independent? | **No — this is the whole point.** SRC-10+SRC-11 → 1 upstream. Gate `PLAN_DIV_IMPOSSIBLE` + test. | docs/09 |
| Monoculture shown as corroborated? | **No.** Single-upstream CORROBORATED claims carry a caveat; gate `PLAN_MONOCULTURE_UNFLAGGED`. | diversity.json notes |
| Failed queries treated as absence? | **N/A.** No queries were run this pass; nothing is marked "no evidence" from a failure. | — |
| Hypotheses as facts? | **No.** Unchanged from derive layer; gate `HYP_AS_FACT`. | — |
| Questions without tasks? | **No.** Each question has `linkedTask`; gate `PLAN_Q_NO_TASK`. | questions.json |
| Tasks without originating gap? | **No.** Every task `derivedFrom` a gap/contradiction; gate `PLAN_TASK_NO_ORIGIN`. | tasks.json |
| Tasks with no executable provider? | **Honest gap.** Tasks name a recommended public source but **execute nothing** — no live provider is wired (see depth/19). Labelled, not hidden. | tasks.json `recommendedSource` |
| Agent output treated as evidence? | **N/A.** No agent ran; nothing agent-authored enters the case. | — |
| Edges more certain than evidence? | **No.** `verificationState` derived from status + independence; single-upstream CORROBORATED → `single_upstream`, not `verified`. | verification.json |
| UI buttons with no behavior? | **No new controls.** The section is static tables + a dl. | template |
| Docs overstate implementation? | **No.** 19 labels live execution NOT IMPLEMENTED; run-diff labelled baseline-only. | 19 |
| Unknown rendered as zero? | **No.** `changesSincePrevious: null` (not 0) for the baseline run. | manifest.json |

**Material defects found & removed:** none synthetic. The one honest limitation —
tasks recommend sources but cannot execute them — is stated in every report, not
concealed. The independence model is intentionally conservative (whole register =
one authority) so corroboration is never overstated.
