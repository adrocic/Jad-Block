# 0001: Deterministic blocking first, semantic classification last

**Status:** accepted (2026-09-25)

## Decision
The order is fixed: DNR network rules, then known cosmetic selectors, then the local heuristic
candidate detector, then the fingerprint cache, and only then the remote semantic classifier.

## Why
Known answers are free, instant, private, and work offline. The classifier costs latency, rate-limit
budget (Jev allows 1,200 req/min per key, shared by all users) and privacy exposure, so it only earns
its place on content that filter lists can't identify.
