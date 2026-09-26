import { browser } from "wxt/browser";

// Dynamic DNR rule IDs reserved for per-site "disable" allow rules.
const FIRST_ID = 1_000_000;
const LAST_ID = 1_099_999;
/** Above every priority the converted filter lists use (max ~1,000,301). */
const PRIORITY = 10_000_000;

/** Lets every request through on sites the user disabled, including list `$important` blocks. */
export async function syncSiteAllowRules(disabledSites: readonly string[]): Promise<void> {
  const existing = await browser.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id).filter((id) => id >= FIRST_ID && id <= LAST_ID);
  const addRules = disabledSites.slice(0, LAST_ID - FIRST_ID + 1).map((site, i) => ({
    id: FIRST_ID + i,
    priority: PRIORITY,
    action: { type: "allowAllRequests" as const },
    condition: {
      requestDomains: [site],
      resourceTypes: ["main_frame" as const, "sub_frame" as const],
    },
  }));
  await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}
