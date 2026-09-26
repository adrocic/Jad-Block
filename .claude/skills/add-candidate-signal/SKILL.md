---
name: add-candidate-signal
description: Add or change a local suspicion signal in the candidate detector (a new label phrase, ad attribute token, layout cue, or weight). Use when detection misses an ad pattern or flags real content.
---

# Add a candidate signal

1. **Reproduce it in a fixture first.** Add the pattern to a page in `fixtures/pages/` (or a new
   page registered in `fixtures/src/index.ts` `FIXTURES`). Mark the expected unit with
   `data-fixture-label` and give ad units a `data-rect="w,h"`. Write synthetic markup and never
   paste a real site's HTML.
   Also add a **near-miss** that must *not* be detected (real content resembling the pattern).
2. Run `bun test packages/candidate-detector` and confirm the new fixture fails.
3. Implement the change in `packages/candidate-detector/src/`:
   - Label phrases: `labels.ts` (add cases to `labels.test.ts`)
   - Attribute tokens, geometry, links: `analysis.ts`
   - Weights: `WEIGHTS` in `score.ts`. The feature must flow to `Analysis` first.
4. If the signal should reach the classifier, add it to `CandidateFeatures` in
   `packages/schemas` and map it in `packages/feature-extractor`. A new field sent off-device
   **requires an ADR** in `docs/adr/`. Keep it a semantic category, never a raw number.
5. `bun run check && bun test`. The fixture invariants (no candidate contains content that must
   stay visible) must still pass on every page.
