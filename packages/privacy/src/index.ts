import { CandidateFeatures } from "@semantic-blocker/schemas";
import { sanitizeText } from "./text";

export { type SensitiveCategory, sensitiveCategory } from "./sites";
export { sanitizeText } from "./text";

/**
 * The last step before anything leaves the browser: sanitizes free text, then enforces the
 * strict schema. Unknown fields are rejected, not stripped, so a bug upstream fails loudly.
 * Throws a ZodError if the candidate doesn't conform.
 */
export function sanitizeCandidate(candidate: CandidateFeatures): CandidateFeatures {
  return CandidateFeatures.parse({
    ...candidate,
    untrustedText: sanitizeText(candidate.untrustedText),
  });
}
