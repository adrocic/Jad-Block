export interface Env {
  /** Classification cache and runtime config (the kill switch). */
  CACHE: KVNamespace;
  /** Per-client limit, keyed by the extension's random install ID (or IP as fallback). */
  CLIENT_LIMITER: RateLimit;
  /** Whole-service limit that keeps us under the upstream model's quota (Jev: 1,200 req/min). */
  GLOBAL_LIMITER: RateLimit;
  /** Which SemanticClassifier to use: "heuristic" (default) or "jev" (M5). */
  CLASSIFIER?: string;
  /** Secret, set with `wrangler secret put TYPESAFE_API_KEY`. Never shipped in the extension. */
  TYPESAFE_API_KEY?: string;
}

/** KV key that, when set to "on", makes /v1/classify answer 503 so clients fall back locally. */
export const KILL_SWITCH_KEY = "config:kill-switch";
