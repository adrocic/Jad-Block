import type { CandidateFeatures } from "@jad-block/schemas";

const POSITION: Record<CandidateFeatures["position"], string> = {
  overlay: "Overlay",
  "top-banner": "Top banner",
  "bottom-banner": "Bottom banner",
  header: "Header",
  footer: "Footer",
  "navigation-area": "Navigation",
  sidebar: "Sidebar",
  "feed-item": "Feed item",
  "article-inline": "Inside article",
  "main-content": "Main content",
  unknown: "On page",
};

const SIZE: Partial<Record<CandidateFeatures["size"], string>> = {
  "iab-medium-rectangle": "medium rectangle ad size",
  "iab-large-rectangle": "large rectangle ad size",
  "iab-leaderboard": "leaderboard ad size",
  "iab-billboard": "billboard ad size",
  "iab-skyscraper": "skyscraper ad size",
  "iab-half-page": "half-page ad size",
  "iab-banner": "banner ad size",
  "iab-mobile-banner": "mobile banner ad size",
  "full-width-strip": "full-width strip",
};

const LABEL: Record<CandidateFeatures["labelHints"][number], string> = {
  sponsored: "Sponsored",
  promoted: "Promoted",
  advertisement: "Advertisement",
  ad: "Ad",
  "paid-partnership": "Paid partnership",
  "partner-content": "Partner content",
};

/**
 * Where and what an entry is, in a few words, so a popup row can be matched to the page.
 * Built only from feature categories; page text is shown separately (and only as text).
 */
export function describeLocation(f: CandidateFeatures): string {
  const parts = [POSITION[f.position]];
  const size = SIZE[f.size];
  if (size) parts.push(size);
  if (f.layout.sticky) parts.push("sticky");
  if (f.media.video) parts.push("video");
  else if (f.media.iframe) parts.push("embedded frame");
  else if (f.media.image) parts.push("image");
  if (f.labelHints.length > 0) {
    parts.push(`labelled ${f.labelHints.map((h) => `“${LABEL[h]}”`).join(", ")}`);
  }
  return parts.join(" · ");
}
