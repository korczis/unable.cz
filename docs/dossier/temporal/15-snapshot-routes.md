# Snapshot routes (PROMPT-09 §19)

- `/dossier/snapshots/` — registry table (id, cutoff, live claims, sources, material changes since previous, note), publication events (withdrawal/republication), retention policy.
- `/dossier/snapshots/<id>/` — manifest fields, integrity hashes, object counts, claim-state distribution, changes-vs-previous with reconciliation numbers, and the four actions: Porovnat s předchozím / Porovnat s aktuálním / Otevřít dossier v tomto snapshotu (frozen objects.json — honest object-and-summary view, see 03) / Kopírovat stabilní odkaz (JS, clipboard).
