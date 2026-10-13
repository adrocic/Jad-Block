import { HeuristicClassifier, type SemanticClassifier } from "@jad-block/classifier";
import type { Env } from "./env";
import { createJevClassifier } from "./jev";

const heuristic = new HeuristicClassifier();

/**
 * The server's heuristic reports its own version. Clients use the model version to tell remote
 * results from their local heuristic's, so the two must never share a name.
 */
const serverHeuristic: SemanticClassifier = {
  modelVersion: `api-${heuristic.modelVersion}`,
  classify: (candidates) => heuristic.classify(candidates),
};

/**
 * Selects the classifier backing /v1/classify. The heuristic stays the default so local dev,
 * tests and e2e never need a key or the network; `CLASSIFIER=jev` switches to Jev.
 */
export function createClassifier(env: Env): SemanticClassifier {
  switch (env.CLASSIFIER ?? "heuristic") {
    case "heuristic":
      return serverHeuristic;
    case "jev":
      if (!env.TYPESAFE_API_KEY)
        throw new Error("CLASSIFIER is jev but TYPESAFE_API_KEY is not set");
      return createJevClassifier(env.TYPESAFE_API_KEY);
    default:
      throw new Error(`unknown CLASSIFIER "${env.CLASSIFIER}"`);
  }
}
