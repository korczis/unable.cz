# Graph temporal integration (PROMPT-09 §26) — core modes implemented

`/dossier/?mode=changes&from=<id>&to=<id>` — graph.js fetches both frozen object layers, computes added/changed/removed entity+relationship sets client-side and renders:
- visual overlay ONLY when `to` equals the currently rendered snapshot (double champagne border = added, dashed gold = changed, others faded) — painting an old diff onto different data is refused with an explanatory banner;
- always a textual table alternative (přidáno/změněno/odebráno with labels) inside the banner — removals appear only there, since a removed node has nothing to highlight;
- exit link back to the normal graph.

Not implemented: point-in-time/date-range graph reconstruction from snapshots (the existing year-slider time machine remains, driven by validFrom on current data), and selecting a changed element to show old-vs-new state inline (the change ledger page carries that detail instead).
