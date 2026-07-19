# Snapshot generation (PROMPT-09 §7)

Commands:

    npm run temporal:bootstrap   # one-time: materialize the real git publication history (idempotent; refuses divergent overwrite)
    npm run temporal:build       # snapshots (no-op aware) → changes → freshness → routes
    npm run temporal:validate    # integrity gate (see 20)

Build-time sequence: read canonical → extract object revisions → semantic hash → compare with latest snapshot → EXIT on equality (semantic no-op; a rebuild is not a snapshot) → otherwise append snapshot with next sequence, id `able-cz-public-<cutoff>-rNN`, `generated_at` = evidence cutoff (repo determinism convention: wall-clock never enters generated data), `unable_commit` = current HEAD if resolvable.

Semantic snapshot ≠ deployment build ≠ production release: unchanged canonical + redeploy reuses the snapshot id; the deployment is visible in git/Actions history, not as a fake snapshot.

CI note: `.github/workflows/deploy.yml` builds from committed data (audit D11), so snapshot creation happens locally and is committed; `npm run verify` (which runs the temporal gate) is the required pre-commit step, and the canonical-drift check fails the build if dossier.json changed without a new snapshot.
