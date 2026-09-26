import { Hono } from "hono";
import type { Env } from "./env";
import { classify } from "./routes/classify";

export const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));
app.post("/v1/classify", classify);

app.notFound((c) => c.json({ error: "not found" }, 404));
app.onError((error, c) => {
  console.error(JSON.stringify({ event: "unhandled_error", message: String(error) }));
  return c.json({ error: "internal error" }, 500);
});

export default app;
