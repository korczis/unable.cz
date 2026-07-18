# Dossier — investigation planner & source intelligence

Added 2026-07-18. Turns the dossier's sources into active investigation objects
and makes source **independence** machine-checkable. Derived from the sourced
records — inventing nothing, executing no live provider (that stays honestly
labelled NOT IMPLEMENTED).

## The one idea that matters

"CORROBORATED" in this case usually means two aggregator mirrors of the **same**
Czech register — one authority, not two. This layer counts **distinct upstream
authorities** per claim, not source records, and the build **fails** if a copy is
ever counted as independent corroboration. Of 27 claims, 24 rest on a single
upstream and 14 on the company's own pages only — now visible, not buried.

## Documents

- **[00 — Current-state audit](00-current-state-audit.md)** — what the case held; defects targeted.
- **[01 — Capability map](01-prismatic-capability-map.md)** — Prismatic planner/agent reality (not wired).
- **[02 — Prioritization methodology](02-prioritization-methodology.md)** — stored dimensions + EIG, no hidden score.
- **[03 — Source intelligence registry](03-source-intelligence-registry.md)** — sources as investigation objects.
- **[09 — Source diversity & independence](09-source-diversity.md)** — the upstream-authority rule (core).
- **[19 — Final report](19-final-implementation-report.md)** — status-labelled results.
- **[20 — Adversarial audit](20-adversarial-implementation-audit.md)** — proof nothing is faked.

## Exports (public, gate-checked)

`static/data/able-cz/planner/{sources,diversity,questions,tasks,verification,manifest}.json`,
consumed by the "Nezávislost zdrojů a ověření" section of `/dossier/`.

Status vocabulary: **IMPLEMENTED / VALIDATED / PARTIAL / BLOCKED / REJECTED / NOT IMPLEMENTED**.
