import { readFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURE_NAMES = ["news-article", "social-feed", "adversarial"] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];
/** Mutable so it can be passed straight to `describe.each`. */
export const FIXTURES: FixtureName[] = [...FIXTURE_NAMES];

/** Ground-truth labels. Ads and sponsored content are the categories we aim to hide. */
export const HIDE_LABELS = new Set(["advertisement", "sponsored-content"]);

export interface LoadedFixture {
  pageUrl: string;
  root: HTMLElement;
  labeled: { element: Element; label: string }[];
}

/**
 * Loads a synthetic page into the global happy-dom document (see tools/test-setup.ts).
 * Fixtures are hand-written. Never add scraped real-site pages (see AGENTS.md).
 */
export function loadFixture(name: FixtureName): LoadedFixture {
  const html = readFileSync(join(import.meta.dir, "..", "pages", `${name}.html`), "utf8")
    // happy-dom would try to load iframes. Detection only needs the element, not its document.
    .replace(/<iframe([^>]*?)\ssrc=/g, "<iframe$1 data-fixture-src=");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const pageUrl = parsed.querySelector('meta[name="fixture-url"]')?.getAttribute("content");
  if (!pageUrl) throw new Error(`${name}.html is missing <meta name="fixture-url">`);

  document.body.innerHTML = parsed.body.innerHTML;
  const labeled = Array.from(document.querySelectorAll("[data-fixture-label]")).map((element) => ({
    element,
    label: element.getAttribute("data-fixture-label") ?? "",
  }));
  return { pageUrl, root: document.body, labeled };
}
