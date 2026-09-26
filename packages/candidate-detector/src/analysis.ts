import { isGeneratedClass } from "@semantic-blocker/fingerprints";
import type { LabelHint, LinkPattern, SizeBucket } from "@semantic-blocker/schemas";
import { matchLabel } from "./labels";
import type { Measure, Rect } from "./measure";

// Whole tokens of class/id names (split on "-", "_", and spaces) that suggest advertising.
const AD_TOKENS = new Set([
  "ad",
  "ads",
  "adv",
  "advert",
  "adverts",
  "advertisement",
  "adslot",
  "adunit",
  "adcontainer",
  "adsense",
  "adsbygoogle",
  "dfp",
  "gpt",
  "doubleclick",
  "sponsor",
  "sponsored",
  "promo",
  "promoted",
  "taboola",
  "outbrain",
]);

const AD_ATTRIBUTE = /^data-(?:ad(?:-|s-|vert|$)|google-query-id|native-ad)/;

const TRACKING_HOSTS = [
  "doubleclick.net",
  "googleadservices.com",
  "googlesyndication.com",
  "amazon-adsystem.com",
  "taboola.com",
  "outbrain.com",
  "criteo.com",
  "adnxs.com",
];
const TRACKING_PATH = /\/(?:aclk|pagead|adclick|adserver)\b/;

const INTERACTIVE_FORM = "form, input:not([type=hidden]), select, textarea";
const MAX_SCANNED_DESCENDANTS = 300;

export interface Analysis {
  labelHints: LabelHint[];
  adLikeAttributes: boolean;
  image: boolean;
  video: boolean;
  iframe: boolean;
  links: LinkPattern;
  size: SizeBucket;
  rect: Rect;
  sticky: boolean;
  form: boolean;
  button: boolean;
  inNavigation: boolean;
  repeatedSiblingStructure: boolean;
  inShadowRoot: boolean;
  textLength: number;
}

function tokens(value: string | null): string[] {
  return value ? value.toLowerCase().split(/[\s_-]+/) : [];
}

export function hasAdLikeAttributes(el: Element): boolean {
  if ([...tokens(el.id), ...tokens(el.getAttribute("class"))].some((t) => AD_TOKENS.has(t))) {
    return true;
  }
  return Array.from(el.attributes).some((a) => AD_ATTRIBUTE.test(a.name));
}

/** Approximate registrable domain: last two labels. Good enough to tell "external" apart. */
export function siteOf(hostname: string): string {
  return hostname.toLowerCase().split(".").slice(-2).join(".");
}

export function linkPattern(el: Element, pageUrl: string): LinkPattern {
  const anchors = el.matches("a[href]") ? [el] : Array.from(el.querySelectorAll("a[href]"));
  if (anchors.length === 0) return "none";
  const pageSite = siteOf(new URL(pageUrl).hostname);
  const externalSites = new Set<string>();
  for (const a of anchors) {
    let url: URL;
    try {
      url = new URL(a.getAttribute("href") ?? "", pageUrl);
    } catch {
      continue;
    }
    const host = url.hostname.toLowerCase();
    if (
      TRACKING_HOSTS.some((t) => host === t || host.endsWith(`.${t}`)) ||
      TRACKING_PATH.test(url.pathname)
    ) {
      return "tracking-redirect";
    }
    if (url.protocol.startsWith("http") && siteOf(host) !== pageSite) {
      externalSites.add(siteOf(host));
    }
  }
  if (externalSites.size === 0) return "internal-only";
  return externalSites.size === 1 ? "one-external" : "multiple-external";
}

const IAB_SIZES: [number, number, SizeBucket][] = [
  [300, 250, "iab-medium-rectangle"],
  [336, 280, "iab-large-rectangle"],
  [728, 90, "iab-leaderboard"],
  [970, 90, "iab-leaderboard"],
  [970, 250, "iab-billboard"],
  [160, 600, "iab-skyscraper"],
  [120, 600, "iab-skyscraper"],
  [300, 600, "iab-half-page"],
  [468, 60, "iab-banner"],
  [320, 50, "iab-mobile-banner"],
  [320, 100, "iab-mobile-banner"],
];
const SIZE_TOLERANCE = 0.1;

