export interface Confusion {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

export function confusion(pairs: Iterable<{ predicted: boolean; actual: boolean }>): Confusion {
  const c: Confusion = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const { predicted, actual } of pairs) {
    if (predicted && actual) c.tp++;
    else if (predicted) c.fp++;
    else if (actual) c.fn++;
    else c.tn++;
  }
  return c;
}

export function add(a: Confusion, b: Confusion): Confusion {
  return { tp: a.tp + b.tp, fp: a.fp + b.fp, fn: a.fn + b.fn, tn: a.tn + b.tn };
}

/** null when undefined (no predictions, no positives), rather than a misleading 0 or 1. */
export function precision(c: Confusion): number | null {
  return c.tp + c.fp === 0 ? null : c.tp / (c.tp + c.fp);
}

export function recall(c: Confusion): number | null {
  return c.tp + c.fn === 0 ? null : c.tp / (c.tp + c.fn);
}

export function pct(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}
