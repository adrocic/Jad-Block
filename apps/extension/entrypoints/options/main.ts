import type { Mode } from "@semantic-blocker/decision-engine";
import { browser } from "wxt/browser";
import { clearCache } from "@/src/background/cache";
import { clearLog, readLog } from "@/src/background/log";
import {
  API_URL,
  disabledSitesSetting,
  modeSetting,
  remoteSetting,
  semanticSetting,
} from "@/src/settings";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function status(text: string): void {
  $("status").textContent = text;
}

async function renderSites(): Promise<void> {
  const sites = await disabledSitesSetting.getValue();
  $("no-sites").hidden = sites.length > 0;
  $("sites").replaceChildren(
    ...sites.map((site) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = site;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Enable";
      remove.addEventListener("click", async () => {
        const current = await disabledSitesSetting.getValue();
        await disabledSitesSetting.setValue(current.filter((s) => s !== site));
        void renderSites();
      });
      li.append(name, remove);
      return li;
    }),
  );
}

async function renderLogCount(): Promise<void> {
  $("log-count").textContent = String((await readLog()).length);
}

const REMOTE_STATUS = {
  off: "Off: semantic detection runs a local heuristic only, and nothing about the pages you visit leaves your browser.",
  on: "On: ambiguous elements are classified by the Semantic Blocker service. Sensitive sites are always classified locally.",
  unavailable: "AI classification isn't available in this build.",
  denied: "Firefox didn't grant the data-collection permission, so AI classification stays off.",
};

// Firefox's built-in consent: remote classification is declared as optional "websiteContent"
// data collection in the manifest, so it must be granted before the first request.
const FIREFOX_DATA = {
  data_collection: ["websiteContent"],
} as unknown as Browser.permissions.Permissions;

async function setupRemoteToggle(): Promise<void> {
  const toggle = $<HTMLInputElement>("remote");
  const statusEl = $("remote-status");
  if (!API_URL) {
    toggle.disabled = true;
    statusEl.textContent = REMOTE_STATUS.unavailable;
    return;
  }
  toggle.checked = await remoteSetting.getValue();
  statusEl.textContent = toggle.checked ? REMOTE_STATUS.on : REMOTE_STATUS.off;

  toggle.addEventListener("change", async () => {
    if (toggle.checked && import.meta.env.FIREFOX) {
      // Must run inside the click handler: permission prompts need a user gesture.
      const granted = await browser.permissions.request(FIREFOX_DATA).catch(() => false);
      if (!granted) {
        toggle.checked = false;
        statusEl.textContent = REMOTE_STATUS.denied;
        return;
      }
    }
    if (!toggle.checked && import.meta.env.FIREFOX) {
      await browser.permissions.remove(FIREFOX_DATA).catch(() => false);
    }
    await remoteSetting.setValue(toggle.checked);
    statusEl.textContent = toggle.checked ? REMOTE_STATUS.on : REMOTE_STATUS.off;
  });
}

async function init(): Promise<void> {
  const semantic = $<HTMLInputElement>("semantic");
  semantic.checked = await semanticSetting.getValue();
  semantic.addEventListener("change", () => void semanticSetting.setValue(semantic.checked));

  const mode = await modeSetting.getValue();
  for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="mode"]')) {
    radio.checked = radio.value === mode;
    radio.addEventListener("change", () => void modeSetting.setValue(radio.value as Mode));
  }

  await setupRemoteToggle();

  $("export-log").addEventListener("click", async () => {
    const log = await readLog();
    const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `semantic-blocker-shadow-log-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    // Revoking synchronously can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  });
  $("clear-log").addEventListener("click", async () => {
    await clearLog();
    await renderLogCount();
    status("Shadow log cleared.");
  });
  $("clear-cache").addEventListener("click", async () => {
    await clearCache();
    status("Classification cache cleared.");
  });

  await Promise.all([renderSites(), renderLogCount()]);
}

void init();
