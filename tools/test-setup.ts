// Registers happy-dom globals (document, window, HTMLElement, ...) for `bun test`.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
