import { describe, expect, test } from "bun:test";
import {
  convertNetworkRules,
  cssForHost,
  hostSuffixes,
  parseCosmeticFilters,
  parseHideExceptions,
  toHidingCss,
} from "./index";

const LIST = `
[Adblock Plus 2.0]
! comment
##.ad-slot
##.banner-ad
news.example##.native-promo
news.example,~sports.news.example##.sidebar-sponsor
shop.example#@#.banner-ad
~forum.example##.promoted-post
#@#.everywhere-ok
##.everywhere-ok
example.com#?#div:-abp-has(> span:-abp-contains(Sponsored))
##div:has-text(Sponsored)
example.com#$#abort-on-property-read ads
`;

describe("parseCosmeticFilters", () => {
  const rules = parseCosmeticFilters(LIST);

  test("plain generic selectors go to the static stylesheet", () => {
    expect(rules.generic).toEqual([".ad-slot"]);
  });

  test("generic selectors with domain exceptions are handled per host", () => {
    expect(rules.genericWithExceptions).toEqual({
      ".banner-ad": ["shop.example"],
      ".promoted-post": ["forum.example"],
    });
  });

  test("globally excepted selectors are dropped", () => {
    expect(rules.generic).not.toContain(".everywhere-ok");
    expect(rules.genericWithExceptions[".everywhere-ok"]).toBeUndefined();
  });

  test("extended and procedural syntax is skipped", () => {
    const all = JSON.stringify(rules);
    expect(all).not.toContain("abp");
    expect(all).not.toContain("has-text");
    expect(all).not.toContain("abort-on");
  });
});

describe("cssForHost", () => {
  const rules = parseCosmeticFilters(LIST);

  test("applies domain rules to subdomains", () => {
    const css = cssForHost(rules, "www.news.example");
    expect(css).toContain(".native-promo{display:none!important}");
    expect(css).toContain(".sidebar-sponsor{");
  });

  test("honors negated subdomains", () => {
    expect(cssForHost(rules, "sports.news.example")).not.toContain(".sidebar-sponsor");
  });

  test("honors exceptions to generic selectors", () => {
    expect(cssForHost(rules, "shop.example")).not.toContain(".banner-ad");
    expect(cssForHost(rules, "other.example")).toContain(".banner-ad{");
    expect(cssForHost(rules, "m.forum.example")).not.toContain(".promoted-post");
  });

  test("never emits plain generic selectors (those ship in the static stylesheet)", () => {
    expect(cssForHost(rules, "other.example")).not.toContain(".ad-slot");
  });
});

test("toHidingCss emits one rule per selector so one bad selector can't void others", () => {
  expect(toHidingCss([".a", "#b"])).toBe(
    ".a{display:none!important}\n#b{display:none!important}\n",
  );
});

test("hostSuffixes", () => {
  expect(hostSuffixes("a.b.com")).toEqual(["a.b.com", "b.com", "com"]);
});

test("parseHideExceptions", () => {
  const text = "@@||bank.example^$generichide\n@@||docs.example^$elemhide\n@@||x.example^$script";
  expect(parseHideExceptions(text)).toEqual({
    generichide: ["bank.example"],
    elemhide: ["docs.example"],
  });
});

describe("convertNetworkRules", () => {
  test("converts block and allow rules and drops unsafe ones", async () => {
    const text = [
      "||ads.example^",
      "@@||ads.example/ok.js^$script",
      "||tracker.example^$third-party",
      "||cdn.example/ad.js$redirect=noopjs",
    ].join("\n");
    const { rules } = await convertNetworkRules(1, text);
    const types = rules.map((r) => String(r.action.type)).sort();
    expect(types).toEqual(["allow", "block", "block"]);
  });
});
