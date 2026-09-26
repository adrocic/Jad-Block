# packages/decision-engine

The only code that decides whether a semantically classified element gets hidden (ADR 0002).

- Changing a threshold needs evidence: an eval report from `tools/eval` showing precision
  doesn't drop. Bump `DEFAULT_POLICY.version` whenever thresholds change.
- Local vetoes (navigation, forms) may be added freely. Never add a path where the classifier
  overrides a local veto.
- Every new rule needs a test in `decide.test.ts` that shows it retaining something.
