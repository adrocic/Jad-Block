import { browser } from "wxt/browser";
import type { SemanticEntry } from "../messages";

/**
 * Local-only record of semantic detections, used to measure precision before enabling hiding
 * (tools/eval). It never leaves the browser unless the user exports it from the options page.
 */
export interface ShadowLogEntry extends Omit<SemanticEntry, "id"> {
  at: number;
  host: string;
}

const KEY = "shadowLog";
export const MAX_LOG_ENTRIES = 2000;

export async function appendToLog(host: string, entries: readonly SemanticEntry[]): Promise<void> {
  const { [KEY]: existing = [] } = (await browser.storage.local.get(KEY)) as {
    [KEY]?: ShadowLogEntry[];
  };
  const at = Date.now();
  const added = entries.map(({ id: _id, ...entry }) => ({ ...entry, at, host }));
  await browser.storage.local.set({ [KEY]: [...existing, ...added].slice(-MAX_LOG_ENTRIES) });
}

export async function readLog(): Promise<ShadowLogEntry[]> {
  const { [KEY]: log = [] } = (await browser.storage.local.get(KEY)) as {
    [KEY]?: ShadowLogEntry[];
  };
  return log;
}

export async function clearLog(): Promise<void> {
  await browser.storage.local.remove(KEY);
}
