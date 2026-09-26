# 0006: Classification API design

**Status:** accepted (2026-09-25)

## Decision
`POST /v1/classify` on Cloudflare Workers (Hono) accepts a strict `ClassifyRequest` (1–20
sanitized candidates, max 64 KB) and returns a strict `ClassifyResponse` (probabilities +
`modelVersion`). No database.

| Concern | Choice |
|---|---|
| Server cache | Workers KV, 7-day TTL, key = model version + **SHA-256 of the complete sanitized features** |
| Rate limits | Per client (random install ID, IP fallback): 60/min. Global: 1,000/min (Jev allows 1,200) |
| Kill switch | KV `config:kill-switch` = `on` → 503; clients fall back to local classification |
| Client failure handling | 3 s timeout, schema-validated responses, circuit breaker honoring `Retry-After` |
| Opt-in | Remote classification is off by default; sensitive sites are never sent |
| Logging | Counts and errors only. Never request bodies, page text, or install IDs |

## Why the cache key isn't the fingerprint
Fingerprints are computable from public markup. Keyed on fingerprint alone, anyone could submit a
real site's navigation fingerprint with ad-like features, and every user on that site would get a
cached "advertisement" for their navigation bar. Keyed on the full feature set, a submitter can
only cache the answer those exact features get anyway. The cost is a lower hit rate: the same ad
slot with different creative text misses. That's acceptable, because the client's L1/L2 caches
(keyed by fingerprint, but per user) absorb most repeats.

## Why an install ID
Rate limiting by IP alone penalizes shared networks (offices, CGNAT). The install ID is a random
UUID generated locally, used only as a rate-limit key, and not linked to any account.

## Model versions
The server's classifier always reports a version distinct from the extension's local heuristic
(`api-heuristic-1`, later `jev-*`). Clients use it to decide which cached results to upgrade.
