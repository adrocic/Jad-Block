import { browser } from "wxt/browser";
import { setUserOverride } from "@/src/background/cache";
import { classifyCandidates } from "@/src/background/classify";
import { injectPageCss, syncGenericCosmetics } from "@/src/background/cosmetic";
import { logDetections, logLabel, logRestores } from "@/src/background/log";
import { syncSiteAllowRules } from "@/src/background/sites";
import type { BackgroundMessage, PageInitResponse } from "@/src/messages";
import { disabledSitesSetting, isHostDisabled, modeSetting, semanticSetting } from "@/src/settings";

async function syncSiteSettings(): Promise<void> {
  const disabled = await disabledSitesSetting.getValue();
  await Promise.all([syncGenericCosmetics(disabled), syncSiteAllowRules(disabled)]);
}

async function handle(
  message: BackgroundMessage,
  sender: Browser.runtime.MessageSender,
): Promise<unknown> {
  switch (message.type) {
    case "page-init": {
      const hostname = new URL(message.url).hostname;
      const [disabled, semantic, mode] = await Promise.all([
        disabledSitesSetting.getValue(),
        semanticSetting.getValue(),
        modeSetting.getValue(),
      ]);
      const enabled = !isHostDisabled(disabled, hostname);
      const tabId = sender.tab?.id;
      if (enabled && tabId !== undefined) {
        await injectPageCss(tabId, sender.frameId ?? 0, hostname);
      }
      return { enabled, semantic, mode } satisfies PageInitResponse;
    }
    case "classify":
      return classifyCandidates(message.candidates, message.sensitive);
    case "report":
      return logDetections(message.host, message.entries);
    case "restored":
      return logRestores(message.host, message.fingerprints);
    case "label":
      // "Not an ad" also becomes a permanent override: that layout is never hidden again.
      await setUserOverride(message.fingerprint, !message.isAd);
      return logLabel(message.host, message.fingerprint, message.isAd, message.source);
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => void syncSiteSettings());
  browser.runtime.onStartup.addListener(() => void syncSiteSettings());
  disabledSitesSetting.watch(() => void syncSiteSettings());

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only our own extension contexts may talk to the background.
    if (sender.id !== browser.runtime.id) return false;
    handle(message as BackgroundMessage, sender).then(sendResponse, (error: unknown) => {
      console.error("[jad-block]", error);
      sendResponse(undefined);
    });
    return true; // keeps the channel open for the async response
  });
});
