# 0003: Stack

**Status:** accepted (2026-09-25)

| Concern | Choice | Notes |
|---|---|---|
| License | GPLv3 | Lets us bundle and compile EasyList/EasyPrivacy. |
| Tooling | Bun (workspaces, scripts, `bun test` + happy-dom) | Bun is not the Workers runtime. The API runs on workerd. |
| Extension | WXT, MV3, vanilla TS/HTML/CSS | WXT handles Chrome `service_worker` vs Firefox `scripts`. |
| API | Hono on Cloudflare Workers | KV for cache and kill switch, Workers rate limiting. No database in v1. |
| Validation | zod, shared in `packages/schemas` | The same contract is enforced on both ends. |
| Lint/format | Biome | |
| E2E | Playwright (Chromium) + `web-ext` (Firefox) | |
| Classifier | TypeSafe Jev behind `SemanticClassifier` | TestClassifier until API access arrives. |
