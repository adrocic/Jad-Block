import { browser } from "wxt/browser";
import { setUserOverride } from "@/src/background/cache";
import { classifyCandidates } from "@/src/background/classify";
import { injectPageCss, syncGenericCosmetics } from "@/src/background/cosmetic";
import { appendToLog } from "@/src/background/log";
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
      return appendToLog(message.host, message.entries);
    case "feedback":
      return setUserOverride(message.fingerprint, message.wronglyHidden);
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
      console.error("[semantic-blocker]", error);
      sendResponse(undefined);
    });
    return true; // keeps the channel open for the async response
  });
});
