import { findCandidates, type Measure } from "@semantic-blocker/candidate-detector";
import { type Decision, decide, type Mode } from "@semantic-blocker/decision-engine";
import { extractFeatures } from "@semantic-blocker/feature-extractor";
import { sanitizeCandidate } from "@semantic-blocker/privacy";
import { type CandidateFeatures, MAX_CANDIDATES_PER_REQUEST } from "@semantic-blocker/schemas";
import type { ClassifyResult, SemanticEntry } from "../messages";
import { Hider } from "./hider";

export interface PipelineOptions {
  pageUrl: string;
  measure: Measure;
  mode: Mode;
  /** Sensitive pages (banking, webmail, ...) may only be classified locally. */
  sensitive: boolean;
  classify(candidates: CandidateFeatures[], sensitive: boolean): Promise<ClassifyResult[]>;
  report(entries: SemanticEntry[]): void;
  /** Called with the fingerprints the user restored (for the local restore-rate metric). */
  onRestore?(fingerprints: string[]): void;
}

function userOverrideDecision(policyVersion: string): Decision {
  return { action: "retain", wouldHide: false, policyVersion, reasons: ["user: not an ad"] };
}

/**
 * Runs the local pipeline for one page: detect → extract → sanitize → (L1 cache | classify) →
 * decide → hide/log. Classification failures leave candidates alone: the page never depends on it.
 */
export class SemanticPipeline {
  private readonly hider = new Hider();
  /** Element → fingerprint it was last processed with. Changed structure means re-process. */
  private readonly processed = new WeakMap<Element, string>();
  /** L1 cache: fingerprint → result, for this page's lifetime. */
  private readonly l1 = new Map<string, ClassifyResult>();
  private readonly entries = new Map<string, SemanticEntry>();
  private nextId = 1;

  constructor(private readonly options: PipelineOptions) {}

  async scan(root: Element | DocumentFragment, insertedAfterLoad: boolean): Promise<void> {
    const { pageUrl, measure } = this.options;
    const extractOptions = { pageUrl, measure, insertedAfterLoad };
    const work: { element: Element; features: CandidateFeatures }[] = [];

    for (const candidate of findCandidates(root, extractOptions)) {
      let features: CandidateFeatures;
      try {
        features = sanitizeCandidate(extractFeatures(candidate, extractOptions));
      } catch {
        continue; // never send (or act on) anything that fails the privacy schema
      }
      if (this.processed.get(candidate.element) === features.fingerprint) continue;
      this.processed.set(candidate.element, features.fingerprint);
      work.push({ element: candidate.element, features });
    }
    if (work.length === 0) return;

    await this.classifyMisses(work.map((w) => w.features));

    const added: SemanticEntry[] = [];
    for (const { element, features } of work) {
      const result = this.l1.get(features.fingerprint);
      if (!result) continue;
      const entry = this.apply(element, features, result);
      this.entries.set(entry.id, entry);
      added.push(entry);
    }
    if (added.length > 0) this.options.report(added);
  }

  private async classifyMisses(features: CandidateFeatures[]): Promise<void> {
    const misses = [...new Map(features.map((f) => [f.fingerprint, f])).values()].filter(
      (f) => !this.l1.has(f.fingerprint),
    );
    for (let i = 0; i < misses.length; i += MAX_CANDIDATES_PER_REQUEST) {
      const batch = misses.slice(i, i + MAX_CANDIDATES_PER_REQUEST);
      try {
        const results = await this.options.classify(batch, this.options.sensitive);
        for (const result of results) this.l1.set(result.fingerprint, result);
      } catch {
        // Degrade silently: DNR and cosmetic filtering still apply.
      }
    }
  }

  private apply(element: Element, features: CandidateFeatures, result: ClassifyResult) {
    const id = String(this.nextId++);
    const base = decide(result.classification, features, this.options.mode);
    const decision = result.userOverride ? userOverrideDecision(base.policyVersion) : base;
    let state: SemanticEntry["state"] = "retained";
    if (decision.action === "hide" && this.hider.hide(element, id)) state = "hidden";
    else if (decision.wouldHide) state = "would-hide";
    return {
      id,
      fingerprint: features.fingerprint,
      features,
      classification: result.classification,
      modelVersion: result.modelVersion,
      decision,
      state,
    } satisfies SemanticEntry;
  }

  list(): SemanticEntry[] {
    return [...this.entries.values()];
  }

  restore(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry || !this.hider.restore(id)) return false;
    entry.state = "restored";
    this.options.onRestore?.([entry.fingerprint]);
    return true;
  }

  restoreAll(): void {
    const fingerprints: string[] = [];
    for (const id of this.hider.restoreAll()) {
      const entry = this.entries.get(id);
      if (!entry) continue;
      entry.state = "restored";
      fingerprints.push(entry.fingerprint);
    }
    if (fingerprints.length > 0) this.options.onRestore?.(fingerprints);
  }
}
