export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Layout access, injected so detection logic runs under happy-dom (which has no layout engine).
 * The content script uses `domMeasure`; tests use `fixtureMeasure` from "./testing".
 */
export interface Measure {
  rect(el: Element): Rect;
  /** Computed CSS `position`. */
  position(el: Element): string;
  isVisible(el: Element): boolean;
  viewport(): { width: number; height: number };
}

export const domMeasure: Measure = {
  rect(el) {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  },
  position(el) {
    return getComputedStyle(el).position;
  },
  isVisible(el) {
    return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  },
  viewport() {
    return { width: window.innerWidth, height: window.innerHeight };
  },
};
