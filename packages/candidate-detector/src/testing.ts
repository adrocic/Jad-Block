import type { Measure, Rect } from "./measure";

const DEFAULT_RECT: Rect = { top: 0, left: 0, width: 600, height: 200 };
export const FIXTURE_VIEWPORT = { width: 1280, height: 800 };

/**
 * happy-dom has no layout engine, so fixtures declare geometry with `data-rect="w,h[,top,left]"`
 * and visibility with the `hidden` attribute or inline display/visibility/opacity styles.
 */
export const fixtureMeasure: Measure = {
  rect(el) {
    const raw = el.getAttribute("data-rect");
    if (!raw) return DEFAULT_RECT;
    const [width = 0, height = 0, top = 0, left = 0] = raw.split(",").map(Number);
    return { top, left, width, height };
  },
  position(el) {
    return (el as HTMLElement).style?.position || "static";
  },
  isVisible(el) {
    for (let node: Element | null = el; node; node = node.parentElement) {
      const style = (node as HTMLElement).style;
      if (node.hasAttribute("hidden")) return false;
      if (style?.display === "none" || style?.visibility === "hidden" || style?.opacity === "0") {
        return false;
      }
    }
    return true;
  },
  viewport() {
    return FIXTURE_VIEWPORT;
  },
};
