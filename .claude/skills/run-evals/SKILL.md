---
name: run-evals
description: Measure semantic-detection accuracy and tune the decision thresholds. Use when changing detector signals, classifier questions, or DEFAULT_POLICY, or when the user shares an exported shadow log.
---

# Run evaluations

## Fixtures (every change, and in CI)
`bun run eval` reports precision, recall, and **breakage** (hidden elements that are or contain
content) on the synthetic fixtures, and exits 1 on any breakage. Add `-- --sweep` for a
sanity-check sweep. **Never tune thresholds from fixtures**: they're a few hand-written cases.

## Real data (threshold tuning)
1. The user browses with the extension in shadow mode and answers "Is this an ad?" in the popup.
2. They export the log from the options page into `datasets/` (gitignored, never commit it).
3. `bun run eval -- --log datasets/<export>.json [--target 0.99] [--min-hidden 20]`
   reports volumes, restore rate, precision vs. labels, and a threshold sweep.

## Changing DEFAULT_POLICY
Only on a `--log` recommendation with enough support. Then:
- update `packages/decision-engine/src/index.ts` and bump `DEFAULT_POLICY.version`
- paste the eval report into the commit message or PR
- run `bun test` (the fixture pipeline test must still pass with zero breakage)

Precision target: at least 99% at launch. A missed ad is annoying, hiding content is a serious bug.
