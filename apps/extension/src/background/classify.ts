import { HeuristicClassifier, type SemanticClassifier } from "@semantic-blocker/classifier";
import { ClassifyRequest } from "@semantic-blocker/schemas";
import type { ClassifyResult } from "../messages";
import { lookup, store } from "./cache";

// M3 adds a remote (Worker → Jev) classifier used only when the user opted in and the page isn't
// sensitive, with this local heuristic as the fallback.
const local: SemanticClassifier = new HeuristicClassifier();

export async function classifyCandidates(
  candidates: unknown,
  _sensitive: boolean,
): Promise<ClassifyResult[]> {
  const request = ClassifyRequest.parse({ candidates });
  const classifier = local;
  const fingerprints = [...new Set(request.candidates.map((c) => c.fingerprint))];
  const hits = await lookup(fingerprints, classifier.modelVersion);

  const misses = request.candidates.filter(
    (c, i, all) =>
      !hits.has(c.fingerprint) && all.findIndex((o) => o.fingerprint === c.fingerprint) === i,
  );
  if (misses.length > 0) {
    const classifications = await classifier.classify(misses);
    const fresh = misses.flatMap((c, i) => {
      const classification = classifications[i];
      return classification ? [{ fingerprint: c.fingerprint, classification }] : [];
    });
    await store(fresh, classifier.modelVersion);
    for (const { fingerprint, classification } of fresh) {
      hits.set(fingerprint, {
        classification,
        modelVersion: classifier.modelVersion,
        userOverride: false,
      });
    }
  }

  return fingerprints.flatMap((fingerprint) => {
    const hit = hits.get(fingerprint);
    return hit ? [{ fingerprint, ...hit }] : [];
  });
}
