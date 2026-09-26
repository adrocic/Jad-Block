import { expect, test } from "bun:test";
import { app } from "./index";

test("GET /health returns ok", async () => {
  const res = await app.request("/health");
  expect(res.status).toBe(200);
  const body: unknown = await res.json();
  expect(body).toEqual({ ok: true });
});
