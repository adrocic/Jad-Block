import { HeuristicClassifier, type SemanticClassifier } from "@semantic-blocker/classifier";
import type { Env } from "./env";

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
 * Selects the classifier backing /v1/classify. Jev plugs in here in M5 behind the same interface;
 * until then the service runs the deterministic heuristic so the whole path can be exercised.
 */
export function createClassifier(env: Env): SemanticClassifier {
  switch (env.CLASSIFIER ?? "heuristic") {
    case "heuristic":
      return serverHeuristic;
    default:
      throw new Error(`unknown CLASSIFIER "${env.CLASSIFIER}"`);
  }
}
