import type { CandidateFeatures, Classification } from "@jad-block/schemas";

/** Shadow mode logs what would be hidden without touching the page (see docs/build-plan.md). */
export type Mode = "shadow" | "enforce";

export interface Policy {
  version: string;
  minAdOrSponsored: number;
  minSafeToHide: number;
  maxPrimaryContent: number;
  maxEssentialUi: number;
  maxNavigation: number;
  maxUserControl: number;
}

/**
 * PLACEHOLDER thresholds, deliberately strict. Replace them with values measured from shadow-mode
 * evaluation data (tools/eval). Precision beats recall: hiding real content is the serious failure.
 */
export const DEFAULT_POLICY: Policy = {
  version: "2026-09-25-placeholder",
  minAdOrSponsored: 0.95,
  minSafeToHide: 0.95,
  maxPrimaryContent: 0.05,
  maxEssentialUi: 0.05,
  maxNavigation: 0.1,
  maxUserControl: 0.1,
};

export interface Decision {
  action: "hide" | "retain";
  /** What enforce mode would do. In shadow mode this is logged while `action` stays "retain". */
  wouldHide: boolean;
  policyVersion: string;
  /** Why the candidate was retained. Empty when it would be hidden. */
  reasons: string[];
}

/**
 * Turns classifier evidence into an action. Local structure can veto the classifier (never the
 * reverse), so manipulated page text can't talk the extension into hiding navigation or forms.
 */
export function decide(
  classification: Classification,
  features: CandidateFeatures,
  mode: Mode,
  policy: Policy = DEFAULT_POLICY,
): Decision {
  const c = classification;
  const reasons: string[] = [];
  const fail = (condition: boolean, reason: string) => condition && reasons.push(reason);

  fail(features.position === "navigation-area", "local: inside navigation");
  fail(features.interaction.form, "local: contains form controls");
  fail(
    Math.max(c.advertisement, c.sponsored) < policy.minAdOrSponsored,
    "not confidently an ad or sponsored",
  );
  fail(c.safeToHide < policy.minSafeToHide, "not confidently safe to hide");
  fail(c.primaryContent > policy.maxPrimaryContent, "may be primary content");
  fail(c.essentialUi > policy.maxEssentialUi, "may be essential UI");
  fail(c.navigation > policy.maxNavigation, "may be navigation");
  fail(c.userControl > policy.maxUserControl, "may be a user control");

  const wouldHide = reasons.length === 0;
  return {
    action: wouldHide && mode === "enforce" ? "hide" : "retain",
    wouldHide,
    policyVersion: policy.version,
    reasons,
  };
}
