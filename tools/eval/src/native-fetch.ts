// Imported before test-setup, which replaces the global fetch with happy-dom's (CORS and all).
// Live Jev runs need Bun's own.
export const nativeFetch = globalThis.fetch.bind(globalThis);
