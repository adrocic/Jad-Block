import type { Candidate, Measure } from "@semantic-blocker/candidate-detector";
import { fingerprint } from "@semantic-blocker/fingerprints";
import type { CandidateFeatures, Position } from "@semantic-blocker/schemas";

export interface ExtractOptions {
  pageUrl: string;
  measure: Measure;
  insertedAfterLoad?: boolean;
}

// Text inside these is never collected: user input, code, and content hidden from assistive tech.
const EXCLUDED_TEXT = [
  "script",
  "style",
  "noscript",
  "template",
  "textarea",
  "select",
  "option",
  "input",
  "[contenteditable]:not([contenteditable=false])",
  "[aria-hidden=true]",
].join(",");

const MAX_RAW_TEXT = 2000;
const EDGE_PX = 10;

/**
 * Visible, non-input text of a candidate, whitespace-collapsed. Not yet privacy-sanitized:
 * callers must pass the result through `sanitizeCandidate` from @semantic-blocker/privacy.
 */
export function visibleText(el: Element, measure: Measure): string {
  const parts: string[] = [];
  let length = 0;
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node && length < MAX_RAW_TEXT; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest(EXCLUDED_TEXT) || !measure.isVisible(parent)) continue;
    const text = node.textContent?.trim();
    if (text) {
      parts.push(text);
      length += text.length + 1;
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").slice(0, MAX_RAW_TEXT);
}

export function positionOf(candidate: Candidate, measure: Measure): Position {
  const { element: el, analysis } = candidate;
  if (analysis.sticky) {
    const viewport = measure.viewport();
    const { top, height } = analysis.rect;
    if (top <= EDGE_PX) return "top-banner";
    if (top + height >= viewport.height - EDGE_PX) return "bottom-banner";
    return "overlay";
  }
  if (analysis.inNavigation) return "navigation-area";
  if (el.closest("header, [role=banner]")) return "header";
  if (el.closest("footer, [role=contentinfo]")) return "footer";
  if (el.closest("aside, [role=complementary]")) return "sidebar";
  if (analysis.repeatedSiblingStructure) return "feed-item";
  if (el.closest("article")) return "article-inline";
  if (el.closest("main, [role=main]")) return "main-content";
  return "unknown";
}

/**
 * Turns a detected candidate into the compact, number-free description the classifier sees.
 * Everything is a semantic category because Jev can't do arithmetic or counting.
 */
export function extractFeatures(candidate: Candidate, options: ExtractOptions): CandidateFeatures {
  const { element: el, analysis: a } = candidate;
  const discriminators = [
    ...a.labelHints.map((h) => `label:${h}`),
    ...(a.adLikeAttributes ? ["ad-attributes"] : []),
  ];
  return {
    schemaVersion: 1,
    fingerprint: fingerprint(el, new URL(options.pageUrl).hostname, discriminators),
    tag: el.localName,
    position: positionOf(candidate, options.measure),
    size: a.size,
    links: a.links,
    labelHints: a.labelHints,
    adLikeAttributes: a.adLikeAttributes,
    media: { image: a.image, video: a.video, iframe: a.iframe },
    layout: {
      sticky: a.sticky,
      insertedAfterLoad: options.insertedAfterLoad ?? false,
      repeatedSiblingStructure: a.repeatedSiblingStructure,
      inShadowRoot: a.inShadowRoot,
    },
    interaction: { button: a.button, form: a.form },
    untrustedText: visibleText(el, options.measure),
  };
}
