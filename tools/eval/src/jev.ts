import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createJevClassifier,
  type JevClassifier,
  type Recordings,
  recordingFetch,
  replayFetch,
} from "@jad-block/api/jev";
import type { Fetch } from "@typesafe-ai/sdk";

/** Jev responses for the fixture pages. Synthetic fixtures only, so they're safe to commit. */
export const RECORDINGS_PATH = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "fixtures",
  "recordings",
  "jev.json",
);

/** The eval runs under happy-dom, which the SDK mistakes for a browser. Nothing here ships. */
const NOT_A_BROWSER = { dangerouslyAllowBrowser: true };

/** `TYPESAFE_API_KEY` from the environment, else from the Worker's local secrets file. */
export function loadApiKey(): string | undefined {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;
  const devVars = join(import.meta.dir, "..", "..", "..", "apps", "api", ".dev.vars");
  if (!existsSync(devVars)) return undefined;
  return /^TYPESAFE_API_KEY\s*=\s*"?([^"\r\n]+)"?/m.exec(readFileSync(devVars, "utf8"))?.[1];
}

export function loadRecordings(): Recordings {
  return existsSync(RECORDINGS_PATH) ? JSON.parse(readFileSync(RECORDINGS_PATH, "utf8")) : {};
}

/** Jev answering only from recordings: deterministic, offline, and safe for CI. */
export function replayJev(): JevClassifier {
  return createJevClassifier("replay", { ...NOT_A_BROWSER, fetch: replayFetch(loadRecordings()) });
}

/** Live Jev. With `record`, every response is kept and `save()` writes the recordings file. */
export function liveJev(apiKey: string, fetch: Fetch, record: boolean) {
  const recordings: Recordings = {};
  const classifier = createJevClassifier(apiKey, {
    ...NOT_A_BROWSER,
    fetch: record ? recordingFetch(recordings, fetch) : fetch,
    // Offline tooling, not the 3 s request path: allow for rate limits.
    timeout: 10_000,
    retry: { maxRetries: 3 },
  });
  const save = async () => {
    // Sorted keys keep re-recordings diffable.
    const sorted = Object.fromEntries(
      Object.entries(recordings).sort(([a], [b]) => a.localeCompare(b)),
    );
    await writeFile(RECORDINGS_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
  };
  return { classifier, save };
}
