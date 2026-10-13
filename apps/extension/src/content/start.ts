import type { SemanticPipeline } from "./pipeline";
import { observeAdditions } from "./scanner";

/**
 * Scans the page once, then watches for additions. Returns the stop function, or null when there's
 * nothing to scan: some documents never get a <body> (redirect pages like t.co navigate away first,
 * XML and SVG documents have none). Network and cosmetic blocking still apply there.
 */
export function startScanning(
  doc: Document,
  pipeline: Pick<SemanticPipeline, "scan">,
): (() => void) | null {
  const body = doc.body;
  if (!body) return null;
  void pipeline.scan(body, false);
  return observeAdditions(body, (roots) => {
    for (const root of roots) void pipeline.scan(root, true);
  });
}
