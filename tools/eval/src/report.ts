import type { FixtureResult } from "./fixtures";
import type { LogSummary } from "./log";
import { add, type Confusion, pct, precision, recall } from "./metrics";
import type { SweepRow } from "./sweep";

const row = (cells: (string | number)[]) => `| ${cells.join(" | ")} |`;

function confusionCells(c: Confusion) {
  return [pct(precision(c)), pct(recall(c)), c.tp, c.fp, c.fn];
}

export function fixtureReport(results: readonly FixtureResult[], modelVersion: string): string {
  const total = results.reduce((sum, r) => add(sum, r.confusion), { tp: 0, fp: 0, fn: 0, tn: 0 });
  const breakage = results.flatMap((r) => r.breakage.map((b) => `- **${r.name}**: ${b}`));
  return [
    `## Fixture evaluation (${modelVersion}, enforce mode)`,
    "",
    row(["Fixture", "Precision", "Recall", "TP", "FP", "FN", "Breakage"]),
    row(["---", "---", "---", "---", "---", "---", "---"]),
    ...results.map((r) => row([r.name, ...confusionCells(r.confusion), r.breakage.length])),
    row(["**Total**", ...confusionCells(total), breakage.length]),
    "",
    breakage.length === 0
      ? "No content was hidden. ✅"
      : ["**Hidden content (breakage):**", ...breakage].join("\n"),
  ].join("\n");
}

export function logReport(s: LogSummary): string {
  const kv = (o: Record<string, number>) =>
    Object.entries(o)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ") || "none";
  return [
    "## Shadow log",
    "",
    `- Detections: ${s.detections} (${s.uniqueElements} distinct elements on ${s.hosts} sites)`,
    `- By model: ${kv(s.byModel)}`,
    `- By state: ${kv(s.byState)}`,
    `- Restore rate: ${pct(s.restoreRate)} (${s.restoredElements} of ${s.hiddenElements} hidden elements restored)`,
    `- Labeled elements: ${s.labeled}`,
    "",
    s.labeled === 0
      ? "No labels yet. Answer “Is this an ad?” in the popup while browsing in shadow mode."
      : [
          "### Current policy vs. your labels",
          "",
          row(["Precision", "Recall", "TP", "FP", "FN"]),
          row(["---", "---", "---", "---", "---"]),
          row(confusionCells(s.labeledConfusion)),
        ].join("\n"),
  ].join("\n");
}

export function sweepReport(
  rows: readonly SweepRow[],
  best: SweepRow | null,
  target: number,
  minHidden: number,
  source: "fixtures" | "log",
): string {
  if (source === "fixtures") {
    const safe = best ? `${best.minAdOrSponsored}/${best.minSafeToHide}` : "none";
    return [
      "## Threshold sweep (fixtures: sanity check only)",
      "",
      `Fixtures are a handful of hand-written cases designed to test behavior, not a sample of the web. ` +
        `Never tune DEFAULT_POLICY from them. Most permissive thresholds with no fixture false positives: ${safe}. ` +
        "Tune on labeled shadow-log exports instead: `bun run eval -- --log <export.json>`.",
    ].join("\n");
  }
  const top = [...rows]
    .filter((r) => r.precision !== null)
    .sort((a, b) => (b.precision ?? 0) - (a.precision ?? 0) || (b.recall ?? 0) - (a.recall ?? 0))
    .slice(0, 10);
  return [
    "## Threshold sweep",
    "",
    row(["minAdOrSponsored", "minSafeToHide", "Precision", "Recall", "TP", "FP", "FN"]),
    row(["---", "---", "---", "---", "---", "---", "---"]),
    ...top.map((r) => row([r.minAdOrSponsored, r.minSafeToHide, ...confusionCells(r.confusion)])),
    "",
    best
      ? `**Recommendation:** minAdOrSponsored=${best.minAdOrSponsored}, minSafeToHide=${best.minSafeToHide} ` +
        `(precision ${pct(best.precision)}, recall ${pct(best.recall)} on ${best.confusion.tp + best.confusion.fp} hides). ` +
        "Update DEFAULT_POLICY and bump its version (packages/decision-engine/AGENTS.md)."
      : `**No recommendation:** no thresholds reach ${pct(target)} precision with at least ${minHidden} hides. Keep the current policy and label more data.`,
  ].join("\n");
}
