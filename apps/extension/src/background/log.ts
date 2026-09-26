import type { LogEvent } from "@semantic-blocker/schemas";
import { browser } from "wxt/browser";
import type { SemanticEntry } from "../messages";

/**
 * Local-only event log: semantic detections plus the user's labels and restores. tools/eval turns
 * an export of it into precision and restore-rate reports. It never leaves the browser unless the
 * user exports it from the options page. Schema: packages/schemas/src/log.ts.
 */
const KEY = "shadowLog";
export const MAX_LOG_ENTRIES = 2000;

async function append(events: readonly LogEvent[]): Promise<void> {
  if (events.length === 0) return;
  const { [KEY]: existing = [] } = (await browser.storage.local.get(KEY)) as {
    [KEY]?: LogEvent[];
  };
  await browser.storage.local.set({ [KEY]: [...existing, ...events].slice(-MAX_LOG_ENTRIES) });
}

export function logDetections(host: string, entries: readonly SemanticEntry[]): Promise<void> {
  const at = Date.now();
  return append(
    entries.map(({ id: _id, ...entry }) => ({ ...entry, kind: "detection" as const, at, host })),
  );
}

export function logLabel(
  host: string,
  fingerprint: string,
  isAd: boolean,
  source: "popup" | "restore-feedback",
): Promise<void> {
  return append([{ kind: "label", at: Date.now(), host, fingerprint, isAd, source }]);
}

export function logRestores(host: string, fingerprints: readonly string[]): Promise<void> {
  const at = Date.now();
  return append(
    fingerprints.map((fingerprint) => ({ kind: "restore" as const, at, host, fingerprint })),
  );
}

export async function readLog(): Promise<LogEvent[]> {
  const { [KEY]: log = [] } = (await browser.storage.local.get(KEY)) as { [KEY]?: LogEvent[] };
  return log;
}

export async function clearLog(): Promise<void> {
  await browser.storage.local.remove(KEY);
}
