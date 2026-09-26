// Registers happy-dom globals (document, window, HTMLElement, ...) for `bun test`.
// Tests must never touch the network. Iframe `src` attributes are neutralized by the fixture loader
// (disabling iframe loading here makes happy-dom throw even for about:blank).
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({
  url: "https://fixture.test/",
  settings: {
    disableJavaScriptEvaluation: true,
    disableJavaScriptFileLoading: true,
    disableCSSFileLoading: true,
    navigation: { disableMainFrameNavigation: true, disableChildFrameNavigation: true },
  },
});
