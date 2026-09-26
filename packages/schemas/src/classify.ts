import { z } from "zod";
import { CandidateFeatures } from "./features";

export const MAX_CANDIDATES_PER_REQUEST = 20;

const Probability = z.number().min(0).max(1);

export const ElementType = z.enum([
  "advertisement",
  "sponsored-content",
  "editorial-content",
  "navigation",
  "utility",
  "social-content",
  "unknown",
]);

/** Evidence about one candidate. Independent probabilities that aren't expected to sum to 1. */
export const Classification = z.strictObject({
  advertisement: Probability,
  sponsored: Probability,
  primaryContent: Probability,
  navigation: Probability,
  userControl: Probability,
  essentialUi: Probability,
  safeToHide: Probability,
  elementType: ElementType,
});

export const ClassifyRequest = z.strictObject({
  candidates: z.array(CandidateFeatures).min(1).max(MAX_CANDIDATES_PER_REQUEST),
});

// Probabilities only: never selectors, commands, or code (ADR 0002).
export const ClassifyResponse = z.strictObject({
  modelVersion: z.string().max(64),
  results: z.array(
    z.strictObject({
      fingerprint: z.string().regex(/^[0-9a-f]{16}$/),
      classification: Classification,
    }),
  ),
});

export type ElementType = z.infer<typeof ElementType>;
export type Classification = z.infer<typeof Classification>;
export type ClassifyRequest = z.infer<typeof ClassifyRequest>;
export type ClassifyResponse = z.infer<typeof ClassifyResponse>;
