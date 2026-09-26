# 0002: The server returns evidence, never instructions

**Status:** accepted (2026-09-25)

## Decision
`/v1/classify` returns only probabilities (and a model version). All hide/retain logic and
thresholds are packaged in the extension (`packages/decision-engine`). The server never sends
selectors, DOM commands, or code.

## Why
- Chrome MV3 prohibits remotely hosted logic, and a clear evidence-versus-decision split is
  easy to defend in store review.
- A compromised or misbehaving backend can at worst cause wrong probabilities, not arbitrary page changes.
- Thresholds are versioned, testable, and tuned from shadow-mode evaluation data.
