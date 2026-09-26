import type { Analysis } from "./analysis";

export interface Signal {
  id: string;
  weight: number;
}

/**
 * Local suspicion weights. They answer "is this worth asking the classifier about?", not
 * "is this an ad?". Tune them against fixtures, never against a single site.
 */
export const WEIGHTS = {
  label: 50,
  adAttributes: 25,
  iabSize: 20,
  trackingLink: 15,
  iframe: 15,
  externalLink: 10,
  sticky: 10,
  insertedAfterLoad: 10,
  inNavigation: -50,
  form: -40,
  longText: -30,
} as const;

/** Candidates at or above this score are worth semantic classification. */
export const DEFAULT_THRESHOLD = 40;

/** Text longer than this looks like primary content (articles, long posts), not an ad unit. */
const LONG_TEXT = 600;

export function score(
  a: Analysis,
  insertedAfterLoad: boolean,
): { score: number; signals: Signal[] } {
  const signals: Signal[] = [];
  const add = (id: string, weight: number) => signals.push({ id, weight });

  if (a.labelHints.length > 0) add(`label:${a.labelHints.join(",")}`, WEIGHTS.label);
  if (a.adLikeAttributes) add("ad-attributes", WEIGHTS.adAttributes);
  if (a.size.startsWith("iab-")) add(`size:${a.size}`, WEIGHTS.iabSize);
  if (a.links === "tracking-redirect") add("tracking-link", WEIGHTS.trackingLink);
  if (a.links === "one-external" || a.links === "multiple-external") {
    add("external-link", WEIGHTS.externalLink);
  }
  if (a.iframe) add("iframe", WEIGHTS.iframe);
  if (a.sticky) add("sticky", WEIGHTS.sticky);
  if (insertedAfterLoad) add("inserted-after-load", WEIGHTS.insertedAfterLoad);
  if (a.inNavigation) add("in-navigation", WEIGHTS.inNavigation);
  if (a.form) add("form-controls", WEIGHTS.form);
  if (a.textLength > LONG_TEXT) add("long-text", WEIGHTS.longText);

  return { score: signals.reduce((sum, s) => sum + s.weight, 0), signals };
}
