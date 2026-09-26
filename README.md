# Jad-Block

**Blocks the ads filter lists can't see.**

Jad-Block is an ad blocker for Chrome and Firefox that goes past filter lists. Known ads and
trackers are blocked before they load, using EasyList and EasyPrivacy. Jad-Block then looks at
what's left on the page to find ads that don't look like ads: sponsored posts in feeds, "partner
content" in articles, and promoted cards dressed up as real content.

It's built to be careful and private:

- **It only hides what it's confident about.** New detection runs in shadow mode until it's proven
  accurate.
- **Nothing leaves your browser by default.** Optional AI classification
  ([TypeSafe Jev](https://docs.typesafe.ai), behind our own API) sends only a short, scrubbed
  summary of suspected ads, and never on banking, email or health sites. The service returns
  probabilities; the extension decides what to hide.
- **Everything is reversible.** See what was hidden on any page and restore it with one click.

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
