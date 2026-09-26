import type { CandidateFeatures, Classification, ElementType } from "@semantic-blocker/schemas";

/**
 * Anything that turns candidate features into evidence. Jev is one implementation (M5, in
 * apps/api), never a hard dependency: DNR + cosmetic + cache must work without any classifier.
 */
export interface SemanticClassifier {
  readonly modelVersion: string;
  /** Returns one Classification per candidate, in the same order. */
  classify(candidates: readonly CandidateFeatures[]): Promise<Classification[]>;
}

const SPONSORED_HINTS = new Set(["sponsored", "promoted", "paid-partnership", "partner-content"]);
const AD_HINTS = new Set(["advertisement", "ad"]);

/**
 * Deterministic classifier derived from structural features alone. It stands in for Jev in
 * development and tests, and deliberately never reads `untrustedText`.
 */
export class HeuristicClassifier implements SemanticClassifier {
  readonly modelVersion = "heuristic-1";

  async classify(candidates: readonly CandidateFeatures[]): Promise<Classification[]> {
    return candidates.map((f) => this.classifyOne(f));
  }

  private classifyOne(f: CandidateFeatures): Classification {
    const labeledAd = f.labelHints.some((h) => AD_HINTS.has(h));
    const labeledSponsored = f.labelHints.some((h) => SPONSORED_HINTS.has(h));
    const adShaped = f.size.startsWith("iab-") && (f.media.iframe || f.adLikeAttributes);
    const navigation = f.position === "navigation-area" ? 0.9 : 0.02;
    const userControl = f.interaction.form ? 0.9 : f.interaction.button ? 0.3 : 0.02;
    const labeled = labeledAd || labeledSponsored;

    const advertisement = labeledAd ? 0.97 : adShaped ? 0.9 : 0.2;
    const sponsored = labeledSponsored ? 0.97 : 0.1;
    const risky = navigation > 0.5 || userControl > 0.5;

    return {
      advertisement,
      sponsored,
      primaryContent: labeled || adShaped ? 0.03 : 0.5,
      navigation,
      userControl,
      essentialUi: f.interaction.form ? 0.6 : 0.03,
      safeToHide: risky ? 0.1 : labeled ? 0.97 : 0.5,
      elementType: elementType(advertisement, sponsored, navigation, userControl),
    };
  }
}

function elementType(ad: number, sponsored: number, nav: number, control: number): ElementType {
  const best = Math.max(ad, sponsored, nav, control);
  if (best < 0.5) return "unknown";
  if (best === nav) return "navigation";
  if (best === control) return "utility";
  return sponsored >= ad ? "sponsored-content" : "advertisement";
}
