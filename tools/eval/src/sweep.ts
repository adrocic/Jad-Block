import { DEFAULT_POLICY, decide, type Policy } from "@semantic-blocker/decision-engine";
import type { LabeledItem } from "./fixtures";
import { type Confusion, confusion, precision, recall } from "./metrics";

export interface SweepRow {
  minAdOrSponsored: number;
  minSafeToHide: number;
  confusion: Confusion;
  precision: number | null;
  recall: number | null;
}

const GRID = [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.97, 0.99];

/**
 * Re-decides every labeled item under a grid of the two main hide thresholds. The veto thresholds
 * (primary content, essential UI, navigation, user control) and local vetoes stay at the base
 * policy: the sweep only explores how eager hiding is, never what may be hidden.
 */
export function sweepThresholds(
  items: readonly LabeledItem[],
  base: Policy = DEFAULT_POLICY,
  grid: readonly number[] = GRID,
): SweepRow[] {
  const rows: SweepRow[] = [];
  for (const minAdOrSponsored of grid) {
    for (const minSafeToHide of grid) {
      const policy = { ...base, minAdOrSponsored, minSafeToHide };
      const c = confusion(
        items.map((item) => ({
          predicted: decide(item.classification, item.features, "enforce", policy).wouldHide,
          actual: item.isAd,
        })),
      );
      rows.push({
        minAdOrSponsored,
        minSafeToHide,
        confusion: c,
        precision: precision(c),
        recall: recall(c),
      });
    }
  }
  return rows;
}

/**
 * The most permissive thresholds (highest recall) whose precision meets the target, requiring at
 * least `minHidden` hides so a single lucky example can't qualify. Ties go to stricter thresholds.
 * Returns null when nothing qualifies: then keep the current policy.
 */
export function recommend(
  rows: readonly SweepRow[],
  targetPrecision: number,
  minHidden = 20,
): SweepRow | null {
  const qualifying = rows.filter(
    (r) =>
      r.precision !== null &&
      r.precision >= targetPrecision &&
      r.confusion.tp + r.confusion.fp >= minHidden,
  );
  qualifying.sort(
    (a, b) =>
      (b.recall ?? 0) - (a.recall ?? 0) ||
      b.minSafeToHide - a.minSafeToHide ||
      b.minAdOrSponsored - a.minAdOrSponsored,
  );
  return qualifying[0] ?? null;
}
