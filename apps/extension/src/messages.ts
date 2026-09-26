import type { Decision, Mode } from "@jad-block/decision-engine";
import type { CandidateFeatures, Classification } from "@jad-block/schemas";

// Messages between the extension's own contexts. Background handlers still validate payloads
// with zod, since a compromised page can't forge these but a bug upstream can.

export interface PageInitResponse {
  enabled: boolean;
  semantic: boolean;
  mode: Mode;
}

export interface ClassifyResult {
  fingerprint: string;
  classification: Classification;
  modelVersion: string;
  /** The user restored this layout before and said it wasn't an ad. */
  userOverride: boolean;
}

/** One semantic detection on a page, as shown in the popup and written to the shadow log. */
export interface SemanticEntry {
  id: string;
  fingerprint: string;
  features: CandidateFeatures;
  classification: Classification;
  modelVersion: string;
  decision: Decision;
  state: "hidden" | "would-hide" | "retained" | "restored";
}

export type BackgroundMessage =
  | { type: "page-init"; url: string }
  | { type: "classify"; candidates: CandidateFeatures[]; sensitive: boolean }
  | { type: "report"; host: string; entries: SemanticEntry[] }
  | { type: "restored"; host: string; fingerprints: string[] }
  /** "Is this an ad?" answered in the popup, either for a shadow-mode item or after a restore. */
  | {
      type: "label";
      host: string;
      fingerprint: string;
      isAd: boolean;
      source: "popup" | "restore-feedback";
    };

export type ContentMessage =
  | { type: "list-semantic" }
  | { type: "restore"; id: string }
  | { type: "restore-all" };
