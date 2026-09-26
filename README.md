# Semantic Blocker

A cross-browser (Chrome, Firefox) ad blocker that removes advertisements and sponsored content,
including native ads that conventional filter lists miss.

Known ads are blocked deterministically with declarativeNetRequest and cosmetic filters. Only
ambiguous page elements are sent, as a privacy-sanitized structural summary, to a semantic
classifier ([TypeSafe Jev](https://docs.typesafe.ai)) behind our own API. The extension, not the
server, decides what to hide, and every hide can be undone.

> **Status:** early development. Semantic hiding ships in shadow mode (detect and log only) until
> it is proven precise.

## Development
Requires [Bun](https://bun.sh) 1.3+.

```sh
bun install
bun run dev:chrome     # or dev:firefox
bun run dev:api        # local Worker via wrangler
bun run check && bun test
```

See [AGENTS.md](AGENTS.md) for project rules and [docs/architecture.md](docs/architecture.md) for
the design.

## License
[GPL-3.0](LICENSE)
