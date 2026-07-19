+++
title = "Monitoring — běhy a změny (Able.cz DD)"
description = "Provozní záznam monitorovacích běhů dossieru Able.cz: kdy proběhla revalidace, se kterými poskytovateli, zdraví zdrojů a materiální změny čekající na lidské schválení. Statická projekce posledního publikovaného snapshotu — poctivě označeno."
template = "dossier/monitoring-runs.html"
weight = 46

[extra]
manifest_path = "static/data/dossier/monitoring/manifest.json"
summary_path = "static/data/dossier/monitoring/summary.json"
runs_path = "static/data/dossier/monitoring/runs.json"
candidates_path = "static/data/dossier/monitoring/candidates.json"
health_path = "static/data/dossier/monitoring/health.json"
+++

Tato stránka zobrazuje **poslední publikovaný monitorovací snapshot** — nikoli živý běh.
Monitorovací smyčka je deterministická, ohraničená a reprodukovatelná: pro každý běh se
zaznamená, které registry byly dotázány (`cz-ares`, `cz-justice-or`), jejich zdraví a jaké
materiální změny byly detekovány proti poslední pozorované základně.

**Zásady zobrazení (evidence-first):**

- **Selhání poskytovatele není negativní zjištění.** Nedostupný registr se zaznamená jako
  zdravotní událost; nikdy se neinterpretuje jako „údaj zmizel" ani jako změna.
- **Žádná fabrikace při prvním běhu.** Bez předchozí základny se nevytvoří žádné kandidátské
  změny — bootstrap vždy končí stavem `NO_CHANGE`.
- **Materiální změny až po lidském schválení.** Změny vlastníků nebo statutárního orgánu se
  nikdy nezveřejní automaticky; zůstávají ve stavu `PENDING_REVIEW` a zde se počítají pouze
  souhrnně, dokud je člověk neschválí.
- **Bez tichého přepisu.** Publikace je idempotentní; identický snapshot se nepřepisuje.

Rozdíl oproti stránce [Plán monitoringu](@/dossier/monitoring.md): tam je *plán* (sledované
subjekty, kadence, poskytovatelé); zde je *provozní záznam skutečně provedených kontrol a
jejich výsledků*. Metodika a rozsah první smyčky: `docs/dossier/monitoring/01-design.md`.
