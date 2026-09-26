import { describe, expect, test } from "bun:test";
import { HeuristicClassifier } from "@jad-block/classifier";
import { type LogEvent, ShadowLog } from "@jad-block/schemas";
import { sampleClassification, sampleFeatures } from "@jad-block/schemas/testing";
import { evaluateFixtures, type LabeledItem, tally } from "./fixtures";
import { analyzeLog } from "./log";
import { confusion, precision, recall } from "./metrics";
import { recommend, sweepThresholds } from "./sweep";

describe("metrics", () => {
  test("confusion, precision and recall", () => {
    const c = confusion([
      { predicted: true, actual: true },
      { predicted: true, actual: false },
      { predicted: false, actual: true },
      { predicted: false, actual: false },
    ]);
    expect(c).toEqual({ tp: 1, fp: 1, fn: 1, tn: 1 });
    expect(precision(c)).toBe(0.5);
    expect(recall(c)).toBe(0.5);
  });

  test("undefined rates are null, not 0 or 1", () => {
    expect(precision({ tp: 0, fp: 0, fn: 3, tn: 0 })).toBeNull();
    expect(recall({ tp: 0, fp: 2, fn: 0, tn: 0 })).toBeNull();
  });
});

describe("tally", () => {
  document.body.innerHTML = `
    <article id="story"><p id="para">Real content</p>
      <div id="ad">Sponsored</div>
    </article>`;
  const $ = (id: string) => document.getElementById(id) as Element;

  test("hiding exactly the ad is a true positive", () => {
    const { confusion: c, breakage } = tally([$("ad")], [$("ad")], [$("para")]);
    expect(c).toMatchObject({ tp: 1, fp: 0, fn: 0 });
    expect(breakage).toEqual([]);
  });

  test("hiding a container that also holds content is breakage, even if it covers the ad", () => {
    const { confusion: c, breakage } = tally([$("story")], [$("ad")], [$("para")]);
    expect(c).toMatchObject({ tp: 0, fp: 1 });
    expect(breakage).toHaveLength(1);
  });

  test("an undetected ad is a false negative", () => {
    expect(tally([], [$("ad")], [$("para")]).confusion).toMatchObject({ fn: 1, tn: 1 });
  });
});

test("the heuristic on fixtures: no breakage, full precision", async () => {
  const results = await evaluateFixtures(new HeuristicClassifier());
  expect(results.flatMap((r) => r.breakage)).toEqual([]);
  for (const r of results) expect(r.confusion.fp).toBe(0);
});

describe("analyzeLog", () => {
  const detection = (host: string, fingerprint: string, state: string, wouldHide: boolean) => ({
    kind: "detection",
    at: 1,
    host,
    fingerprint,
    features: sampleFeatures({ fingerprint }),
    classification: sampleClassification(),
    modelVersion: "heuristic-1",
    decision: {
      action: state === "hidden" ? "hide" : "retain",
      wouldHide,
      policyVersion: "p",
      reasons: [],
    },
    state,
  });
  const events = ShadowLog.parse([
    detection("a.example", "aaaaaaaaaaaaaaaa", "hidden", true),
    detection("a.example", "bbbbbbbbbbbbbbbb", "hidden", true),
    detection("b.example", "cccccccccccccccc", "would-hide", true),
    { kind: "restore", at: 2, host: "a.example", fingerprint: "bbbbbbbbbbbbbbbb" },
    {
      kind: "label",
      at: 3,
      host: "a.example",
      fingerprint: "bbbbbbbbbbbbbbbb",
      isAd: false,
      source: "restore-feedback",
    },
    {
      kind: "label",
      at: 4,
      host: "b.example",
      fingerprint: "cccccccccccccccc",
      isAd: false,
      source: "popup",
    },
    // Relabeled: the latest label wins.
    {
      kind: "label",
      at: 5,
      host: "b.example",
      fingerprint: "cccccccccccccccc",
      isAd: true,
      source: "popup",
    },
  ]) as LogEvent[];

  test("summarizes volumes and the restore rate", () => {
    const s = analyzeLog(events);
    expect(s).toMatchObject({ detections: 3, uniqueElements: 3, hosts: 2, hiddenElements: 2 });
    expect(s.restoreRate).toBe(0.5);
  });

  test("joins labels to detections, latest label winning", () => {
    const s = analyzeLog(events);
    expect(s.labeled).toBe(2);
    expect(s.labeledConfusion).toMatchObject({ tp: 1, fp: 1 });
  });

  test("legacy exports without `kind` load as detections", () => {
    const { kind: _kind, ...legacy } = detection(
      "a.example",
      "dddddddddddddddd",
      "would-hide",
      true,
    );
    const parsed = ShadowLog.parse([legacy]);
    expect(parsed[0]?.kind).toBe("detection");
  });
});

describe("threshold sweep", () => {
  // 30 ads the model is sure about, 10 content items it half-suspects.
  const items: LabeledItem[] = [
    ...Array.from({ length: 30 }, () => ({
      features: sampleFeatures(),
      classification: sampleClassification({ advertisement: 0.97, safeToHide: 0.97 }),
      isAd: true,
    })),
    ...Array.from({ length: 10 }, () => ({
      features: sampleFeatures(),
      classification: sampleClassification({ advertisement: 0.75, safeToHide: 0.75 }),
      isAd: false,
    })),
  ];

  test("recommends the most permissive thresholds that still meet the precision target", () => {
    const best = recommend(sweepThresholds(items), 0.99);
    expect(best?.precision).toBe(1);
    expect(best?.recall).toBe(1);
    expect(best?.minAdOrSponsored).toBeGreaterThan(0.75);
  });

  test("requires minimum support before recommending anything", () => {
    expect(recommend(sweepThresholds(items.slice(0, 5)), 0.99, 20)).toBeNull();
  });

  test("local vetoes still apply during the sweep", () => {
    const nav = [{ ...items[0], features: sampleFeatures({ position: "navigation-area" }) }];
    const rows = sweepThresholds(nav as LabeledItem[]);
    expect(rows.every((r) => r.confusion.tp === 0)).toBe(true);
  });
});
