import type { CandidateFeatures, Classification } from "./index";

/** A valid CandidateFeatures for tests. Override only the fields a test cares about. */
export function sampleFeatures(overrides: Partial<CandidateFeatures> = {}): CandidateFeatures {
  return {
    schemaVersion: 1,
    fingerprint: "0123456789abcdef",
    tag: "div",
    position: "article-inline",
    size: "iab-medium-rectangle",
    links: "one-external",
    labelHints: ["advertisement"],
    adLikeAttributes: false,
    media: { image: true, video: false, iframe: false },
    layout: {
      sticky: false,
      insertedAfterLoad: true,
      repeatedSiblingStructure: false,
      inShadowRoot: false,
    },
    interaction: { button: false, form: false },
    untrustedText: "Advertisement — Learn more",
    ...overrides,
  };
}

/** A Classification for tests. Defaults describe a clear-cut ad. */
export function sampleClassification(overrides: Partial<Classification> = {}): Classification {
  return {
    advertisement: 0.99,
    sponsored: 0.9,
    primaryContent: 0.01,
    navigation: 0.01,
    userControl: 0.01,
    essentialUi: 0.01,
    safeToHide: 0.99,
    elementType: "advertisement",
    ...overrides,
  };
}
