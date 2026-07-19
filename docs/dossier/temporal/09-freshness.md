# Freshness & staleness model (PROMPT-09 §12–§13)

`scripts/dossier/temporal/freshness.mjs` → `static/data/dossier/revalidation/{freshness,plan,monitoring}.json`.

## Principles

- **Evidence quality never decays.** A preserved, hashed artifact supports its record forever. What decays is *currentness* — the chance the real world moved since verification.
- **Deterministic evaluation.** State is computed AS OF an explicit date (default: the evidence cutoff), so rebuilding without new evidence never manufactures drift. `--as-of=YYYY-MM-DD` re-evaluates later; the published UI additionally compares `next_due_at` with the viewer's clock client-side and labels that comparison.
- **BLOCKED is sticky and honest.** A record whose own status is BLOCKED (CLM-58/ISIR) stays BLOCKED until the provider query actually succeeds; the most recent provider-run outcome decides provider state (a failed lustrace after a 200 landing page = PROVIDER_ERROR, not AVAILABLE).
- **Closed history is NOT_APPLICABLE.** A statutory role with `until`, or a relationship labelled historical, is immutable fact — revalidation cannot change it.

## Policies (intervals = how fast the world can plausibly move)

| policy | interval | due-soon | provider |
|---|---|---|---|
| ownership-statutory | 30 d | 7 d | ARES / Veřejný rejstřík (SRC-12) |
| corporate-identity | 90 d | 14 d | ARES / VR |
| financial-filings | 90 d | 30 d | Sbírka listin (FY2025 expected during 2026) |
| insolvency | 7 d | 2 d | ISIR (currently BLOCKED — HTTP 500) |
| dns-tls | 30 d | 7 d | DNS / crt.sh |
| contracts-register | 90 d | 14 d | Registr smluv |
| web-media | 180 d | 30 d | URL availability only; artifacts immutable |
| historical-immutable | — | — | NOT_APPLICABLE |

States: `FRESH → DUE_SOON → DUE → STALE` (past due by more than one interval), plus `BLOCKED`, `NOT_APPLICABLE`. `stale_reason` is always populated for non-fresh states.

## Relationship currentness (§13)

Per relationship: `evidence_quality` (the epistemic status — never decays), `currentness_state` (`CURRENT_AS_VERIFIED | REVALIDATION_DUE | HISTORICAL | UNSCHEDULED`), `last_verified_at`, `revalidation_due_at`, `expiry_policy`, `decay_reason`. Transparent policy rules — no exponential formula.

## Revalidation planner (§14)

Priority = materiality weight (HIGH 40 / MEDIUM 20 / LOW 5) + state weight (BLOCKED 35 / STALE 30 / DUE 25 / DUE_SOON 10) + min(dependents, 15). Every task carries reason, last verification, recommended provider, expected information gain, affected dependents, effort estimate and a stop condition ("success with preserved artifact OR 3 failures → stays BLOCKED with incident"). Current queue (as of 2026-07-18): REV-SRC-21 (ISIR, 77), REV-CLM-58 (75), REV-SRC-06 (LinkedIn, 45), REV-SRC-09 (crt.sh, 42) — all BLOCKED providers; nothing is past interval yet.

## Monitoring plan (§31)

`/dossier/monitoring/` states plainly that this is a PLAN: no background process runs; checks are manual `evidence:fetch` runs, each provably logged in `provider-runs.ndjson`. Wording used: "poslední dokončená kontrola / další doporučená kontrola" — never "actively monitored".
