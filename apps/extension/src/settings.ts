import type { Mode } from "@jad-block/decision-engine";
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

/**
 * Opt-in: send sanitized candidate features (docs/adr/0004) to our classification API.
 * Off by default. Sensitive sites are never sent, even when this is on.
 */
export const remoteSetting = storage.defineItem<boolean>("local:remoteClassification", {
  fallback: false,
});

const installIdSetting = storage.defineItem<string>("local:installId");

/** Random per-install ID used only for API rate limiting. Not linked to any account. */
export async function getInstallId(): Promise<string> {
  const existing = await installIdSetting.getValue();
  if (existing) return existing;
  const id = crypto.randomUUID();
  await installIdSetting.setValue(id);
  return id;
}

/**
 * Classification API base URL, baked in at build time (WXT_API_URL). Dev builds default to a
 * local `wrangler dev`. An empty value means this build has no remote classification.
 */
export const API_URL: string =
  import.meta.env.WXT_API_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");

export function isHostDisabled(disabled: readonly string[], hostname: string): boolean {
  const host = hostname.toLowerCase();
  return disabled.some((site) => host === site || host.endsWith(`.${site}`));
}
