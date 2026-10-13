// Evaluation reports. Usage:
//   bun run eval                              fixtures: precision/recall/breakage (exit 1 on breakage)
//   bun run eval -- --sweep                   ...plus a threshold sweep over fixture candidates
//   bun run eval -- --log <export.json>       a shadow log exported from the options page; repeat
//                                             --log to combine several exports
//          [--target 0.99] [--min-hidden 20]  sweep target precision and minimum support
//   bun run eval -- --classifier jev          fixtures through live Jev (key from env or apps/api/.dev.vars)
//          [--record]                         ...and save the responses for CI replay (fixtures/recordings)
//   bun run eval -- --classifier jev-replay   fixtures through recorded Jev responses (offline)
// Keep real exports out of the repo (datasets/ is gitignored).
import { nativeFetch } from "./native-fetch";
import "../../test-setup";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { parseArgs } from "node:util";
import { HeuristicClassifier, type SemanticClassifier } from "@jad-block/classifier";
import { type LogEvent, ShadowLog } from "@jad-block/schemas";
import { evaluateFixtures } from "./fixtures";
import { liveJev, loadApiKey, RECORDINGS_PATH, replayJev } from "./jev";
import { analyzeLog } from "./log";
import { fixtureReport, logReport, sweepReport } from "./report";
import { recommend, sweepThresholds } from "./sweep";

const { values } = parseArgs({
  options: {
    log: { type: "string", multiple: true },
    sweep: { type: "boolean", default: false },
    classifier: { type: "string", default: "heuristic" },
    record: { type: "boolean", default: false },
    target: { type: "string", default: "0.99" },
    "min-hidden": { type: "string", default: "20" },
  },
});
const target = Number(values.target);
const minHidden = Number(values["min-hidden"]);

if (values.log?.length) {
  const events = new Map<string, LogEvent>();
  for (const path of values.log) {
    const parsed = ShadowLog.safeParse(JSON.parse(await readFile(resolveInput(path), "utf8")));
    if (!parsed.success) {
      console.error(
        `${path}: not a shadow-log export: ${parsed.error.issues[0]?.message ?? "invalid"}`,
      );
      process.exit(2);
    }
    // Overlapping exports (log not cleared in between) repeat events. Key by content plus
    // occurrence within the file, so cross-file repeats collapse but identical elements detected
    // in the same scan still count separately.
    const seen = new Map<string, number>();
    for (const e of parsed.data) {
      const content = JSON.stringify(e);
      const n = (seen.get(content) ?? 0) + 1;
      seen.set(content, n);
      events.set(`${content}#${n}`, e);
    }
  }
  // analyzeLog keeps the latest event per element, so order by time across files.
  const summary = analyzeLog([...events.values()].sort((a, b) => a.at - b.at));
  console.log(logReport(summary));
  if (summary.labeled > 0) {
    const rows = sweepThresholds(summary.items);
    const best = recommend(rows, target, minHidden);
    console.log(`\n${sweepReport(rows, best, target, minHidden, "log")}`);
  }
} else {
  const { classifier, save } = pickClassifier();
  const results = await evaluateFixtures(classifier);
  if (save) {
    await save();
    console.log(`Saved Jev recordings to ${RECORDINGS_PATH}
`);
  }
  console.log(fixtureReport(results, classifier.modelVersion));
  if (values.sweep) {
    // Fixtures only sanity-check: any fixture false positive disqualifies (target 100%).
    const rows = sweepThresholds(results.flatMap((r) => r.items));
    console.log(`\n${sweepReport(rows, recommend(rows, 1, 3), 1, 3, "fixtures")}`);
  }
  if (results.some((r) => r.breakage.length > 0)) process.exitCode = 1;
}

function pickClassifier(): { classifier: SemanticClassifier; save?: () => Promise<void> } {
  switch (values.classifier) {
    case "heuristic":
      return { classifier: new HeuristicClassifier() };
    case "jev-replay":
      return { classifier: replayJev() };
    case "jev": {
      const apiKey = loadApiKey();
      if (!apiKey) {
        console.error("Set TYPESAFE_API_KEY or put it in apps/api/.dev.vars.");
        process.exit(2);
      }
      const jev = liveJev(apiKey, nativeFetch, values.record);
      return values.record ? jev : { classifier: jev.classifier };
    }
    default:
      console.error(`Unknown --classifier "${values.classifier}" (heuristic, jev, jev-replay).`);
      process.exit(2);
  }
}

/**
 * `bun run eval` runs this script from tools/eval, and Bun doesn't pass on the directory it was
 * started from. Relative paths are meant from the repo root (e.g. datasets/...), so try that first.
 */
function resolveInput(path: string): string {
  if (isAbsolute(path)) return path;
  const fromRoot = join(import.meta.dir, "..", "..", "..", path);
  return existsSync(fromRoot) ? fromRoot : path;
}
