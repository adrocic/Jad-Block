import { describe, expect, test } from "bun:test";
import { HeuristicClassifier } from "@jad-block/classifier";
import type { Classification } from "@jad-block/schemas";
import { sampleClassification, sampleFeatures } from "@jad-block/schemas/testing";
import type { CacheHit } from "./cache";
import { type ClassifyDeps, classifyCandidates } from "./classify";
import { type FetchLike, RemoteClassifier } from "./remote";

const INSTALL_ID = "3f2b8c1e-9d4a-4b7e-8f21-5a6c7d8e9f01";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function remoteWith(handler: (request: Request) => Response | Promise<Response>) {
  let clock = 1_000_000;
  const requests: Request[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request);
    return handler(request);
  }) as FetchLike;
  const remote = new RemoteClassifier(
    "https://api.test",
    async () => INSTALL_ID,
    fetchImpl,
    () => clock,
  );
  return { remote, requests, advance: (ms: number) => (clock += ms) };
}

const okResponse = (fingerprints: string[], modelVersion = "jev-1.13.0") =>
  jsonResponse({
    modelVersion,
    results: fingerprints.map((fingerprint) => ({
      fingerprint,
      classification: sampleClassification(),
    })),
  });

describe("RemoteClassifier", () => {
  test("posts candidates with the install ID and returns results in order", async () => {
    const { remote, requests } = remoteWith(() =>
      okResponse(["bbbbbbbbbbbbbbbb", "aaaaaaaaaaaaaaaa"]),
    );
    const out = await remote.classify([
      sampleFeatures({ fingerprint: "aaaaaaaaaaaaaaaa" }),
      sampleFeatures({ fingerprint: "bbbbbbbbbbbbbbbb" }),
    ]);
    expect(out).toHaveLength(2);
    expect(remote.modelVersion).toBe("jev-1.13.0");
    expect(requests[0]?.url).toBe("https://api.test/v1/classify");
    expect(requests[0]?.headers.get("x-install-id")).toBe(INSTALL_ID);
  });

  test("rejects responses that carry anything beyond probabilities", async () => {
    const { remote } = remoteWith(() =>
      jsonResponse({
        modelVersion: "x",
        results: [
          {
            fingerprint: "0123456789abcdef",
            classification: sampleClassification(),
            selector: "#main",
          },
        ],
      }),
    );
    await expect(remote.classify([sampleFeatures()])).rejects.toThrow("schema validation");
  });

  test("circuit breaker: after a 429 it stops calling until Retry-After passes", async () => {
    const { remote, requests, advance } = remoteWith(() =>
      jsonResponse({ error: "rate limited" }, 429, { "retry-after": "60" }),
    );
    await expect(remote.classify([sampleFeatures()])).rejects.toThrow("HTTP 429");
    expect(remote.available).toBe(false);
    await expect(remote.classify([sampleFeatures()])).rejects.toThrow("cooling down");
    expect(requests).toHaveLength(1);
    advance(61_000);
    expect(remote.available).toBe(true);
  });

  test("a network error also trips the breaker", async () => {
    const { remote } = remoteWith(() => {
      throw new TypeError("Failed to fetch");
    });
    await expect(remote.classify([sampleFeatures()])).rejects.toThrow();
    expect(remote.available).toBe(false);
  });

  test("the default fetch is not called with the classifier as `this`", async () => {
    // Browsers throw "Illegal invocation" in that case; Bun doesn't, so simulate the check.
    const original = globalThis.fetch;
    globalThis.fetch = function (this: unknown) {
      if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(okResponse(["0123456789abcdef"]));
    } as unknown as typeof fetch;
    try {
      const remote = new RemoteClassifier("https://api.test", async () => INSTALL_ID);
      await expect(remote.classify([sampleFeatures()])).resolves.toHaveLength(1);
    } finally {
      globalThis.fetch = original;
    }
  });

  test("is unavailable in builds without an API URL", () => {
    expect(new RemoteClassifier("", async () => INSTALL_ID).available).toBe(false);
  });
});

