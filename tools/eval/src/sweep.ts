import { DEFAULT_POLICY, decide, type Policy } from "@jad-block/decision-engine";
import type { LabeledItem } from "./fixtures";
import { type Confusion, confusion, precision, recall } from "./metrics";

export interface SweepRow {
  minAdOrSponsored: number;
  minSafeToHide: number;
  maxPrimaryContent: number;
  maxEssentialUi: number;
  confusion: Confusion;
  precision: number | null;
  recall: number | null;
}

const GRID = [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.97, 0.99];
/** Ceilings for "may be primary content" and "may be essential UI". Never looser than 0.2. */
const VETO_GRID = [0.05, 0.1, 0.15, 0.2];

/**
 * Re-decides every labeled item under a grid of thresholds: the two hide thresholds, plus the
 * primary-content and essential-UI ceilings, which a calibrated classifier like Jev rarely puts
 * below 0.05 even for obvious ads. Local vetoes (navigation area, forms) and the navigation and
 * user-control ceilings stay at the base policy.
 */
export function sweepThresholds(
  items: readonly LabeledItem[],
  base: Policy = DEFAULT_POLICY,
  grid: readonly number[] = GRID,
  vetoGrid: readonly number[] = VETO_GRID,
): SweepRow[] {
  const rows: SweepRow[] = [];
  for (const minAdOrSponsored of grid) {
    for (const minSafeToHide of grid) {
      for (const maxPrimaryContent of vetoGrid) {
        for (const maxEssentialUi of vetoGrid) {
          const policy = {
            ...base,
            minAdOrSponsored,
            minSafeToHide,
            maxPrimaryContent,
            maxEssentialUi,
          };
          const c = confusion(
            items.map((item) => ({
              predicted: decide(item.classification, item.features, "enforce", policy).wouldHide,
              actual: item.isAd,
            })),
          );
          rows.push({
            minAdOrSponsored,
            minSafeToHide,
            maxPrimaryContent,
            maxEssentialUi,
            confusion: c,
            precision: precision(c),
            recall: recall(c),
          });
        }
      }
    }
  }
  return rows;
}

/**
 * The most permissive thresholds (highest recall) whose precision meets the target, requiring at
 * least `minHidden` hides so a single lucky example can't qualify. Ties go to stricter thresholds,
 * tightest veto ceilings first.
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
      a.maxEssentialUi - b.maxEssentialUi ||
      a.maxPrimaryContent - b.maxPrimaryContent ||
      b.minSafeToHide - a.minSafeToHide ||
      b.minAdOrSponsored - a.minAdOrSponsored,
  );
  return qualifying[0] ?? null;
}
