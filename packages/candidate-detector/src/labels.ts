import type { LabelHint } from "@jad-block/schemas";

/** Disclosure labels are short. Longer text that merely mentions "sponsored" is not a label. */
export const MAX_LABEL_LENGTH = 40;

const LABEL_PATTERNS: [RegExp, LabelHint][] = [
  [/^sponsored(?: (?:content|post|story|links?|listing))?(?: by .{1,30})?$/, "sponsored"],
  [/^promoted(?: (?:post|tweet|content|listing))?(?: by .{1,30})?$/, "promoted"],
  [/^(?:advertisement|advertisements|advertising)$/, "advertisement"],
  [/^(?:ad|ads)(?: [·•|] .{1,30})?$/, "ad"],
  [/^paid (?:partnership|post|promotion|content)(?: with .{1,30})?$/, "paid-partnership"],
  [/^(?:partner content|from our partners|presented by .{1,30})$/, "partner-content"],
];

// Decorations publishers put around labels: "· Sponsored ·", "[Ad]", "Advertisement:".
const DECORATION = /^[\s·•|:\-–—[\]()]+|[\s·•|:\-–—[\]()]+$/g;

/** Returns the disclosure label a short text represents, or null. English only for now. */
export function matchLabel(text: string): LabelHint | null {
  const normalized = text.replace(/\s+/g, " ").replace(DECORATION, "").toLowerCase();
  if (normalized.length === 0 || normalized.length > MAX_LABEL_LENGTH) return null;
  for (const [pattern, hint] of LABEL_PATTERNS) {
    if (pattern.test(normalized)) return hint;
  }
  return null;
}
