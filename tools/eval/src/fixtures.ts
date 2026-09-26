import { findCandidates } from "@jad-block/candidate-detector";
import { fixtureMeasure } from "@jad-block/candidate-detector/testing";
import type { SemanticClassifier } from "@jad-block/classifier";
import { DEFAULT_POLICY, decide, type Policy } from "@jad-block/decision-engine";
import { extractFeatures } from "@jad-block/feature-extractor";
import { FIXTURES, type FixtureName, HIDE_LABELS, loadFixture } from "@jad-block/fixtures";
import { sanitizeCandidate } from "@jad-block/privacy";
import type { CandidateFeatures, Classification } from "@jad-block/schemas";
import type { Confusion } from "./metrics";

/** One classified candidate with ground truth, reusable for threshold sweeps. */
export interface LabeledItem {
  features: CandidateFeatures;
  classification: Classification;
  isAd: boolean;
}

export interface FixtureResult {
  name: FixtureName;
  /** Units, not candidates: a missed ad that was never detected still counts as a false negative. */
  confusion: Confusion;
  /** Hidden elements that are, or contain, content labeled as not-an-ad. The critical failure. */
  breakage: string[];
  items: LabeledItem[];
}

function describe(el: Element): string {
  const label = el.getAttribute("data-fixture-label") ?? "unlabeled";
  const classes = [...el.classList].map((c) => `.${c}`).join("");
  return `${el.localName}${el.id ? `#${el.id}` : ""}${classes} (${label})`;
}

export async function evaluateFixture(
  name: FixtureName,
  classifier: SemanticClassifier,
  policy: Policy = DEFAULT_POLICY,
): Promise<FixtureResult> {
  const fixture = loadFixture(name);
  const options = { pageUrl: fixture.pageUrl, measure: fixtureMeasure };
  const candidates = findCandidates(fixture.root, options);
  const features = candidates.map((c) => sanitizeCandidate(extractFeatures(c, options)));
  const classifications = await classifier.classify(features);

  const positives = fixture.labeled.filter((l) => HIDE_LABELS.has(l.label)).map((l) => l.element);
  const negatives = fixture.labeled.filter((l) => !HIDE_LABELS.has(l.label)).map((l) => l.element);

  const hidden: Element[] = [];
  const items: LabeledItem[] = [];
  candidates.forEach((candidate, i) => {
    const f = features[i];
    const classification = classifications[i];
    if (!f || !classification) return;
    items.push({ features: f, classification, isAd: positives.includes(candidate.element) });
    if (decide(classification, f, "enforce", policy).action === "hide")
      hidden.push(candidate.element);
  });

  return { name, ...tally(hidden, positives, negatives), items };
}

/**
 * Scores hidden elements against ground-truth units. A hide counts as a true positive only if it
 * covers an ad and no content; covering any content is breakage (and a false positive).
 */
export function tally(
  hidden: readonly Element[],
  positives: readonly Element[],
  negatives: readonly Element[],
): { confusion: Confusion; breakage: string[] } {
  const covers = (h: Element, el: Element) => h === el || h.contains(el);
  const confusion: Confusion = { tp: 0, fp: 0, fn: 0, tn: 0 };
  const breakage: string[] = [];
  for (const h of hidden) {
    const coversContent = negatives.some((n) => covers(h, n));
    if (coversContent) breakage.push(describe(h));
    if (!coversContent && positives.some((p) => covers(h, p))) confusion.tp++;
    else confusion.fp++;
  }
  confusion.fn = positives.filter((p) => !hidden.some((h) => covers(h, p))).length;
  confusion.tn = negatives.filter((n) => !hidden.some((h) => covers(h, n))).length;
  return { confusion, breakage };
}

export async function evaluateFixtures(
  classifier: SemanticClassifier,
  policy: Policy = DEFAULT_POLICY,
): Promise<FixtureResult[]> {
  const results: FixtureResult[] = [];
  for (const name of FIXTURES) results.push(await evaluateFixture(name, classifier, policy));
  return results;
}
