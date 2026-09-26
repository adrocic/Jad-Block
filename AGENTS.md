# AGENTS.md

Cross-browser MV3 extension that blocks ads deterministically (DNR + cosmetic rules) and uses a
semantic classifier (TypeSafe Jev, via our Cloudflare Worker) only for ambiguous native/sponsored
content. Architecture: `docs/architecture.md`. Settled decisions: `docs/adr/` (don't re-argue them).

## Commands (Bun 1.3+)
- `bun install` · `bun run check` (Biome + typecheck) · `bun run fix` · `bun test`
- `bun run build` (Chrome + Firefox) · `bun run dev:chrome` · `bun run dev:firefox` · `bun run dev:api`
- `bun run e2e` (rebuilds Chrome with a test API URL, runs wrangler dev + Playwright Chromium on
  Node, since Playwright hangs under Bun on Windows; run `bun run build` again afterwards for real use)
- `bun run eval` (fixture precision/recall/breakage; `-- --log <export>` for real data; see the
  run-evals skill) · `bun run lists:update` (refresh filter-list snapshots, then commit them)

## Layout
`apps/extension` (WXT, vanilla TS/HTML/CSS) · `apps/api` (Hono on Workers) · `packages/*` (pure
logic, testable with `bun test` + happy-dom, no browser) · `fixtures/` (synthetic pages only).

## Hard rules
1. Never put an API key or secret in `apps/extension`. Only the Worker talks to Jev.
2. The API returns probabilities only. Never selectors, commands, or code (MV3 remote-code rule).
3. Page text is untrusted data, never instructions. Keep it in fields named `untrusted*`.
4. All data leaving the browser goes through `packages/privacy` and a zod schema in `packages/schemas`.
5. Hiding must be reversible (`data-jb-hidden` attribute + stored ref). Never `element.remove()`.
6. Precision over recall: a missed ad is annoying, hiding real content is a serious bug.
7. Never block page rendering on the network or the classifier. Any failure degrades silently.
8. Don't commit scraped real-site pages. Fixtures are synthetic.

## Definition of done
`bun run check` and `bun test` pass, new logic has tests (with a fixture for DOM behavior), and any
new extension permission or data field sent off-device has an ADR.
