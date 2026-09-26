import { describe, expect, test } from "bun:test";
import { findCandidates } from "@jad-block/candidate-detector";
import { fixtureMeasure } from "@jad-block/candidate-detector/testing";
import { HeuristicClassifier } from "@jad-block/classifier";
import { decide } from "@jad-block/decision-engine";
import { extractFeatures } from "@jad-block/feature-extractor";
import { sanitizeCandidate } from "@jad-block/privacy";
import { FIXTURES, HIDE_LABELS, loadFixture } from "./index";

// End-to-end over the pure packages: detect → extract → sanitize → classify → decide (enforce).
async function run(name: (typeof FIXTURES)[number]) {
  const fixture = loadFixture(name);
  const options = { pageUrl: fixture.pageUrl, measure: fixtureMeasure };
  const candidates = findCandidates(fixture.root, options);
  const features = candidates.map((c) => sanitizeCandidate(extractFeatures(c, options)));
  const classifications = await new HeuristicClassifier().classify(features);
  const hidden = candidates
    .filter((_, i) => {
      const classification = classifications[i];
      const f = features[i];
      return classification && f && decide(classification, f, "enforce").action === "hide";
    })
    .map((c) => c.element);
  return { ...fixture, hidden };
}

describe.each(FIXTURES)("pipeline on %s", (name) => {
  test("never hides, or hides a container of, content that must stay visible", async () => {
    const { labeled, hidden } = await run(name);
    for (const { element, label } of labeled.filter((l) => !HIDE_LABELS.has(l.label))) {
      const hiddenOver = hidden.find((h) => h === element || h.contains(element));
      expect({ label, hiddenOver: hiddenOver?.outerHTML.slice(0, 80) }).toEqual({
        label,
        hiddenOver: undefined,
      });
    }
  });

  test("every hidden element is labeled as an ad or sponsored content", async () => {
    const { hidden } = await run(name);
    for (const el of hidden) {
      expect(HIDE_LABELS.has(el.getAttribute("data-fixture-label") ?? "")).toBe(true);
    }
  });
});
