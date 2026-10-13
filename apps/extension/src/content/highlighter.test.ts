import { afterEach, describe, expect, test } from "bun:test";
import { HIDDEN_ATTR } from "./hider";
import { HIGHLIGHT_ATTR, Highlighter } from "./highlighter";

const overlays = () => document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`);

describe("Highlighter", () => {
  const highlighter = new Highlighter();
  afterEach(() => highlighter.clear());

  test("draws one overlay without touching the element itself", () => {
    document.body.innerHTML = `<div id="ad" class="promo">Ad</div>`;
    const ad = document.getElementById("ad") as Element;
    const before = ad.outerHTML;

    expect(highlighter.show(ad)).toBe(true);
    expect(overlays()).toHaveLength(1);
    expect(ad.outerHTML).toBe(before);
  });

  test("the overlay sits outside <body>, so the page scanner never sees it", () => {
    document.body.innerHTML = `<div id="ad">Ad</div>`;
    highlighter.show(document.getElementById("ad") as Element);
    expect(document.body.querySelector(`[${HIGHLIGHT_ATTR}]`)).toBeNull();
  });

  test("a new highlight replaces the previous one, and clear removes it", () => {
    document.body.innerHTML = `<div id="a">A</div><div id="b">B</div>`;
    highlighter.show(document.getElementById("a") as Element);
    highlighter.show(document.getElementById("b") as Element);
    expect(overlays()).toHaveLength(1);
    highlighter.clear();
    expect(overlays()).toHaveLength(0);
  });

  test("nothing to point at: missing, detached, or hidden by us", () => {
    document.body.innerHTML = `<div ${HIDDEN_ATTR}="1"><p id="inside">x</p></div>`;
    expect(highlighter.show(undefined)).toBe(false);
    expect(highlighter.show(document.createElement("div"))).toBe(false);
    expect(highlighter.show(document.getElementById("inside") as Element)).toBe(false);
    expect(overlays()).toHaveLength(0);
  });
});
