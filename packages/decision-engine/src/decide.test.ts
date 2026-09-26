import { describe, expect, test } from "bun:test";
import { sampleClassification, sampleFeatures } from "@semantic-blocker/schemas/testing";
import { DEFAULT_POLICY, decide } from "./index";

describe("decide", () => {
  test("hides a clear-cut ad in enforce mode", () => {
    const d = decide(sampleClassification(), sampleFeatures(), "enforce");
    expect(d).toEqual({
      action: "hide",
      wouldHide: true,
      policyVersion: DEFAULT_POLICY.version,
      reasons: [],
    });
  });

  test("shadow mode never hides but reports what it would do", () => {
    const d = decide(sampleClassification(), sampleFeatures(), "shadow");
    expect(d.action).toBe("retain");
    expect(d.wouldHide).toBe(true);
  });

  test("sponsored content counts as well as advertisements", () => {
    const c = sampleClassification({ advertisement: 0.2, sponsored: 0.99 });
    expect(decide(c, sampleFeatures(), "enforce").action).toBe("hide");
  });

  test.each([
    ["advertisement", { advertisement: 0.9, sponsored: 0.5 }, "not confidently an ad or sponsored"],
    ["safeToHide", { safeToHide: 0.8 }, "not confidently safe to hide"],
    ["primaryContent", { primaryContent: 0.2 }, "may be primary content"],
    ["essentialUi", { essentialUi: 0.2 }, "may be essential UI"],
    ["navigation", { navigation: 0.3 }, "may be navigation"],
    ["userControl", { userControl: 0.3 }, "may be a user control"],
  ])("retains when %s is outside the policy", (_field, overrides, reason) => {
    const d = decide(sampleClassification(overrides), sampleFeatures(), "enforce");
    expect(d.action).toBe("retain");
    expect(d.reasons).toContain(reason);
  });

  test("local structure vetoes even a maximally confident classifier", () => {
    const certain = sampleClassification({
      advertisement: 1,
      sponsored: 1,
      safeToHide: 1,
      primaryContent: 0,
      essentialUi: 0,
      navigation: 0,
      userControl: 0,
    });
    const inNav = sampleFeatures({ position: "navigation-area" });
    const withForm = sampleFeatures({ interaction: { button: true, form: true } });
    expect(decide(certain, inNav, "enforce").reasons).toEqual(["local: inside navigation"]);
    expect(decide(certain, withForm, "enforce").reasons).toEqual(["local: contains form controls"]);
  });
});
