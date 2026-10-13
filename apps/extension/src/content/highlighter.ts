import { HIDDEN_ATTR } from "./hider";

/** Marks our own overlay, so nothing mistakes it for page content. */
export const HIGHLIGHT_ATTR = "data-jb-highlight";

/** The popup can close without saying so, which would leave the outline up. */
const AUTO_CLEAR_MS = 4000;

/**
 * Outlines one page element so the user can match a popup row to what's on screen. Draws a
 * separate overlay rather than styling the element, so the page's own markup is never touched.
 */
export class Highlighter {
  private overlay: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly doc: Document = document) {}

  /** Returns false when there's nothing visible to point at (gone, or hidden by us). */
  show(element: Element | undefined): boolean {
    this.clear();
    if (!element?.isConnected || element.closest(`[${HIDDEN_ATTR}]`)) return false;

    element.scrollIntoView?.({ block: "center", inline: "nearest" });
    const rect = element.getBoundingClientRect();
    const view = this.doc.defaultView;
    const overlay = this.doc.createElement("div");
    overlay.setAttribute(HIGHLIGHT_ATTR, "");
    overlay.style.cssText = [
      "position:absolute",
      `left:${rect.left + (view?.scrollX ?? 0)}px`,
      `top:${rect.top + (view?.scrollY ?? 0)}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      "box-sizing:border-box",
      "border:3px solid #e11d48",
      "background:rgba(225,29,72,0.15)",
      "border-radius:4px",
      "pointer-events:none",
      "z-index:2147483647",
      "margin:0",
      "padding:0",
    ]
      .map((rule) => `${rule}!important`)
      .join(";");
    this.doc.documentElement.append(overlay);
    this.overlay = overlay;
    this.timer = setTimeout(() => this.clear(), AUTO_CLEAR_MS);
    return true;
  }

  clear(): void {
    clearTimeout(this.timer);
    this.overlay?.remove();
    this.overlay = null;
  }
}
