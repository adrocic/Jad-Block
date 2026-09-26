import { browser } from "wxt/browser";
import type { BackgroundMessage, ContentMessage, SemanticEntry } from "@/src/messages";
import { disabledSitesSetting, isHostDisabled, modeSetting } from "@/src/settings";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const STATE_LABELS: Record<SemanticEntry["state"], string> = {
  hidden: "Hidden",
  "would-hide": "Would hide",
  retained: "Kept",
  restored: "Restored",
};

function describe(entry: SemanticEntry): string {
  const type = entry.classification.elementType.replace("-", " ");
  return type.charAt(0).toUpperCase() + type.slice(1);
}

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function sendToTab<T>(tabId: number, message: ContentMessage): Promise<T | undefined> {
  return browser.tabs.sendMessage(tabId, message, { frameId: 0 }).catch(() => undefined) as Promise<
    T | undefined
  >;
}

/** Fingerprints answered while this popup is open, so re-renders don't ask again. */
const answered = new Set<string>();

function renderEntry(host: string, tabId: number, entry: SemanticEntry): HTMLElement {
  const template = $<HTMLTemplateElement>("entry-template");
  const li = template.content.firstElementChild?.cloneNode(true) as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => li.querySelector(selector) as T;

  // textContent only: entry text comes from web pages and must never be parsed as HTML.
  q(".entry-kind").textContent = describe(entry);
  q(".entry-state").textContent = STATE_LABELS[entry.state];
  q(".entry-text").textContent = entry.features.untrustedText;

  const restore = q<HTMLButtonElement>(".restore");
  const question = q(".question");
  const thanks = q(".thanks");
  const ask = (text: string, source: "popup" | "restore-feedback", yesMeansAd: boolean) => {
    q(".question-text").textContent = text;
    question.hidden = false;
    const answer = (yes: boolean) => async () => {
      // Labels stay in the local log and feed tools/eval. "Not an ad" also stops future hiding.
      const message: BackgroundMessage = {
        type: "label",
        host,
        fingerprint: entry.fingerprint,
        isAd: yes === yesMeansAd,
        source,
      };
      await browser.runtime.sendMessage(message);
      answered.add(entry.fingerprint);
      question.hidden = true;
      thanks.hidden = false;
    };
    q(".answer-yes").addEventListener("click", answer(true));
    q(".answer-no").addEventListener("click", answer(false));
  };

  if (answered.has(entry.fingerprint)) {
    thanks.hidden = false;
  } else if (entry.state === "would-hide") {
    ask("Is this an ad?", "popup", true);
  } else if (entry.state === "hidden") {
    restore.hidden = false;
    restore.addEventListener("click", async () => {
      await sendToTab(tabId, { type: "restore", id: entry.id });
      restore.hidden = true;
      q(".entry-state").textContent = STATE_LABELS.restored;
      ask("Wrongly hidden?", "restore-feedback", false);
    });
  }
  return li;
}

async function render(): Promise<void> {
  const tab = await activeTab();
  const url = tab?.url ? new URL(tab.url) : null;
  if (!tab?.id || !url?.protocol.startsWith("http")) {
    $("semantic").hidden = true;
    $("unavailable").hidden = false;
    $<HTMLInputElement>("site-enabled").disabled = true;
    return;
  }
  const tabId = tab.id;
  const host = url.hostname;
  $("host").textContent = host;

  const [disabled, mode] = await Promise.all([
    disabledSitesSetting.getValue(),
    modeSetting.getValue(),
  ]);
  const toggle = $<HTMLInputElement>("site-enabled");
  toggle.checked = !isHostDisabled(disabled, host);
  toggle.onchange = async () => {
    const current = await disabledSitesSetting.getValue();
    const next = toggle.checked
      ? current.filter((site) => site !== host)
      : [...new Set([...current, host])];
    await disabledSitesSetting.setValue(next);
    await browser.tabs.reload(tabId);
    window.close();
  };

  const entries = (await sendToTab<SemanticEntry[]>(tabId, { type: "list-semantic" })) ?? [];
  const flagged = entries.filter((e) => e.state !== "retained");
  const hidden = entries.filter((e) => e.state === "hidden").length;
  $("summary").textContent =
    mode === "shadow"
      ? `${flagged.length} detected semantically · ${entries.length} checked`
      : `${hidden} hidden semantically · ${entries.length} checked`;
  $("shadow-note").hidden = mode !== "shadow";

  const list = $("entries");
  list.replaceChildren(...flagged.map((entry) => renderEntry(host, tabId, entry)));

  const restoreAll = $<HTMLButtonElement>("restore-all");
  restoreAll.hidden = hidden === 0;
  restoreAll.onclick = async () => {
    await sendToTab(tabId, { type: "restore-all" });
    void render();
  };
}

$("open-options").addEventListener("click", () => void browser.runtime.openOptionsPage());
void render();
