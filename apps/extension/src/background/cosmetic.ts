import { type CosmeticRules, cssForHost } from "@semantic-blocker/filter-engine";
import { browser } from "wxt/browser";

type CosmeticAsset = Omit<CosmeticRules, "generic"> & { elemhide: string[]; generichide: string[] };

const GENERIC_SCRIPT_ID = "generic-cosmetic";
const GENERIC_CSS = "generated/cosmetic/generic.css";
const COSMETIC_JSON = "/generated/cosmetic/cosmetic.json";

/** Hides elements the semantic pipeline marked. User origin, so page styles can't override it. */
export const SEMANTIC_HIDE_CSS = "[data-sb-hidden]{display:none!important}\n";

let asset: Promise<CosmeticAsset> | undefined;

function loadAsset(): Promise<CosmeticAsset> {
  asset ??= fetch(browser.runtime.getURL(COSMETIC_JSON as "/")).then(
    (response) => response.json() as Promise<CosmeticAsset>,
  );
  return asset;
}

function matchesDomain(hostname: string, domains: readonly string[]): boolean {
  return domains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
}

function toMatchPattern(domain: string): string | null {
  return /^[a-z0-9.-]+$/.test(domain) ? `*://*.${domain}/*` : null;
}

/**
 * Registers generic.css for every site except those with a $generichide/$elemhide exception or
 * that the user disabled. Registration persists across browser restarts.
 */
export async function syncGenericCosmetics(disabledSites: readonly string[]): Promise<void> {
  const { generichide, elemhide } = await loadAsset();
  const excludeMatches = [...generichide, ...elemhide, ...disabledSites]
    .map(toMatchPattern)
    .filter((p): p is string => p !== null);
  const script = {
    id: GENERIC_SCRIPT_ID,
    matches: ["<all_urls>"],
    excludeMatches,
    css: [GENERIC_CSS],
    runAt: "document_start" as const,
    allFrames: true,
  };
  const existing = await browser.scripting.getRegisteredContentScripts({
    ids: [GENERIC_SCRIPT_ID],
  });
  if (existing.length > 0) await browser.scripting.updateContentScripts([script]);
  else await browser.scripting.registerContentScripts([script]);
}

/** Injects host-specific cosmetic rules plus the semantic hiding rule into one frame. */
export async function injectPageCss(tabId: number, frameId: number, hostname: string) {
  const rules = await loadAsset();
  const hostCss = matchesDomain(hostname, rules.elemhide) ? "" : cssForHost(rules, hostname);
  await browser.scripting.insertCSS({
    target: { tabId, frameIds: [frameId] },
    css: SEMANTIC_HIDE_CSS + hostCss,
    origin: "USER",
  });
}
