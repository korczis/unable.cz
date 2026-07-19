# Revalidation planner (PROMPT-09 §14)

See 09-freshness for the scoring formula and current queue. Route: /dossier/revalidation/. The planner never proposes blind re-runs of every provider: only records whose state is BLOCKED/DUE_SOON/DUE/STALE enter the queue, priorities weigh materiality and dependency count, and each task has a stop condition. Legal/privacy constraints inherit from the case scope (public sources only, owner-authorized subject).
