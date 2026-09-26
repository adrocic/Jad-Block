import type { Classification } from "@jad-block/schemas";
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
}

const packaged = knownFingerprints as Record<string, Classification>;
const PACKAGED_VERSION = "packaged";
// Overrides are stored separately from classifications and never expire, so clearing or
// expiring the cache can't bring back something the user said was wrongly hidden.
const OVERRIDE_PREFIX = "override:";

/**
 * Looks fingerprints up in L3 then L2. `accept` filters stored entries by the model that produced
 * them, e.g. skipping local-heuristic results once remote classification is on so they upgrade.
 */
export async function lookup(
  fingerprints: readonly string[],
  accept: (modelVersion: string) => boolean,
  now = Date.now(),
): Promise<Map<string, CacheHit>> {
  const stored = await browser.storage.local.get(fingerprints.map((fp) => PREFIX + fp));
  const hits = new Map<string, CacheHit>();
  for (const fp of fingerprints) {
    const known = packaged[fp];
    const entry = stored[PREFIX + fp] as StoredEntry | undefined;
    if (known) {
      hits.set(fp, { classification: known, modelVersion: PACKAGED_VERSION });
    } else if (entry && accept(entry.modelVersion) && now - entry.storedAt < TTL_MS) {
      hits.set(fp, { classification: entry.classification, modelVersion: entry.modelVersion });
    }
  }
  return hits;
}

/** Fingerprints the user marked as "not an ad" after restoring them. */
export async function readOverrides(fingerprints: readonly string[]): Promise<Set<string>> {
  const stored = await browser.storage.local.get(fingerprints.map((fp) => OVERRIDE_PREFIX + fp));
  return new Set(fingerprints.filter((fp) => stored[OVERRIDE_PREFIX + fp] === true));
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
