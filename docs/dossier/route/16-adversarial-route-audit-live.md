# 16 — Adversarial route audit (against production)

**Date:** 2026-07-18. Run against the **live** `https://unable.cz/dossier/` after
the full cockpit deploy (overview, navigator, deep-links, inspector, search,
graph-sync, financial drill-down, lenses, comparison). Every §44 probe, checked
in-browser against the shipped bytes — assume it cheats.

## Findings

| Probe | Result | Evidence |
|---|---|---|
| **Inconsistent counts (§36)** | **DEFECT — fixed.** Overview said 58 claims; the claims table renders **49** (9 superseded claims are an audit trail the table hides). The overview counted all 58. | live: overviewClaims=58, claimsTableRows=49 |
| Dead links / dead-end objects | none | 279 record links resolve; entity backlinks jump between entities |
| Unclickable financial values | none | 15 `.fin-drill` + 10 `.cmp-val`, all open the financial inspector |
| Charts that don't drill | none | overview metrics + comparison values drill to records/inspector |
| Inconsistent lens (hides data) | none | lenses foreground via `.lens-in`; no section `display:none` |
| Deep links fail on refresh | none | `?claim=`, `?source=`, `?entity=`, `?fin=`, `?lens=` all restore on load |
| Buttons without behavior | none | every metric/chip/nav/record is wired (browser-exercised) |
| Analyst-only data in public payload | none | page reads the published `#dossier-data`; no new data |
| Private data leak (rodné číslo) | none | regex over live `document.body.innerText` → 0 |
| Evidence modal stuck (the earlier bug) | fixed & holds | `#evd-inspector` computes `display:none` in production |
| Console errors | none | live page load clean |

## The fix

`cockpit.js` and `inspector.js` now count/search **live** claims only
(`!c.superseded`), matching the claims table's `{% if not c.superseded %}`
filter. A build-time test (`dossier-cockpit.test.mjs`) pins that both the table
and the overview exclude superseded, so the counts can't silently diverge again
(§36 / §38 "displayed count differs from canonical records").

Superseded claims remain reachable by direct id (`?claim=CLM-xx`) — they are an
audit trail (fact/assessment splits), not deleted; they are simply not offered as
current findings or counted as such.

## Verdict

One real count-consistency defect found against production, fixed with a
regression test. No dead ends, no inert controls, no privacy leak, no stale
evidence-modal bug. The cockpit surfaces are all wired to canonical data.
