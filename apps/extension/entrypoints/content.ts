export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    // M2: cosmetic CSS, MutationObserver scanner, fingerprint cache, shadow-mode logging.
  },
});
