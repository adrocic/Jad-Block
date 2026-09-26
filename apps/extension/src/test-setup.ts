// Gives `bun test` an in-memory WebExtension API (storage, runtime, ...) so modules that use
// wxt/browser or wxt/utils/storage can be imported and exercised outside a browser.
import { fakeBrowser } from "wxt/testing/fake-browser";

const g = globalThis as Record<string, unknown>;
g.browser = fakeBrowser;
g.chrome = fakeBrowser;
