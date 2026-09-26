/** Attribute that marks semantically hidden elements. The background injects the matching
 * `display:none!important` rule as a user-origin stylesheet (see background/cosmetic.ts). */
export const HIDDEN_ATTR = "data-jb-hidden";

/** Reversible hiding: elements are marked, never removed, so every hide can be undone. */
export class Hider {
  private readonly hidden = new Map<string, Element>();
  private readonly restored = new Set<string>();

  /** Returns false if the user already restored this element on this page. */
  hide(element: Element, id: string): boolean {
    if (this.restored.has(id)) return false;
    element.setAttribute(HIDDEN_ATTR, id);
    this.hidden.set(id, element);
    return true;
  }

  restore(id: string): boolean {
    const element = this.hidden.get(id);
    if (!element) return false;
    element.removeAttribute(HIDDEN_ATTR);
    this.hidden.delete(id);
    this.restored.add(id);
    return true;
  }

  restoreAll(): string[] {
    const ids = [...this.hidden.keys()];
    for (const id of ids) this.restore(id);
    return ids;
  }
}
