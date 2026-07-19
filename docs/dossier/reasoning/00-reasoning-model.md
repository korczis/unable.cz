# Epistemic reasoning engine (PROMPT-10)

## Mission mapping

Every object answers "why should I believe this?" mechanically:

- **Reasoning graph** — `static/data/dossier/reasoning/graph.json`: 200 nodes / 463 edges across layers observation → evidence → assertion → claim → assessment/inference → conclusion → executive finding. Every edge carries `via` naming the canonical record it derives from; the validator fails a dangling or unattributed edge.
- **Derivation vs. authorship** — lower layers are DERIVED (evidence.json claimEvidence, extraction assertions, provider runs, claim sources). Only the analytical content is authored, in `data/dossier/able/reasoning.json`: 20 inference chains (10 ASSESSED claims, 4 FIN-ASSESS, 6 risks), 8 executive findings, 3 conflict resolutions, 5 declared assumptions. Authored refs must resolve to real records; superseded claims are forbidden as premises.
- **Explainability** — `why.json` holds, for every one of the 200 objects: supporting refs, contradicting refs, contextualizing refs, producing inference, downstream users, assumptions, uncertainty, alternatives, counterfactuals.
- **Alternative explanations** — every chain has ≥1 alternative WITH the evidence needed to distinguish it (validated).
- **Counterfactuals** — falsify / strengthen / weaken lists per chain (validated non-empty).
- **Trust graph** — per chain: supporting/contradicting/contextualizing subsets + alternatives count + unknowns.
- **Source diversity** — six separate dimensions (sources, evidence spans, documents, upstream families, jurisdictions, retrieval time span) with an explicit `monoculture` flag; never collapsed into a single confidence number (tested).
- **Executive trace** — every Souhrn-level bullet is an EXEC-* object with full support lists; a CLM cited by an executive finding must actually be anchored in the narrative (validated). Rendered on /dossier/ and /dossier/reasoning/.
- **Reasoning history** — reasoning objects are temporal snapshot members (r08 = publication of the layer: 36 REASONING_ADDED change records, 8 material). A changed chain becomes REASONING_CHANGED with field diffs — "why did reasoning change" is answerable from the change ledger.
- **Conflict resolution** — every contradiction has an explicit two-sided record with resolution state and remaining uncertainty; silent picking fails validation.
- **Method transparency** — reasoning.json meta.method (authoredBy incl. Claude Fable 5 assistance, producedIn, inputs, limitations) is published on every node shard and the index; validation fails if absent.

## Routes

`/dossier/reasoning/` (index: method, exec trace, chains, conflicts, assumptions, interactive DAG with textual alternative), `/dossier/reasoning/inf-*` (20 chain pages), `/dossier/reasoning/exec-*` (8 finding pages). Claim pages carry a derived "Proč tomu věřit?" section.

## Honest non-goals in this pass

- Numeric belief propagation (deliberate: the epistemic-status enum + diversity vector IS the confidence model of this dossier).
- Reasoning nodes for every VERIFIED claim (their "why" is the evidence chain itself, already exposed via why.json + evidence layer).
- Automated LLM runtime provenance (no assessments are generated at build time; all are authored records — documented in meta.method).