export function sizeBucket(rect: Rect, viewport: { width: number; height: number }): SizeBucket {
  const { width: w, height: h } = rect;
  if (w < 2 || h < 2) return "hidden";
  for (const [iw, ih, bucket] of IAB_SIZES) {
    if (Math.abs(w - iw) <= iw * SIZE_TOLERANCE && Math.abs(h - ih) <= ih * SIZE_TOLERANCE) {
      return bucket;
    }
  }
  if (w >= viewport.width * 0.9 && h <= 150) return "full-width-strip";
  const area = w * h;
  if (area < 150 * 150) return "small";
  if (area > viewport.width * viewport.height * 0.25) return "large";
  return "medium";
}

function stableSignature(el: Element): string {
  const classes = Array.from(el.classList)
    .filter((c) => !isGeneratedClass(c))
    .sort()
    .join(".");
  return `${el.localName}.${classes}`;
}

/** True when the element is one of several same-shaped siblings (feed items, list rows, cards). */
export function isRepeatedItem(el: Element): boolean {
  const parent = el.parentElement;
  if (!parent || parent.children.length < 3) return false;
  const signature = stableSignature(el);
  let matches = 0;
  for (const sibling of Array.from(parent.children)) {
    if (sibling !== el && stableSignature(sibling) === signature) matches++;
    if (matches >= 2) return true;
  }
  return false;
}

/** Visible disclosure labels inside `el` (or on it via aria-label). */
export function findLabels(el: Element, measure: Measure): { hint: LabelHint; element: Element }[] {
  const found: { hint: LabelHint; element: Element }[] = [];
  const consider = (node: Element) => {
    const aria = node.getAttribute("aria-label");
    const hint =
      (aria ? matchLabel(aria) : null) ??
      (node.children.length === 0 ? matchLabel(node.textContent ?? "") : null);
    // Hidden labels are ignored: invisible "Sponsored" text is a known way to fake a disclosure.
    if (hint && measure.isVisible(node)) found.push({ hint, element: node });
  };
  consider(el);
  const descendants = el.querySelectorAll("*");
  for (let i = 0; i < descendants.length && i < MAX_SCANNED_DESCENDANTS; i++) {
    consider(descendants[i] as Element);
  }
  return found;
}

export function analyze(el: Element, pageUrl: string, measure: Measure): Analysis {
  const rect = measure.rect(el);
  const descendants = Array.from(el.querySelectorAll("*")).slice(0, MAX_SCANNED_DESCENDANTS);
  const position = measure.position(el);
  return {
    labelHints: [...new Set(findLabels(el, measure).map((l) => l.hint))],
    adLikeAttributes: hasAdLikeAttributes(el) || descendants.some(hasAdLikeAttributes),
    image: el.querySelector("img, picture, svg image") !== null,
    video: el.querySelector("video") !== null,
    iframe: el.localName === "iframe" || el.querySelector("iframe") !== null,
    links: linkPattern(el, pageUrl),
    size: sizeBucket(rect, measure.viewport()),
    rect,
    sticky: position === "fixed" || position === "sticky",
    form: el.matches(INTERACTIVE_FORM) || el.querySelector(INTERACTIVE_FORM) !== null,
    button: el.querySelector("button, [role=button]") !== null,
    inNavigation: el.closest("nav, [role=navigation], [role=menu], [role=menubar]") !== null,
    repeatedSiblingStructure: isRepeatedItem(el),
    inShadowRoot: el.getRootNode() instanceof ShadowRoot,
    textLength: (el.textContent ?? "").replace(/\s+/g, " ").trim().length,
  };
}
