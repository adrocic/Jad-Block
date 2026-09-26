import type { Analysis } from "./analysis";
import { analyze, findLabels, hasAdLikeAttributes, isRepeatedItem } from "./analysis";
import type { Measure } from "./measure";
import { DEFAULT_THRESHOLD, type Signal, score } from "./score";

export interface DetectOptions {
  pageUrl: string;
  measure: Measure;
  /** True when scanning a subtree added by a MutationObserver after initial load. */
  insertedAfterLoad?: boolean;
  threshold?: number;
}

export interface Candidate {
  element: Element;
  score: number;
  signals: Signal[];
  analysis: Analysis;
}

// Never climb into (or return) page-level structure.
const STRUCTURAL = new Set(["html", "body", "main", "nav", "header", "footer", "aside", "form"]);
const MAX_CLIMB = 6;
const MAX_LOOKAHEAD = 2;
/** Other content in a parent beyond this means the parent holds more than one unit. */
const SUBSTANTIAL_OTHER_TEXT = 80;

function isStructural(el: Element): boolean {
  return STRUCTURAL.has(el.localName) || el.getAttribute("role") === "main";
}

function otherTextLength(parent: Element, child: Element): number {
  const total = (parent.textContent ?? "").replace(/\s+/g, " ").trim().length;
  const own = (child.textContent ?? "").replace(/\s+/g, " ").trim().length;
  return total - own;
}

/**
 * From a disclosure label, climb to the smallest ancestor that is the whole ad unit: a repeated
 * feed item if there is one nearby, otherwise the last ancestor before the parent starts holding
 * other substantial content (e.g. the article around an inline ad).
 */
function climbFromLabel(label: Element): Element {
  let unit = label;
  for (let i = 0; i < MAX_CLIMB; i++) {
    const parent = unit.parentElement;
    if (!parent || isStructural(parent)) return unit;
    if (isRepeatedItem(parent)) return parent;
    if (otherTextLength(parent, unit) > SUBSTANTIAL_OTHER_TEXT) {
      // The parent holds more than this unit, but a repeated item just above it is still the unit
      // (e.g. li.feed-item > article > [header with label, long post body]).
      let ahead = parent;
      for (let j = 0; j < MAX_LOOKAHEAD; j++) {
        if (isRepeatedItem(ahead)) return ahead;
        const next = ahead.parentElement;
        if (!next || isStructural(next)) break;
        ahead = next;
      }
      return unit;
    }
    unit = parent;
  }
  return unit;
}

/** Wrappers that contain nothing but the ad (a div around an iframe) are part of the unit. */
function expandThroughWrappers(el: Element): Element {
  let unit = el;
  for (let i = 0; i < 3; i++) {
    const parent = unit.parentElement;
    if (!parent || isStructural(parent) || parent.children.length !== 1) break;
    if (otherTextLength(parent, unit) > 0) break;
    unit = parent;
  }
  return unit;
}

function collectSeeds(root: Element, measure: Measure): Set<Element> {
  const seeds = new Set<Element>();
  for (const { element } of findLabels(root, measure)) seeds.add(climbFromLabel(element));
  const all = [root, ...Array.from(root.querySelectorAll("*"))];
  for (const el of all) {
    if (el.localName === "iframe" || hasAdLikeAttributes(el)) {
      if (!isStructural(el)) seeds.add(expandThroughWrappers(el));
    }
  }
  return seeds;
}

/**
 * Finds elements under `root` suspicious enough to be worth classifying. Returns outermost
 * candidates only (a candidate is never nested inside another), in document order.
 */
export function findCandidates(
  root: Element | DocumentFragment,
  options: DetectOptions,
): Candidate[] {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  // A ShadowRoot (or other fragment) is scanned through its top-level elements.
  const roots = root instanceof Element ? [root] : Array.from(root.children);
  const seeds = new Set(roots.flatMap((r) => [...collectSeeds(r, options.measure)]));
  const scored: Candidate[] = [];
  for (const element of seeds) {
    if (!options.measure.isVisible(element)) continue;
    const analysis = analyze(element, options.pageUrl, options.measure);
    const result = score(analysis, options.insertedAfterLoad ?? false);
    if (result.score >= threshold) scored.push({ element, analysis, ...result });
  }
  return scored
    .filter((c) => !scored.some((other) => other !== c && other.element.contains(c.element)))
    .sort((a, b) =>
      a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
}
