import { describe, expect, test } from "bun:test";
import { FIXTURES, HIDE_LABELS, loadFixture } from "@semantic-blocker/fixtures";
import { findCandidates } from "./index";
import { fixtureMeasure } from "./testing";

function detect(name: (typeof FIXTURES)[number]) {
  const fixture = loadFixture(name);
  const candidates = findCandidates(fixture.root, {
    pageUrl: fixture.pageUrl,
    measure: fixtureMeasure,
  });
  return { ...fixture, candidates };
}

describe.each(FIXTURES)("fixture %s", (name) => {
  test("every ad or sponsored unit is a candidate, selected as exactly that unit", () => {
    const { labeled, candidates } = detect(name);
    for (const { element, label } of labeled.filter((l) => HIDE_LABELS.has(l.label))) {
      const hit = candidates.some((c) => c.element === element);
      expect({ label, html: element.outerHTML.slice(0, 80), hit }).toMatchObject({ hit: true });
    }
  });

  test("no candidate is, or contains, content that must stay visible", () => {
    const { labeled, candidates } = detect(name);
    for (const { element, label } of labeled.filter((l) => !HIDE_LABELS.has(l.label))) {
      const offending = candidates.find(
        (c) => c.element === element || c.element.contains(element),
      );
      expect({ label, offending: offending?.element.outerHTML.slice(0, 80) }).toEqual({
        label,
        offending: undefined,
      });
    }
  });

  test("candidates never nest", () => {
    const { candidates } = detect(name);
    for (const a of candidates) {
      for (const b of candidates) {
        if (a !== b) expect(a.element.contains(b.element)).toBe(false);
      }
    }
  });
});

describe("signals", () => {
  test("an inline ad scores on its label, iframe, and IAB size", () => {
    const { candidates } = detect("news-article");
    const inline = candidates.find((c) => c.element.classList.contains("inline-slot"));
    expect(inline?.signals.map((s) => s.id)).toEqual([
      "label:advertisement",
      "size:iab-medium-rectangle",
      "iframe",
    ]);
  });

  test("subtrees inserted after load get a boost", () => {
    const fixture = loadFixture("news-article");
    const opts = { pageUrl: fixture.pageUrl, measure: fixtureMeasure };
    const before = findCandidates(fixture.root, opts)[0]?.score ?? 0;
    const after = findCandidates(fixture.root, { ...opts, insertedAfterLoad: true })[0]?.score ?? 0;
    expect(after - before).toBe(10);
  });
});

test("finds labels anywhere in a large page, not just the first few hundred elements", () => {
  const filler = "<div><p>Paragraph of filler text.</p></div>".repeat(2000);
  document.body.innerHTML = `<main>${filler}
    <div class="card" data-rect="300,250"><span>Sponsored</span><a href="https://x.example/">Go</a></div>
  </main>`;
  const candidates = findCandidates(document.body, {
    pageUrl: "https://site.example/",
    measure: fixtureMeasure,
  });
  expect(candidates.map((c) => c.element.className)).toEqual(["card"]);
});

test("scans inside open shadow roots", () => {
  document.body.innerHTML = '<div id="host"></div>';
  const host = document.getElementById("host");
  if (!host) throw new Error("no host");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <div class="unit" data-rect="300,250">
      <span>Sponsored</span><a href="https://brand.example/">Shop</a>
    </div>`;
  const candidates = findCandidates(shadow, {
    pageUrl: "https://site.example/",
    measure: fixtureMeasure,
  });
  expect(candidates).toHaveLength(1);
  expect(candidates[0]?.analysis.inShadowRoot).toBe(true);
});
