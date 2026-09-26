import { type Classification, ClassifyRequest, ClassifyResponse } from "@semantic-blocker/schemas";
import type { Context } from "hono";
import { cacheKey, readCached, writeCached } from "../cache";
import { createClassifier } from "../classifiers";
import { type Env, KILL_SWITCH_KEY } from "../env";

/** 20 candidates × ~1 KB each, with room to spare. Anything bigger isn't from our extension. */
export const MAX_BODY_BYTES = 64 * 1024;
const INSTALL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type AppContext = Context<{ Bindings: Env }>;

function clientKey(c: AppContext): string {
  const installId = c.req.header("x-install-id");
  if (installId && INSTALL_ID.test(installId)) return `install:${installId}`;
  return `ip:${c.req.header("cf-connecting-ip") ?? "unknown"}`;
}

/**
 * POST /v1/classify: sanitized candidate features in, probabilities out. Never returns
 * selectors, commands, or code (ADR 0002). Request bodies and page text are never logged.
 */
export async function classify(c: AppContext): Promise<Response> {
  if ((await c.env.CACHE.get(KILL_SWITCH_KEY, { cacheTtl: 60 })) === "on") {
    return c.json({ error: "classification disabled" }, 503);
  }
  if (!c.req.header("content-type")?.startsWith("application/json")) {
    return c.json({ error: "expected application/json" }, 415);
  }
  if (Number(c.req.header("content-length") ?? 0) > MAX_BODY_BYTES) {
    return c.json({ error: "request too large" }, 413);
  }

  const [client, global] = await Promise.all([
    c.env.CLIENT_LIMITER.limit({ key: clientKey(c) }),
    c.env.GLOBAL_LIMITER.limit({ key: "global" }),
  ]);
  if (!client.success || !global.success) {
    c.header("retry-after", "60");
    return c.json({ error: "rate limited" }, 429);
  }

  const text = await c.req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return c.json({ error: "request too large" }, 413);
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }
  const request = ClassifyRequest.safeParse(body);
  if (!request.success) {
    // Paths only: echoing values back could reflect page text into logs or clients.
    const paths = request.error.issues.slice(0, 5).map((issue) => issue.path.join("."));
    return c.json({ error: "invalid request", paths }, 400);
  }

  const classifier = createClassifier(c.env);
  const { candidates } = request.data;
  const keys = await Promise.all(candidates.map((f) => cacheKey(f, classifier.modelVersion)));
  const results: (Classification | null)[] = await Promise.all(
    keys.map((key) => readCached(c.env.CACHE, key)),
  );

  const missIndexes = results.flatMap((r, i) => (r ? [] : [i]));
  const misses = candidates.filter((_, i) => results[i] === null);
  if (misses.length > 0) {
    let fresh: Classification[];
    try {
      fresh = await classifier.classify(misses);
    } catch (error) {
      console.error(JSON.stringify({ event: "classifier_error", message: String(error) }));
      return c.json({ error: "classifier unavailable" }, 502);
    }
    const writes: Promise<void>[] = [];
    missIndexes.forEach((candidateIndex, j) => {
      const classification = fresh[j];
      const key = keys[candidateIndex];
      if (!classification || !key) return;
      results[candidateIndex] = classification;
      writes.push(writeCached(c.env.CACHE, key, classification));
    });
    c.executionCtx.waitUntil(Promise.all(writes));
  }

  const response = ClassifyResponse.parse({
    modelVersion: classifier.modelVersion,
    results: candidates.flatMap((f, i) => {
      const classification = results[i];
      return classification ? [{ fingerprint: f.fingerprint, classification }] : [];
    }),
  });
  console.log(
    JSON.stringify({
      event: "classify",
      candidates: candidates.length,
      cacheHits: candidates.length - misses.length,
    }),
  );
  return c.json(response);
}
