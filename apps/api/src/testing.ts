import type { Env } from "./env";

/** In-memory stand-ins for Workers bindings, so the Hono app runs under `bun test`. */
export function fakeEnv(options: { clientLimit?: number; globalLimit?: number } = {}) {
  const store = new Map<string, string>();
  const counts = new Map<string, number>();
  const limiter = (limit: number, name: string): RateLimit => ({
    async limit({ key }) {
      const id = `${name}:${key}`;
      const next = (counts.get(id) ?? 0) + 1;
      counts.set(id, next);
      return { success: next <= limit };
    },
  });

  const kv = {
    async get(key: string, type?: unknown) {
      const value = store.get(key) ?? null;
      const wantsJson = type === "json" || (type as { type?: string })?.type === "json";
      return value !== null && wantsJson ? JSON.parse(value) : value;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
  } as unknown as KVNamespace;

  const env: Env = {
    CACHE: kv,
    CLIENT_LIMITER: limiter(options.clientLimit ?? 1000, "client"),
    GLOBAL_LIMITER: limiter(options.globalLimit ?? 1000, "global"),
    CLASSIFIER: "heuristic",
  };

  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (p: Promise<unknown>) => void pending.push(p),
    passThroughOnException: () => {},
    props: {},
  } as unknown as ExecutionContext;

  return { env, ctx, store, settle: () => Promise.all(pending) };
}
