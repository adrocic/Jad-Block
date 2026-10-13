import type { Mode } from "@jad-block/decision-engine";
import type { SemanticEntry } from "./messages";

const ORDER: Record<SemanticEntry["state"], number> = {
  hidden: 0,
  "would-hide": 1,
  restored: 2,
  retained: 3,
};

/**
 * Popup rows. Shadow mode lists everything that was checked, so the user can label kept elements
 * too: thresholds can't be tuned from would-hide labels alone, and a strict classifier may
 * produce none. Enforce mode lists only what was acted on. Most actionable first.
 */
export function popupEntries(entries: readonly SemanticEntry[], mode: Mode): SemanticEntry[] {
  const shown = mode === "shadow" ? entries : entries.filter((e) => e.state !== "retained");
  return [...shown].sort((a, b) => ORDER[a.state] - ORDER[b.state]);
}

/** Whether a row asks "Is this an ad?". Hidden rows ask after a restore instead. */
export function asksIsAd(entry: SemanticEntry, mode: Mode): boolean {
  return entry.state === "would-hide" || (mode === "shadow" && entry.state === "retained");
}

export function stateLabel(state: SemanticEntry["state"], mode: Mode): string {
  switch (state) {
    case "hidden":
      return "Hidden";
    case "would-hide":
      return "Would hide";
    case "restored":
      return "Restored";
    case "retained":
      return mode === "shadow" ? "Would keep" : "Kept";
  }
}
