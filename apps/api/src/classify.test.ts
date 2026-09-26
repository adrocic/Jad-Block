import { describe, expect, test } from "bun:test";
import { ClassifyResponse } from "@jad-block/schemas";
import { sampleFeatures } from "@jad-block/schemas/testing";
import { KILL_SWITCH_KEY } from "./env";
import { app } from "./index";
import { MAX_BODY_BYTES } from "./routes/classify";
import { fakeEnv } from "./testing";

const INSTALL_ID = "3f2b8c1e-9d4a-4b7e-8f21-5a6c7d8e9f01";

function post(
  bindings: ReturnType<typeof fakeEnv>,
  body: unknown,
  headers: Record<string, string> = {},
) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return app.request(
    "/v1/classify",
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-install-id": INSTALL_ID, ...headers },
      body: payload,
    },
    bindings.env,
    bindings.ctx,
  );
}

describe("POST /v1/classify", () => {
  test("returns schema-valid probabilities for each candidate", async () => {
    const b = fakeEnv();
    const res = await post(b, {
      candidates: [sampleFeatures(), sampleFeatures({ fingerprint: "fedcba9876543210" })],
    });
    expect(res.status).toBe(200);
    const body = ClassifyResponse.parse(await res.json());
    expect(body.modelVersion).toBe("api-heuristic-1");
    expect(body.results.map((r) => r.fingerprint)).toEqual([
      "0123456789abcdef",
      "fedcba9876543210",
    ]);
  });

  test("the response carries evidence only: exactly these keys, no selectors or commands", async () => {
    const res = await post(fakeEnv(), { candidates: [sampleFeatures()] });
    const body = (await res.json()) as {
      results: { classification: Record<string, unknown> }[];
    };
    expect(Object.keys(body).sort()).toEqual(["modelVersion", "results"]);
    expect(Object.keys(body.results[0] ?? {}).sort()).toEqual(["classification", "fingerprint"]);
    expect(Object.keys(body.results[0]?.classification ?? {}).sort()).toEqual([
      "advertisement",
      "elementType",
      "essentialUi",
      "navigation",
      "primaryContent",
      "safeToHide",
      "sponsored",
      "userControl",
    ]);
  });

  test("caches by the full feature set, not by fingerprint alone (anti-poisoning)", async () => {
    const b = fakeEnv();
    // An attacker pairs a real navigation fingerprint with ad-like features...
    await post(b, {
      candidates: [sampleFeatures({ fingerprint: "aaaaaaaaaaaaaaaa", labelHints: ["sponsored"] })],
    });
    await b.settle();
    // ...but a victim's genuine navigation features for that fingerprint must not hit that entry.
    const victim = sampleFeatures({
      fingerprint: "aaaaaaaaaaaaaaaa",
      labelHints: [],
      position: "navigation-area",
    });
    const res = await post(b, { candidates: [victim] });
    const body = ClassifyResponse.parse(await res.json());
    expect(body.results[0]?.classification.elementType).toBe("navigation");
    expect(b.store.size).toBe(2);
  });

  test("identical features are served from the cache", async () => {
    const b = fakeEnv();
    await post(b, { candidates: [sampleFeatures()] });
    await b.settle();
    expect(b.store.size).toBe(1);
    await post(b, { candidates: [sampleFeatures()] });
    await b.settle();
    expect(b.store.size).toBe(1);
  });

  test.each([
    ["unknown top-level field", { candidates: [sampleFeatures()], html: "<div>" }],
    ["unknown candidate field", { candidates: [{ ...sampleFeatures(), url: "https://x" }] }],
    ["no candidates", { candidates: [] }],
    ["too many candidates", { candidates: Array.from({ length: 21 }, () => sampleFeatures()) }],
  ])("rejects %s with 400 and does not echo values", async (_name, body) => {
    const res = await post(fakeEnv(), body);
    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain("<div>");
  });

  test("rejects malformed JSON, wrong content type, and oversized bodies", async () => {
    expect((await post(fakeEnv(), "{nope")).status).toBe(400);
    expect((await post(fakeEnv(), "{}", { "content-type": "text/plain" })).status).toBe(415);
    const huge = JSON.stringify({ candidates: [], pad: "x".repeat(MAX_BODY_BYTES) });
    expect((await post(fakeEnv(), huge)).status).toBe(413);
  });

  test("rate limits per client, falling back to IP without a valid install ID", async () => {
    const b = fakeEnv({ clientLimit: 2 });
    const body = { candidates: [sampleFeatures()] };
    expect((await post(b, body)).status).toBe(200);
    expect((await post(b, body)).status).toBe(200);
    const limited = await post(b, body);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    // A different client is unaffected; a bogus install ID is keyed by IP instead.
    const other = { "x-install-id": "not-a-uuid", "cf-connecting-ip": "203.0.113.9" };
    expect((await post(b, body, other)).status).toBe(200);
  });

  test("the global limit protects the upstream model quota", async () => {
    const b = fakeEnv({ globalLimit: 1 });
    expect((await post(b, { candidates: [sampleFeatures()] })).status).toBe(200);
    const second = await post(
      b,
      { candidates: [sampleFeatures()] },
      {
        "x-install-id": "11111111-2222-4333-8444-555555555555",
      },
    );
    expect(second.status).toBe(429);
  });

  test("the kill switch answers 503 so clients fall back to local classification", async () => {
    const b = fakeEnv();
    b.store.set(KILL_SWITCH_KEY, "on");
    expect((await post(b, { candidates: [sampleFeatures()] })).status).toBe(503);
  });
});

test("unknown routes 404 as JSON", async () => {
  const b = fakeEnv();
  const res = await app.request("/v1/anything", {}, b.env, b.ctx);
  expect(res.status).toBe(404);
});