function deps(overrides: Partial<ClassifyDeps> & { stored?: Map<string, CacheHit> } = {}) {
  const stored = overrides.stored ?? new Map<string, CacheHit>();
  const writes: { versions: string[] } = { versions: [] };
  const d: ClassifyDeps = {
    local: new HeuristicClassifier(),
    remote: remoteWith(() => okResponse(["0123456789abcdef"])).remote,
    remoteEnabled: async () => true,
    async lookup(fingerprints, accept) {
      return new Map(
        fingerprints.flatMap((fp) => {
          const hit = stored.get(fp);
          return hit && accept(hit.modelVersion) ? [[fp, hit] as const] : [];
        }),
      );
    },
    readOverrides: async () => new Set<string>(),
    async store(results, modelVersion) {
      writes.versions.push(modelVersion);
      for (const r of results) stored.set(r.fingerprint, { ...r, modelVersion });
    },
    ...overrides,
  };
  return { d, writes, stored };
}

describe("classifyCandidates", () => {
  test("uses the remote API when opted in", async () => {
    const { d } = deps();
    const [result] = await classifyCandidates([sampleFeatures()], false, d);
    expect(result?.modelVersion).toBe("jev-1.13.0");
  });

  test("never sends sensitive pages remotely", async () => {
    const { remote, requests } = remoteWith(() => okResponse(["0123456789abcdef"]));
    const { d } = deps({ remote });
    const [result] = await classifyCandidates([sampleFeatures()], true, d);
    expect(requests).toHaveLength(0);
    expect(result?.modelVersion).toBe("heuristic-1");
  });

  test("never sends anything when the user hasn't opted in", async () => {
    const { remote, requests } = remoteWith(() => okResponse(["0123456789abcdef"]));
    const { d } = deps({ remote, remoteEnabled: async () => false });
    await classifyCandidates([sampleFeatures()], false, d);
    expect(requests).toHaveLength(0);
  });

  test("falls back to the local heuristic when the API fails", async () => {
    const { remote } = remoteWith(() => jsonResponse({ error: "down" }, 503));
    const { d, writes } = deps({ remote });
    const [result] = await classifyCandidates([sampleFeatures()], false, d);
    expect(result?.modelVersion).toBe("heuristic-1");
    expect(writes.versions).toEqual(["heuristic-1"]);
  });

  test("with remote on, cached heuristic results are re-classified remotely", async () => {
    const stored = new Map<string, CacheHit>([
      ["0123456789abcdef", { classification: sampleClassification(), modelVersion: "heuristic-1" }],
    ]);
    const { d } = deps({ stored });
    const [result] = await classifyCandidates([sampleFeatures()], false, d);
    expect(result?.modelVersion).toBe("jev-1.13.0");
  });

  test("with remote off, any cached result is reused and nothing is sent", async () => {
    const remoteResult: Classification = sampleClassification({ advertisement: 0.5 });
    const stored = new Map<string, CacheHit>([
      ["0123456789abcdef", { classification: remoteResult, modelVersion: "jev-1.13.0" }],
    ]);
    const { d } = deps({ stored, remoteEnabled: async () => false });
    const [result] = await classifyCandidates([sampleFeatures()], false, d);
    expect(result?.classification).toEqual(remoteResult);
  });

  test("user overrides apply even when the classification isn't cached", async () => {
    const { d } = deps({ readOverrides: async (fps) => new Set(fps) });
    const [result] = await classifyCandidates([sampleFeatures()], false, d);
    expect(result?.userOverride).toBe(true);
  });

  test("rejects malformed candidates before anything is sent", async () => {
    const { remote, requests } = remoteWith(() => okResponse([]));
    const { d } = deps({ remote });
    const bad = [{ ...sampleFeatures(), pageUrl: "https://bank.example/account" }];
    await expect(classifyCandidates(bad, false, d)).rejects.toThrow();
    expect(requests).toHaveLength(0);
  });
});
