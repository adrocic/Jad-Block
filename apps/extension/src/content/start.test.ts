import { describe, expect, test } from "bun:test";
import { startScanning } from "./start";

function fakePipeline() {
  const scanned: Element[] = [];
  return {
    scanned,
    pipeline: {
      scan: async (root: Element | DocumentFragment) => void scanned.push(root as Element),
    },
  };
}

describe("startScanning", () => {
  test("scans the body and returns a stop function", () => {
    const { scanned, pipeline } = fakePipeline();
    const doc = document.implementation.createHTMLDocument("page");
    const stop = startScanning(doc, pipeline);
    expect(scanned).toEqual([doc.body]);
    expect(typeof stop).toBe("function");
    stop?.();
  });

  test("a page without <body> (e.g. a redirect that navigates away first) is skipped, not a crash", () => {
    const { scanned, pipeline } = fakePipeline();
    const doc = document.implementation.createHTMLDocument("redirect");
    doc.body.remove();
    expect(startScanning(doc, pipeline)).toBeNull();
    expect(scanned).toEqual([]);
  });
});
