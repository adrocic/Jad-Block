# packages/privacy

This package is the privacy boundary. Everything sent off-device passes through `sanitizeCandidate`.

- Every new redaction pattern or sensitive-site rule needs a test in `privacy.test.ts`,
  with at least one positive case and one near-miss that must not be redacted or flagged.
- Err toward redacting. Over-redaction costs classification accuracy, under-redaction leaks data.
- Never loosen `sanitizeCandidate` to strip unknown fields silently. It must reject them.
- Don't add dependencies here without an ADR.
