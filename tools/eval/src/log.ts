import type { DetectionEvent, LabelEvent, LogEvent } from "@semantic-blocker/schemas";
import type { LabeledItem } from "./fixtures";
import { type Confusion, confusion } from "./metrics";

export interface LogSummary {
  detections: number;
  uniqueElements: number;
  hosts: number;
  byModel: Record<string, number>;
  byState: Record<string, number>;
  /** Distinct (host, fingerprint) elements that were actually hidden in enforce mode. */
  hiddenElements: number;
  restoredElements: number;
  /** restored / hidden. The strongest real-world false-positive signal (build plan §25). */
  restoreRate: number | null;
  labeled: number;
  /** Would-hide vs. the user's labels, over labeled elements only. */
  labeledConfusion: Confusion;
  items: LabeledItem[];
}

const keyOf = (e: { host: string; fingerprint: string }) => `${e.host}|${e.fingerprint}`;

function count<T>(values: Iterable<T>, key: (v: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[key(v)] = (out[key(v)] ?? 0) + 1;
  return out;
}

/**
 * Joins detections with the user's labels and restores. The latest detection and the latest label
 * per element (host + fingerprint) win, so relabeling or reclassification replaces older rows.
 */
export function analyzeLog(events: readonly LogEvent[]): LogSummary {
  const detections = events.filter((e): e is DetectionEvent => e.kind === "detection");
  const latestDetection = new Map<string, DetectionEvent>();
  for (const d of detections) latestDetection.set(keyOf(d), d);
  const latestLabel = new Map<string, LabelEvent>();
  for (const e of events) if (e.kind === "label") latestLabel.set(keyOf(e), e);

  const hidden = new Set(detections.filter((d) => d.state === "hidden").map(keyOf));
  const restored = new Set(
    events
      .filter((e) => e.kind === "restore")
      .map(keyOf)
      .filter((k) => hidden.has(k)),
  );

  const items: LabeledItem[] = [];
  const pairs: { predicted: boolean; actual: boolean }[] = [];
  for (const [key, label] of latestLabel) {
    const detection = latestDetection.get(key);
    if (!detection) continue;
    items.push({
      features: detection.features,
      classification: detection.classification,
      isAd: label.isAd,
    });
    pairs.push({ predicted: detection.decision.wouldHide, actual: label.isAd });
  }

  return {
    detections: detections.length,
    uniqueElements: latestDetection.size,
    hosts: new Set(detections.map((d) => d.host)).size,
    byModel: count(detections, (d) => d.modelVersion),
    byState: count(detections, (d) => d.state),
    hiddenElements: hidden.size,
    restoredElements: restored.size,
    restoreRate: hidden.size === 0 ? null : restored.size / hidden.size,
    labeled: items.length,
    labeledConfusion: confusion(pairs),
    items,
  };
}
