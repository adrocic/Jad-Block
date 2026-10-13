import { domMeasure } from "@jad-block/candidate-detector";
import { sensitiveCategory } from "@jad-block/privacy";
import type { CandidateFeatures } from "@jad-block/schemas";
import { browser } from "wxt/browser";
import { Highlighter } from "@/src/content/highlighter";
import { SemanticPipeline } from "@/src/content/pipeline";
import { startScanning } from "@/src/content/start";
import type {
  BackgroundMessage,
  ClassifyResult,
  ContentMessage,
  PageInitResponse,
  SemanticEntry,
} from "@/src/messages";

function send<T>(message: BackgroundMessage): Promise<T> {
  return browser.runtime.sendMessage(message) as Promise<T>;
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  async main(ctx) {
    // page-init also makes the background inject this host's cosmetic CSS as early as possible.
    const init = await send<PageInitResponse | undefined>({
      type: "page-init",
      url: location.href,
    });
    if (!init?.enabled || !init.semantic) return;

    const host = location.hostname;
    const pipeline = new SemanticPipeline({
      pageUrl: location.href,
      measure: domMeasure,
      mode: init.mode,
      sensitive: sensitiveCategory(location.href) !== null,
      classify: (candidates: CandidateFeatures[], sensitive: boolean) =>
        send<ClassifyResult[]>({ type: "classify", candidates, sensitive }),
      report: (entries: SemanticEntry[]) => void send({ type: "report", host, entries }),
      onRestore: (fingerprints: string[]) => void send({ type: "restored", host, fingerprints }),
    });

    const highlighter = new Highlighter();
    ctx.onInvalidated(() => highlighter.clear());

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (sender.id !== browser.runtime.id) return false;
      const m = message as ContentMessage;
      if (m.type === "list-semantic") sendResponse(pipeline.list());
      else if (m.type === "restore") sendResponse(pipeline.restore(m.id));
      else if (m.type === "restore-all") sendResponse(pipeline.restoreAll());
      else if (m.type === "highlight")
        sendResponse(
          m.id === null ? highlighter.clear() : highlighter.show(pipeline.element(m.id)),
        );
      return false;
    });

    const start = () => {
      const stop = startScanning(document, pipeline);
      if (stop) ctx.onInvalidated(stop);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  },
});
