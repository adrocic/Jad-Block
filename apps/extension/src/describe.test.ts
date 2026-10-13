import { expect, test } from "bun:test";
import { sampleFeatures } from "@jad-block/schemas/testing";
import { describeLocation } from "./describe";

test("describes position, ad size, media and disclosure labels", () => {
  const f = sampleFeatures({
    position: "sidebar",
    size: "iab-half-page",
    labelHints: ["sponsored", "ad"],
    media: { image: false, video: false, iframe: true },
  });
  expect(describeLocation(f)).toBe(
    "Sidebar · half-page ad size · embedded frame · labelled “Sponsored”, “Ad”",
  );
});

test("leaves out generic sizes and empty labels", () => {
  const f = sampleFeatures({
    position: "feed-item",
    size: "medium",
    labelHints: [],
    media: { image: false, video: false, iframe: false },
    layout: {
      sticky: true,
      insertedAfterLoad: false,
      repeatedSiblingStructure: true,
      inShadowRoot: false,
    },
  });
  expect(describeLocation(f)).toBe("Feed item · sticky");
});

test("never includes page text", () => {
  const f = sampleFeatures({ untrustedText: "<img src=x onerror=alert(1)>" });
  expect(describeLocation(f)).not.toContain("img");
});
