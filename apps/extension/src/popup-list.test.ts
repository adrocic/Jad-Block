import { describe, expect, test } from "bun:test";
import { sampleClassification, sampleFeatures } from "@jad-block/schemas/testing";
import type { SemanticEntry } from "./messages";
import { asksIsAd, popupEntries, stateLabel } from "./popup-list";

const entry = (id: string, state: SemanticEntry["state"]): SemanticEntry => ({
  id,
  fingerprint: "0123456789abcdef",
  features: sampleFeatures(),
  classification: sampleClassification(),
  modelVersion: "test",
  decision: {
    action: "retain",
    wouldHide: state === "would-hide",
    policyVersion: "p",
    reasons: [],
  },
  state,
});

const all = [entry("1", "retained"), entry("2", "would-hide"), entry("3", "retained")];

describe("popupEntries", () => {
  test("shadow mode lists every checked element, would-hide first", () => {
    expect(popupEntries(all, "shadow").map((e) => e.id)).toEqual(["2", "1", "3"]);
  });

  test("shadow mode still lists kept elements when nothing would be hidden", () => {
    const strict = [entry("1", "retained"), entry("2", "retained")];
    expect(popupEntries(strict, "shadow")).toHaveLength(2);
  });

  test("elements that weren't visible are left out, unless we acted on them", () => {
    const invisible = (id: string, state: SemanticEntry["state"]) => ({
      ...entry(id, state),
      features: sampleFeatures({ size: "hidden" }),
    });
    const list = [
      invisible("1", "retained"),
      invisible("2", "would-hide"),
      invisible("3", "hidden"),
    ];
    expect(popupEntries(list, "shadow").map((e) => e.id)).toEqual(["3"]);
  });

  test("enforce mode lists only what was acted on", () => {
    const acted = [entry("1", "retained"), entry("2", "hidden"), entry("3", "restored")];
    expect(popupEntries(acted, "enforce").map((e) => e.id)).toEqual(["2", "3"]);
  });
});

describe("asksIsAd", () => {
  test("shadow mode asks about kept and would-hide elements", () => {
    expect(asksIsAd(entry("1", "retained"), "shadow")).toBe(true);
    expect(asksIsAd(entry("1", "would-hide"), "shadow")).toBe(true);
  });

  test("hidden elements ask only after a restore, and enforce mode doesn't ask about kept ones", () => {
    expect(asksIsAd(entry("1", "hidden"), "enforce")).toBe(false);
    expect(asksIsAd(entry("1", "retained"), "enforce")).toBe(false);
  });
});

test("kept elements read as hypothetical in shadow mode", () => {
  expect(stateLabel("retained", "shadow")).toBe("Would keep");
  expect(stateLabel("retained", "enforce")).toBe("Kept");
});
