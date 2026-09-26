// Evaluation reports. Usage:
//   bun run eval                              fixtures: precision/recall/breakage (exit 1 on breakage)
//   bun run eval -- --sweep                   ...plus a threshold sweep over fixture candidates
//   bun run eval -- --log <export.json>       a shadow log exported from the options page
//          [--target 0.99] [--min-hidden 20]  sweep target precision and minimum support
// Keep real exports out of the repo (datasets/ is gitignored).
import "../../test-setup";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { HeuristicClassifier } from "@semantic-blocker/classifier";
import { ShadowLog } from "@semantic-blocker/schemas";
import { evaluateFixtures } from "./fixtures";
import { analyzeLog } from "./log";
import { fixtureReport, logReport, sweepReport } from "./report";
import { recommend, sweepThresholds } from "./sweep";

const { values } = parseArgs({
  options: {
    log: { type: "string" },
    sweep: { type: "boolean", default: false },
    target: { type: "string", default: "0.99" },
    "min-hidden": { type: "string", default: "20" },
  },
});
const target = Number(values.target);
const minHidden = Number(values["min-hidden"]);

if (values.log) {
  const raw: unknown = JSON.parse(await readFile(values.log, "utf8"));
  const parsed = ShadowLog.safeParse(raw);
  if (!parsed.success) {
    console.error(`Not a shadow-log export: ${parsed.error.issues[0]?.message ?? "invalid"}`);
    process.exit(2);
  }
  const summary = analyzeLog(parsed.data);
  console.log(logReport(summary));
  if (summary.labeled > 0) {
    const rows = sweepThresholds(summary.items);
    const best = recommend(rows, target, minHidden);
    console.log(`\n${sweepReport(rows, best, target, minHidden, "log")}`);
  }
} else {
  const classifier = new HeuristicClassifier();
  const results = await evaluateFixtures(classifier);
  console.log(fixtureReport(results, classifier.modelVersion));
  if (values.sweep) {
    // Fixtures only sanity-check: any fixture false positive disqualifies (target 100%).
    const rows = sweepThresholds(results.flatMap((r) => r.items));
    console.log(`\n${sweepReport(rows, recommend(rows, 1, 3), 1, 3, "fixtures")}`);
  }
  if (results.some((r) => r.breakage.length > 0)) process.exitCode = 1;
}
