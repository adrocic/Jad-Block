export type Scheduler = (callback: () => void) => void;

/** Runs work when the browser is idle, but within a second even on busy pages. */
export const idleScheduler: Scheduler = (callback) => {
  if (typeof requestIdleCallback === "function") requestIdleCallback(callback, { timeout: 1000 });
  else setTimeout(callback, 250);
};

const IGNORED = new Set(["script", "style", "link", "meta", "noscript", "template", "br"]);

/**
 * Watches `target` for added subtrees and hands them over in debounced batches. Only new
 * subtrees are passed on, never the whole document, and nested additions are collapsed into
 * their outermost root. Returns a function that stops observing.
 */
export function observeAdditions(
  target: Node,
  onRoots: (roots: Element[]) => void,
  schedule: Scheduler = idleScheduler,
): () => void {
  const pending = new Set<Element>();
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    const roots = [...pending].filter((el) => el.isConnected);
    pending.clear();
    const outermost = roots.filter(
      (el) => !roots.some((other) => other !== el && other.contains(el)),
    );
    if (outermost.length > 0) onRoots(outermost);
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        if (node instanceof Element && !IGNORED.has(node.localName)) pending.add(node);
      }
    }
    if (pending.size > 0 && !scheduled) {
      scheduled = true;
      schedule(flush);
    }
  });
  observer.observe(target, { childList: true, subtree: true });
  return () => observer.disconnect();
}
