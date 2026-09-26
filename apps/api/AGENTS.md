# apps/api

Cloudflare Worker (Hono) behind `POST /v1/classify`. Design: `docs/adr/0006-classification-api.md`.

- Dev: `bun run dev:api` (wrangler dev on :8787). Tests: `bun test apps/api` (fake bindings in
  `src/testing.ts`). Bun runs the tests, but the Worker runs on workerd, so avoid Bun-only APIs in `src/`.
- Never log request bodies, page text, or install IDs. Log counts and error messages only.
- Validate input and output with `@jad-block/schemas`. Responses are probabilities only.
- Server cache keys must hash the full sanitized features, never the fingerprint alone (ADR 0006).
- Every classifier must report a `modelVersion` distinct from the extension's local heuristic.
- Secrets (`TYPESAFE_API_KEY`) go in `.dev.vars` locally and `wrangler secret put` in production.
