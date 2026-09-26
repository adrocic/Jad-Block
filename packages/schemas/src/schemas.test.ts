import { describe, expect, test } from "bun:test";
import { CandidateFeatures, ClassifyRequest, ClassifyResponse, MAX_UNTRUSTED_TEXT } from "./index";
import { sampleClassification, sampleFeatures } from "./testing";

describe("CandidateFeatures", () => {
  test("accepts a valid candidate", () => {
    expect(CandidateFeatures.safeParse(sampleFeatures()).success).toBe(true);
  });

  test("rejects unknown fields, so nothing unvetted can leave the browser", () => {
    const withExtra = { ...sampleFeatures(), html: "<div>...</div>" };
    expect(CandidateFeatures.safeParse(withExtra).success).toBe(false);
  });

  test("rejects unknown fields in nested objects", () => {
    const f = sampleFeatures();
    const withExtra = { ...f, interaction: { ...f.interaction, inputValue: "hunter2" } };
    expect(CandidateFeatures.safeParse(withExtra).success).toBe(false);
  });

  test("rejects over-long text", () => {
    const f = sampleFeatures({ untrustedText: "x".repeat(MAX_UNTRUSTED_TEXT + 1) });
    expect(CandidateFeatures.safeParse(f).success).toBe(false);
  });

  test("rejects malformed fingerprints", () => {
    expect(CandidateFeatures.safeParse(sampleFeatures({ fingerprint: "../../etc" })).success).toBe(
      false,
    );
  });
});

describe("ClassifyRequest", () => {
  test("requires 1 to 20 candidates", () => {
    expect(ClassifyRequest.safeParse({ candidates: [] }).success).toBe(false);
    expect(ClassifyRequest.safeParse({ candidates: [sampleFeatures()] }).success).toBe(true);
    const tooMany = Array.from({ length: 21 }, () => sampleFeatures());
    expect(ClassifyRequest.safeParse({ candidates: tooMany }).success).toBe(false);
  });
});

describe("ClassifyResponse", () => {
  test("rejects anything beyond probabilities, such as a selector to act on", () => {
    const response = {
      modelVersion: "test-1",
      results: [
        {
          fingerprint: "0123456789abcdef",
          classification: sampleClassification(),
          selector: ".main-content",
        },
      ],
    };
    expect(ClassifyResponse.safeParse(response).success).toBe(false);
  });

  test("rejects probabilities outside 0..1", () => {
    const response = {
      modelVersion: "test-1",
      results: [
        {
          fingerprint: "0123456789abcdef",
          classification: sampleClassification({ advertisement: 1.5 }),
        },
      ],
    };
    expect(ClassifyResponse.safeParse(response).success).toBe(false);
  });
});
