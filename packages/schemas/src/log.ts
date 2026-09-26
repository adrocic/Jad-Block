import { z } from "zod";
import { Classification } from "./classify";
import { CandidateFeatures } from "./features";

// The local shadow log: written by the extension, exported from its options page, read by
// tools/eval. It stays on the user's machine unless they export it. Not strict (unlike the
// network schemas) so older exports with extra fields still load.

const Base = { at: z.number(), host: z.string(), fingerprint: z.string() };

export const DetectionEvent = z.object({
  ...Base,
  // Older exports predate `kind`; they were all detections.
  kind: z.literal("detection").default("detection"),
  features: CandidateFeatures,
  classification: Classification,
  modelVersion: z.string(),
  decision: z.object({
    action: z.enum(["hide", "retain"]),
    wouldHide: z.boolean(),
    policyVersion: z.string(),
    reasons: z.array(z.string()),
  }),
  state: z.enum(["hidden", "would-hide", "retained", "restored"]),
});

/** A human judgment: "is this an ad?" from the popup, or "wrongly hidden?" after a restore. */
export const LabelEvent = z.object({
  ...Base,
  kind: z.literal("label"),
  isAd: z.boolean(),
  source: z.enum(["popup", "restore-feedback"]),
});

export const RestoreEvent = z.object({ ...Base, kind: z.literal("restore") });

export const LogEvent = z.union([LabelEvent, RestoreEvent, DetectionEvent]);
export const ShadowLog = z.array(LogEvent);

export type DetectionEvent = z.infer<typeof DetectionEvent>;
export type LabelEvent = z.infer<typeof LabelEvent>;
export type RestoreEvent = z.infer<typeof RestoreEvent>;
export type LogEvent = z.infer<typeof LogEvent>;
