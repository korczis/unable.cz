# PROMPT-10 final report — epistemic reasoning engine

Delivered 2026-07-19 (commits `9ac67e0` + this report). Statuses: IMPLEMENTED / VALIDATED / PARTIAL / NOT IMPLEMENTED.

| Mission item | Status | Evidence |
|---|---|---|
| Reasoning graph (observation→…→executive) | VALIDATED | 200 nodes / 463 edges, 7 layers, every edge carries `via` naming its canonical record; dangling/unattributed edges fail validation |
| Explainability ("what supports/contradicts me, who produced/uses me") | VALIDATED | `why.json` covers all 200 objects; every live claim tested to have a non-empty answer; claim pages render "Proč tomu věřit?" |
| Reasoning objects (observation, inference, assessment, conclusion, alternative, counter-evidence, assumption, uncertainty, gap, resolution, materiality) | IMPLEMENTED | node kinds in graph.json + authored records; gaps/resolutions reuse the PROMPT-09 lifecycle; counter-evidence = `contradicts` premises/edges |
| Inference chains, every step visible | VALIDATED | 20 chains with ordered steps; e.g. INF-CLM-45: filed rows → −14,8 % YoY → thin margin → media target ~100M → executive finding EXEC-06 |
| Alternative explanations (primary + alternative + distinguishing evidence + uncertainty) | VALIDATED | required per chain; validator fails single-explanation output; non-vacuity proven by mutation test |
| Counterfactuals (falsify/strengthen/weaken) | VALIDATED | required per chain; rendered as three labelled lists |
| Trust graph (supporting/contradicting/alternative/unknown) | IMPLEMENTED | per-node trust block in node shards + why-index roles |
| Source diversity instead of one number | VALIDATED | six dimensions + monoculture flag; test forbids a collapsed `confidence`/`score` field; INF-CLM-43 honestly flags register monoculture |
| Executive trace, no unsupported bullets | VALIDATED | 8 EXEC objects mirroring the Souhrn; claims cited must be anchored in the narrative (validated); rendered on /dossier/ and /dossier/reasoning/ |
| Graph mode "Reasoning", everything clickable | IMPLEMENTED | interactive layered DAG on /dossier/reasoning/ (cytoscape, click → why-panel with links); textual chains are the no-JS/accessible alternative. A mode inside the main relationship graph was not added — the reasoning DAG is a different topology and got its own surface |
| Reasoning history ("why did reasoning change") | VALIDATED | reasoning objects are snapshot members; r08 = layer publication (36 REASONING_ADDED, 8 material, tested); future edits diff as REASONING_CHANGED with field changes |
| Conflict resolution (never pick silently) | VALIDATED | CFL records for CON-01..03: both sides with refs, resolution state, distinguishing evidence, remaining uncertainty; missing record fails the build |
| LLM transparency | IMPLEMENTED | meta.method (authoredBy incl. Claude Fable 5 assistance, producedIn, inputs, limitations) published on index + every node shard; validated present. No build-time LLM generation exists — stated rather than simulated |
| Validation gates | VALIDATED | reasoning-validate.mjs in `npm run verify`; non-vacuity proven (4 mutation tests exit 1) |
| Final result (explainable, inspectable, auditable, reproducible, transparent) | VALIDATED | 133 unit tests + 116 Playwright checks green locally AND against production; snapshot proof PROVEN |

## Production proof

`reports/dossier-snapshot-proof.json`: **PROVEN** — snapshot `able-cz-public-2026-07-18-r08`, sha256 `3661838cbb7355c7…` identical across canonical / generated / built / deployed / rendered page; object counts match. Full browser suite (116 tests incl. reasoning journeys: claim → "why" → inference → counterfactuals; exec finding → trace; index → method/conflicts/DAG) passed against https://unable.cz.

## Notes & honest limitations

- r08's `unable_commit` is `null`: the snapshot was generated from a then-uncommitted tree and the engine refuses to attribute a snapshot to a commit that lacks its inputs (deliberate honesty rule added this pass); the state is committed at `9ac67e0`.
- Numeric belief propagation deliberately rejected — the status enum + diversity vector is the confidence model (docs/dossier/reasoning/00).
- VERIFIED claims have derived why-records but no authored inference nodes (their "why" is the evidence chain itself).
- Fixed en route: `client.js` citeify stateful-regex parity bug made token enhancement order-dependent; CLM tokens are now navigable claim links (claims-link.js), SRC tokens inspector chips; anchors are no longer injected inside buttons (invalid HTML).

## Reproduction

    npm run verify                                # all gates incl. reasoning + temporal
    node scripts/dossier/reasoning/reasoning-gen.mjs
    node scripts/dossier/reasoning/reasoning-validate.mjs
    npm run test:responsive                       # PW_BASE_URL=https://unable.cz for production
    node scripts/dossier/temporal/production-proof.mjs
