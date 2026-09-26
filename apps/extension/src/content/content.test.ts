import { describe, expect, test } from "bun:test";
import { fixtureMeasure } from "@semantic-blocker/candidate-detector/testing";
import { HeuristicClassifier } from "@semantic-blocker/classifier";
import type { Mode } from "@semantic-blocker/decision-engine";
import { HIDE_LABELS, loadFixture } from "@semantic-blocker/fixtures";
import type { CandidateFeatures } from "@semantic-blocker/schemas";
import type { ClassifyResult, SemanticEntry } from "../messages";
import { HIDDEN_ATTR } from "./hider";
import { SemanticPipeline } from "./pipeline";
import { observeAdditions } from "./scanner";

function setup(mode: Mode, options: { failing?: boolean; override?: boolean } = {}) {
  const fixture = loadFixture("social-feed");
  const classifier = new HeuristicClassifier();
  const calls: CandidateFeatures[][] = [];
  const reported: SemanticEntry[] = [];
  const pipeline = new SemanticPipeline({
    pageUrl: fixture.pageUrl,
    measure: fixtureMeasure,
    mode,
    sensitive: false,
    async classify(candidates) {
      calls.push(candidates);
      if (options.failing) throw new Error("offline");
      const out = await classifier.classify(candidates);
      return candidates.map((c, i) => ({
        fingerprint: c.fingerprint,
        classification: out[i],
        modelVersion: classifier.modelVersion,
        userOverride: options.override ?? false,
      })) as ClassifyResult[];
    },
    report: (entries) => reported.push(...entries),
  });
  return { fixture, pipeline, calls, reported };
}

const hiddenElements = () => Array.from(document.querySelectorAll(`[${HIDDEN_ATTR}]`));

describe("SemanticPipeline", () => {
  test("shadow mode hides nothing but records what it would hide", async () => {
    const { fixture, pipeline, reported } = setup("shadow");
    await pipeline.scan(fixture.root, false);
    expect(hiddenElements()).toHaveLength(0);
    expect(reported.map((e) => e.state)).toEqual(["would-hide"]);
  });

  test("enforce mode hides the sponsored post and nothing else", async () => {
    const { fixture, pipeline } = setup("enforce");
    await pipeline.scan(fixture.root, false);
    const hidden = hiddenElements();
    expect(hidden).toHaveLength(1);
    expect(HIDE_LABELS.has(hidden[0]?.getAttribute("data-fixture-label") ?? "")).toBe(true);
  });

  test("restore un-hides the element and it stays restored", async () => {
    const { fixture, pipeline } = setup("enforce");
    await pipeline.scan(fixture.root, false);
    const [entry] = pipeline.list();
    expect(pipeline.restore(entry?.id ?? "")).toBe(true);
    expect(hiddenElements()).toHaveLength(0);
    expect(pipeline.list()[0]?.state).toBe("restored");
  });

  test("a user override (previously restored as not-an-ad) is never hidden", async () => {
    const { fixture, pipeline } = setup("enforce", { override: true });
    await pipeline.scan(fixture.root, false);
    expect(hiddenElements()).toHaveLength(0);
    expect(pipeline.list()[0]?.decision.reasons).toEqual(["user: not an ad"]);
  });

  test("L1 cache: identical layouts are classified once per page", async () => {
    const { fixture, pipeline, calls } = setup("shadow");
    await pipeline.scan(fixture.root, false);
    const feed = fixture.root.querySelector(".feed");
    const sponsored = fixture.root.querySelector('[data-fixture-label="sponsored-content"]');
    if (!feed || !sponsored) throw new Error("fixture changed");
    const copy = sponsored.cloneNode(true) as Element;
    feed.append(copy);
    await pipeline.scan(copy, true);
    expect(calls).toHaveLength(1);
    expect(pipeline.list()).toHaveLength(2);
  });

  test("classifier failure degrades silently", async () => {
    const { fixture, pipeline } = setup("enforce", { failing: true });
    await pipeline.scan(fixture.root, false);
    expect(hiddenElements()).toHaveLength(0);
    expect(pipeline.list()).toHaveLength(0);
  });
});

describe("observeAdditions", () => {
  test("batches added subtrees and passes only the outermost roots", async () => {
    document.body.innerHTML = "<main></main>";
    const main = document.querySelector("main");
    if (!main) throw new Error("no main");
    const batches: Element[][] = [];
    let flush: () => void = () => {};
    const stop = observeAdditions(
      document.body,
      (roots) => batches.push(roots),
      (cb) => {
        flush = cb;
      },
    );

    const outer = document.createElement("div");
    main.append(outer);
    outer.append(document.createElement("span")); // nested inside an already-added root
    main.append(document.createElement("script")); // ignored
    await Promise.resolve(); // let MutationObserver deliver
    flush();
    stop();

    expect(batches).toEqual([[outer]]);
  });
});
