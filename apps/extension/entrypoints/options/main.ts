import type { Mode } from "@semantic-blocker/decision-engine";
import { clearCache } from "@/src/background/cache";
import { clearLog, readLog } from "@/src/background/log";
import { disabledSitesSetting, modeSetting, semanticSetting } from "@/src/settings";

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

async function init(): Promise<void> {
  const semantic = $<HTMLInputElement>("semantic");
  semantic.checked = await semanticSetting.getValue();
  semantic.addEventListener("change", () => void semanticSetting.setValue(semantic.checked));

  const mode = await modeSetting.getValue();
  for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="mode"]')) {
    radio.checked = radio.value === mode;
    radio.addEventListener("change", () => void modeSetting.setValue(radio.value as Mode));
  }

  $("export-log").addEventListener("click", async () => {
    const log = await readLog();
    const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `semantic-blocker-shadow-log-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
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
