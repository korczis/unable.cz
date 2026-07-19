# Reasoning validation gates (PROMPT-10)

`scripts/dossier/reasoning/reasoning-validate.mjs`, wired into `npm run data:validate` → `npm run verify`. Fails on:

- assessment/conclusion (ASSESSED claim, FIN-ASSESS-*, R-*) without an inference record;
- inference without premises, without a supporting premise, or whose supporting premise does not resolve transitively to preserved evidence (broken chain);
- premise referencing an unknown or SUPERSEDED record;
- missing steps / primary explanation / declared assumptions (hidden assumption) / alternatives (single-explanation output) / distinguishing evidence / counterfactuals / uncertainty;
- executive finding without support, without evidence resolution, citing a claim the narrative never anchors, or naming a nonexistent inference;
- contradiction without a two-sided conflict-resolution record (silent picking);
- missing method-transparency metadata;
- dangling or unattributed edges in the generated graph; missing why-records.

Non-vacuity is itself tested: `scripts/dossier-reasoning.test.mjs` mutates a copy of reasoning.json (drops alternatives, premises on a superseded claim, deletes a conclusion's chain, empties assumptions) and asserts the validator exits 1. The `REASONING_JSON` env override exists solely for these tests.
