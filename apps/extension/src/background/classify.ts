import { HeuristicClassifier, type SemanticClassifier } from "@semantic-blocker/classifier";
import {
  type CandidateFeatures,
  type Classification,
  ClassifyRequest,
} from "@semantic-blocker/schemas";
import type { ClassifyResult } from "../messages";
import { API_URL, getInstallId, remoteSetting } from "../settings";
import { type CacheHit, lookup, readOverrides, store } from "./cache";
import { RemoteClassifier } from "./remote";

export interface ClassifyDeps {
  local: SemanticClassifier;
  remote: RemoteClassifier;
  remoteEnabled: () => Promise<boolean>;
  lookup: typeof lookup;
  readOverrides: typeof readOverrides;
  store: typeof store;
}

const defaultDeps: ClassifyDeps = {
  local: new HeuristicClassifier(),
  remote: new RemoteClassifier(API_URL, getInstallId),
  remoteEnabled: () => remoteSetting.getValue(),
  lookup,
  readOverrides,
  store,
};

async function run(
  classifier: SemanticClassifier,
  misses: CandidateFeatures[],
  deps: ClassifyDeps,
): Promise<Map<string, CacheHit>> {
  const classifications = await classifier.classify(misses);
  const modelVersion = classifier.modelVersion;
  const results = new Map<string, CacheHit>();
  const toStore: { fingerprint: string; classification: Classification }[] = [];
  misses.forEach(({ fingerprint }, i) => {
    const classification = classifications[i];
    if (!classification) return;
    results.set(fingerprint, { classification, modelVersion });
    toStore.push({ fingerprint, classification });
  });
  await deps.store(toStore, modelVersion);
  return results;
}

/**
 * Remote (our API) only when the user opted in, the page isn't sensitive, and the service is
 * healthy; otherwise, or on any remote failure, the local heuristic. Browsing never waits on or
 * fails because of the remote service.
 */
export async function classifyCandidates(
  candidates: unknown,
  sensitive: boolean,
  deps: ClassifyDeps = defaultDeps,
): Promise<ClassifyResult[]> {
  const request = ClassifyRequest.parse({ candidates });
  const useRemote = !sensitive && deps.remote.available && (await deps.remoteEnabled());
  const localVersion = deps.local.modelVersion;

  const unique = [...new Map(request.candidates.map((c) => [c.fingerprint, c])).values()];
  const fingerprints = unique.map((c) => c.fingerprint);
  const [hits, overrides] = await Promise.all([
    deps.lookup(fingerprints, (version) => !useRemote || version !== localVersion),
    deps.readOverrides(fingerprints),
  ]);

  const misses = unique.filter((c) => !hits.has(c.fingerprint));
  if (misses.length > 0) {
    let fresh: Map<string, CacheHit>;
    try {
      fresh = await run(useRemote ? deps.remote : deps.local, misses, deps);
    } catch {
      fresh = await run(deps.local, misses, deps);
    }
    for (const [fingerprint, hit] of fresh) hits.set(fingerprint, hit);
  }

  return fingerprints.flatMap((fingerprint) => {
    const hit = hits.get(fingerprint);
    return hit ? [{ fingerprint, ...hit, userOverride: overrides.has(fingerprint) }] : [];
  });
}
