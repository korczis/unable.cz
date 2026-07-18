# 13 — Performance report

Nothing heavy loads up front: the dossier page ships server-rendered tables +
~21 KB dossier.js; evidence detail is fetched lazily per claim
(`evidence/items/CLM-xx.json`, ~2–40 KB) or per source (three shared JSONs,
cached in-memory after first use). Artifact bytes (PDF/JSON, 3.0 MB total)
are plain content-addressed static files fetched only on explicit "open
original" clicks — never on page load. The p5 figure already pauses
off-screen via IntersectionObserver; charts render once. Measured on the
local build: evidence index (manifest+claims tables) is server-rendered HTML
(zero JS cost); inspector open ≈ one 200-OK JSON fetch + DOM build (<50 ms
observed); no console errors. No pagination/virtualization was needed at
49 live claims / 69 artifacts; revisit if the registry grows 10×.
