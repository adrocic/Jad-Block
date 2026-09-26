import type { Classification } from "@semantic-blocker/schemas";
import { browser } from "wxt/browser";
import knownFingerprints from "../known-fingerprints.json";

// L1 (per page, memory) lives in the content script. This module is L2 (browser.storage.local,
// persistent) and L3 (fingerprints packaged with the extension).

const PREFIX = "cls:";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredEntry {
  classification: Classification;
  modelVersion: string;
  storedAt: number;
}

export interface CacheHit {
  classification: Classification;
  modelVersion: string;
  userOverride: boolean;
}

const packaged = knownFingerprints as Record<string, Classification>;
const PACKAGED_VERSION = "packaged";
const OVERRIDE_PREFIX = "override:";

/**
 * Looks fingerprints up in L3 then L2. Stored entries from a different model version are ignored,
 * so switching classifiers (e.g. heuristic to Jev) doesn't serve stale evidence.
 */
export async function lookup(
  fingerprints: readonly string[],
  modelVersion: string,
  now = Date.now(),
): Promise<Map<string, CacheHit>> {
  const keys = fingerprints.flatMap((fp) => [PREFIX + fp, OVERRIDE_PREFIX + fp]);
  const stored = await browser.storage.local.get(keys);
  const hits = new Map<string, CacheHit>();
  for (const fp of fingerprints) {
    const userOverride = stored[OVERRIDE_PREFIX + fp] === true;
    const known = packaged[fp];
    const entry = stored[PREFIX + fp] as StoredEntry | undefined;
    if (known) {
      hits.set(fp, { classification: known, modelVersion: PACKAGED_VERSION, userOverride });
    } else if (entry && entry.modelVersion === modelVersion && now - entry.storedAt < TTL_MS) {
      hits.set(fp, { ...entry, userOverride });
    }
  }
  return hits;
}

export async function store(
  results: readonly { fingerprint: string; classification: Classification }[],
  modelVersion: string,
  now = Date.now(),
): Promise<void> {
  const items: Record<string, StoredEntry> = {};
  for (const { fingerprint, classification } of results) {
    items[PREFIX + fingerprint] = { classification, modelVersion, storedAt: now };
  }
  await browser.storage.local.set(items);
}

/** The user restored this layout and said it was wrongly hidden: never hide it again. */
export async function setUserOverride(fingerprint: string, wronglyHidden: boolean): Promise<void> {
  if (wronglyHidden) await browser.storage.local.set({ [OVERRIDE_PREFIX + fingerprint]: true });
  else await browser.storage.local.remove(OVERRIDE_PREFIX + fingerprint);
}

export async function clearCache(): Promise<void> {
  const all = await browser.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith(PREFIX));
  await browser.storage.local.remove(keys);
}
