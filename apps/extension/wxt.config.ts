import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: "Semantic Blocker",
    description: "Blocks ads and sponsored content, including native ads that filter lists miss.",
    // Keep this list minimal. Adding a permission requires an ADR (see AGENTS.md).
    permissions: ["storage", "declarativeNetRequest"],
    host_permissions: ["<all_urls>"],
    browser_specific_settings: {
      gecko: {
        id: "{34b90a60-332d-4b5f-a9cc-3117035fe7cb}",
        // Remote semantic classification sends sanitized page-structure summaries, so it is opt-in.
        data_collection_permissions: { required: ["none"], optional: ["websiteContent"] },
      },
    },
  },
});
