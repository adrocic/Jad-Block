import { describe, expect, test } from "bun:test";
import { fingerprint, fnv1a64, isGeneratedClass, structuralSignature } from "./index";

function el(html: string, selector = "[data-target]"): Element {
  document.body.innerHTML = html;
  const found = document.querySelector(selector);
  if (!found) throw new Error(`fixture has no ${selector}`);
  return found;
}

const card = (text: string, extraClass = "") => `
  <main><div class="feed"><div class="feed-item ${extraClass}" data-target>
    <span class="label">${text}</span><img src="a.png"><a href="#">Go</a>
  </div></div></main>`;

describe("fingerprint", () => {
  test("is a 16-char hex string", () => {
    expect(fingerprint(el(card("Sponsored")), "example.com")).toMatch(/^[0-9a-f]{16}$/);
  });

  test("ignores text, so the same layout with different content matches", () => {
    const a = fingerprint(el(card("Sponsored: Buy shoes")), "example.com");
    const b = fingerprint(el(card("Sponsored: Try our app")), "example.com");
    expect(a).toBe(b);
  });

  test("differs between sites", () => {
    const html = card("Sponsored");
    expect(fingerprint(el(html), "a.com")).not.toBe(fingerprint(el(html), "b.com"));
  });

  test("differs when the structure differs", () => {
    const a = fingerprint(el(card("x")), "example.com");
    const b = fingerprint(el(card("x", "promoted")), "example.com");
    expect(a).not.toBe(b);
  });

  test("ignores generated class names that change between deploys", () => {
    const a = fingerprint(el(card("x", "css-1q2w3e")), "example.com");
    const b = fingerprint(el(card("x", "css-9z8y7x")), "example.com");
    expect(a).toBe(b);
  });

  test("discriminators split identical markup (an ad card vs. a content card)", () => {
    const html = card("x");
    const ad = fingerprint(el(html), "example.com", ["label:sponsored"]);
    const content = fingerprint(el(html), "example.com", []);
    expect(ad).not.toBe(content);
    expect(fingerprint(el(html), "example.com", ["b", "a"])).toBe(
      fingerprint(el(html), "example.com", ["a", "b"]),
    );
  });

  test("the signature contains no page text", () => {
    const sig = structuralSignature(el(card("SECRET TEXT")), "example.com");
    expect(sig).not.toContain("SECRET");
  });
});

describe("isGeneratedClass", () => {
  test.each(["css-1q2w3e", "sc-bdVaJa", "_a1b2c3", "x814n5a", "jsx-3281"])(
    "%s is generated",
    (c) => {
      expect(isGeneratedClass(c)).toBe(true);
    },
  );
  test.each(["feed-item", "col-md-4", "ad-slot", "h1", "promoted-post"])("%s is stable", (c) => {
    expect(isGeneratedClass(c)).toBe(false);
  });
});

test("fnv1a64 matches the reference vector", () => {
  // Reference: FNV-1a 64-bit of "a" is af63dc4c8601ec8c
  expect(fnv1a64("a")).toBe("af63dc4c8601ec8c");
});
