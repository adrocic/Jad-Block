import { type CandidateFeatures, Classification } from "@jad-block/schemas";

const TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Cache key = model version + SHA-256 of the complete sanitized features, not the fingerprint
 * alone. Fingerprints can be computed from public markup, so keying on them would let anyone
 * pair a real site's navigation fingerprint with ad-like features and poison every user's result.
 * With the full-feature key, a submitter only ever caches the answer those exact features get
 * anyway. See docs/adr/0006.
 */
export async function cacheKey(features: CandidateFeatures, modelVersion: string): Promise<string> {
  // zod output has a stable key order, so JSON.stringify is canonical here.
  const bytes = new TextEncoder().encode(JSON.stringify(features));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hex = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
  return `cls:v1:${modelVersion}:${hex}`;
}

export async function readCached(kv: KVNamespace, key: string): Promise<Classification | null> {
  const raw = await kv.get(key, "json");
  const parsed = Classification.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function writeCached(
  kv: KVNamespace,
  key: string,
  classification: Classification,
): Promise<void> {
  await kv.put(key, JSON.stringify(classification), { expirationTtl: TTL_SECONDS });
}
