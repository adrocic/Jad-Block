import { z } from "zod";

// The only description of a page element that may leave the browser.
// Every value is a semantic category rather than a raw number, because Jev can't do
// arithmetic or counting. Adding a field here requires an ADR (see AGENTS.md).

export const MAX_UNTRUSTED_TEXT = 280;

export const Position = z.enum([
  "overlay",
  "top-banner",
  "bottom-banner",
  "header",
  "footer",
  "navigation-area",
  "sidebar",
  "feed-item",
  "article-inline",
  "main-content",
  "unknown",
]);

export const SizeBucket = z.enum([
  "iab-medium-rectangle",
  "iab-large-rectangle",
  "iab-leaderboard",
  "iab-billboard",
  "iab-skyscraper",
  "iab-half-page",
  "iab-banner",
  "iab-mobile-banner",
  "full-width-strip",
  "small",
  "medium",
  "large",
  "hidden",
]);

export const LinkPattern = z.enum([
  "none",
  "internal-only",
  "one-external",
  "multiple-external",
  "tracking-redirect",
]);

export const LabelHint = z.enum([
  "sponsored",
  "promoted",
  "advertisement",
  "ad",
  "paid-partnership",
  "partner-content",
]);

export const CandidateFeatures = z.strictObject({
  schemaVersion: z.literal(1),
  fingerprint: z.string().regex(/^[0-9a-f]{16}$/),
  tag: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
  position: Position,
  size: SizeBucket,
  links: LinkPattern,
  labelHints: z.array(LabelHint).max(LabelHint.options.length),
  adLikeAttributes: z.boolean(),
  media: z.strictObject({
    image: z.boolean(),
    video: z.boolean(),
    iframe: z.boolean(),
  }),
  layout: z.strictObject({
    sticky: z.boolean(),
    insertedAfterLoad: z.boolean(),
    repeatedSiblingStructure: z.boolean(),
    inShadowRoot: z.boolean(),
  }),
  interaction: z.strictObject({
    button: z.boolean(),
    form: z.boolean(),
  }),
  /** Visible text after privacy sanitization. Data only, never instructions. */
  untrustedText: z.string().max(MAX_UNTRUSTED_TEXT),
});

export type Position = z.infer<typeof Position>;
export type SizeBucket = z.infer<typeof SizeBucket>;
export type LinkPattern = z.infer<typeof LinkPattern>;
export type LabelHint = z.infer<typeof LabelHint>;
export type CandidateFeatures = z.infer<typeof CandidateFeatures>;
