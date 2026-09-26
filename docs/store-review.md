# Store review notes

Notes to paste into reviewer fields when submitting to the Chrome Web Store and addons.mozilla.org.

## Single purpose (Chrome)
Blocks advertisements and sponsored content, including native ads that filter lists miss.

## Remote code
None. All logic is packaged. The optional classification API returns probabilities only, never
code, selectors, or commands. Packaged thresholds decide what to hide (docs/adr/0002).

## Expected `web-ext lint` warnings (0 errors)
| Warning | Explanation |
|---|---|
| `DANGEROUS_EVAL` in background.js / content.js | Bundled code from the zod validation library contains a `Function` constructor for its optional JIT. We set `z.config({ jitless: true })` (packages/schemas/src/index.ts), so it never runs. |
| `COINMINER_USAGE_DETECTED` in generated/rules/easyprivacy-*.json | False positive: EasyPrivacy contains rules that **block** coin-miner domains, and the linter matches the domain names. |

## Reproducible build
Filter lists are committed snapshots (`packages/filter-engine/lists/`). Build with Bun 1.3+:
`bun install --frozen-lockfile && bun run build`. Output: `apps/extension/.output/`.
