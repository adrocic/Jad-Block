import type { Mode } from "@semantic-blocker/decision-engine";
import { storage } from "wxt/utils/storage";

/** Shadow mode logs semantic detections without hiding anything. It stays the default until
 * evaluation shows adequate precision (docs/build-plan.md, "Shadow mode"). */
export const modeSetting = storage.defineItem<Mode>("local:mode", { fallback: "shadow" });

export const semanticSetting = storage.defineItem<boolean>("local:semanticEnabled", {
  fallback: true,
});

/** Hostnames where the user has turned the extension off entirely. */
export const disabledSitesSetting = storage.defineItem<string[]>("local:disabledSites", {
  fallback: [],
});

export function isHostDisabled(disabled: readonly string[], hostname: string): boolean {
  const host = hostname.toLowerCase();
  return disabled.some((site) => host === site || host.endsWith(`.${site}`));
}
