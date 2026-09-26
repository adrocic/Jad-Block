import { Hono } from "hono";

export const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

// M3: POST /v1/classify — validate with @semantic-blocker/schemas, rate-limit,
// check the KV fingerprint cache, then call the SemanticClassifier.
// Responses carry probabilities and modelVersion only: never selectors or code.

export default app;
