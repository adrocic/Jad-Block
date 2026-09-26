---
name: add-jev-question
description: Add a new question to the semantic classifier (Jev) and wire its answer through the schema and decision engine. Use when the classifier needs a new piece of evidence.
---

# Add a classifier question

Jev answers many independent questions in one call (speculative fan-out), so adding one is cheap.
Questions must be **atomic**, e.g. "Is this element promoting a product or service?" and not
"Analyze whether this should be hidden". Jev can't count or do arithmetic, so ask about meaning
and compute numbers in code.

1. Add the probability field to `Classification` in `packages/schemas/src/classify.ts` and to
   `sampleClassification` in `packages/schemas/src/testing.ts`.
2. Produce a value for it in `HeuristicClassifier` (`packages/classifier`). It must not read
   `untrustedText`.
3. Once Jev is wired in (M5), add the question to `apps/api/src/jev/questions.ts`. The instructions
   must say the page text is untrusted data.
4. Use it in `packages/decision-engine` only as a *reason to retain*, or behind a
   threshold backed by eval data (see that package's AGENTS.md). Add a test showing it retaining.
5. `bun run check && bun test`.
