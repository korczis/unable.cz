# Production snapshot proof (PROMPT-09 §45)

Production exposes: the snapshot id + sha256 content hash on /dossier/ (`#dossier-snapshot-id[data-content-hash]`), `/data/dossier/snapshots/current.json`, and every snapshot manifest. `scripts/dossier/temporal/production-proof.mjs` recomputes the canonical hash locally (canonical → extract → hash), reads the committed generated+built copies, fetches the deployed current.json and the /dossier/ HTML, and writes `reports/dossier-snapshot-proof.json` with canonical/generated/built/deployed ids+hashes and a validation verdict. Run after every deploy:

    node scripts/dossier/temporal/production-proof.mjs

The proof fails (exit 1) unless all four layers agree. Results of the actual post-deploy run are recorded in 24-final-report.
