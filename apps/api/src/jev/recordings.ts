import type { Fetch } from "@typesafe-ai/sdk";

// Recorded Jev responses let CI exercise the real questions and answers without the network or a
// key. Entries are keyed by a hash of the exact request body, so any change to a question, the
// state wording, or the model turns into a missing recording instead of a stale answer.

export interface Recordings {
  [requestHash: string]: unknown;
}

async function hashBody(body: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(String(body));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });

/** A fetch that answers only from recordings and fails loudly on anything it hasn't seen. */
export function replayFetch(recordings: Recordings): Fetch {
  return async (_url, init) => {
    const key = await hashBody(init?.body);
    if (!(key in recordings)) {
      throw new Error(
        "No recorded Jev response for this request. If questions or features changed, run " +
          "`bun run eval -- --classifier jev --record` with a TypeSafe key.",
      );
    }
    return json(recordings[key]);
  };
}

/** Wraps a real fetch and stores every successful response in `into`. */
export function recordingFetch(into: Recordings, fetch: Fetch): Fetch {
  return async (url, init) => {
    const res = await fetch(url, init);
    if (res.ok) into[await hashBody(init?.body)] = await res.clone().json();
    return res;
  };
}
