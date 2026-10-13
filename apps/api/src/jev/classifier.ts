import type { SemanticClassifier } from "@jad-block/classifier";
import { type CandidateFeatures, Classification } from "@jad-block/schemas";
import { TypeSafeClient, type TypeSafeClientConfig } from "@typesafe-ai/sdk";
import { buildState, JEV_MODEL, JEV_MODEL_VERSION, QUESTIONS, toClassification } from "./questions";

/**
 * The extension gives up after 3 s (ADR 0006), and Jev usually answers in 70–500 ms. Retrying
 * inside that budget mostly burns upstream quota, so a failure goes straight back to the client,
 * which falls back to its local heuristic.
 */
const TIMEOUT_MS = 2500;

/** One Jev call per candidate: all questions about one element, answered in parallel. */
export class JevClassifier implements SemanticClassifier {
  readonly modelVersion = JEV_MODEL_VERSION;

  constructor(private readonly client: TypeSafeClient) {}

  async classify(candidates: readonly CandidateFeatures[]): Promise<Classification[]> {
    return Promise.all(candidates.map((f) => this.classifyOne(f)));
  }

  private async classifyOne(features: CandidateFeatures): Promise<Classification> {
    const { answers } = await this.client.systemOne({
      state: buildState(features),
      questions: QUESTIONS,
      model: JEV_MODEL,
    });
    // Typed output guarantees the shape we asked for, not that the service kept its word.
    return Classification.parse(toClassification(answers));
  }
}

/**
 * `overrides` exists for tooling (custom fetch for recordings). Never pass
 * `dangerouslyAllowBrowser` from anything that ships in the extension.
 */
export function createJevClassifier(
  apiKey: string,
  overrides: Partial<TypeSafeClientConfig> = {},
): JevClassifier {
  return new JevClassifier(
    new TypeSafeClient({
      apiKey,
      timeout: TIMEOUT_MS,
      retry: { maxRetries: 0 },
      // The SDK logs request bodies at debug level, and those contain page text.
      logLevel: "off",
      ...overrides,
    }),
  );
}
