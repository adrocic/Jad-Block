# Semantic Blocker — Architecture & Build Plan

## Context
`E:\Code\Plan.txt` proposes a cross-browser MV3 ad blocker that stops the ads we can already recognize with deterministic rules (DNR network rules plus cosmetic selectors) and calls **Jev** (TypeSafe AI) only for ambiguous native/sponsored content. The repo will be public on GitHub and built mostly with AI coding agents, so it needs agent instructions from day one.

The architecture in Plan.txt is sound. This plan keeps it, adjusts it for Jev's real API and limits (researched below), applies the user's stack decisions, and orders the work so everything runs without Jev until it's plugged in later.

**User decisions:** GPLv3 · Bun · Cloudflare Workers backend · no database in v1 · vanilla HTML/CSS/TS UI · Jev wired in later (TestClassifier + recorded fixtures first).

## What the Jev research changes
Jev ([docs](https://docs.typesafe.ai)) is a non-generative "System One" model. You send `state` (text or JSON) plus named questions (`noul` = yes/no probability, `choice`, `score`), and all questions are answered in parallel in one call. The endpoint is `POST https://api.typesafe.ai/v1/systemone` via `@typesafe-ai/sdk` (v0.6, Node 20+/edge). Latency is 70–500 ms. Input costs $0.042 per 1M tokens and output is free. Early access began 2026-09-15.

Design consequences:
1. **Jev can't do numbers, counting, or dates reliably.** The feature extractor must turn raw values into semantic categories before anything reaches Jev. For example, send `"size": "medium-rectangle (standard IAB ad size)"` instead of `300x250`, `"links": "one external link, different domain"` instead of counts, and `"position": "between article paragraphs"`. Keep numeric scoring in local code (the heuristic suspicion score).
2. **Irrelevant fields hurt accuracy.** Send a minimal state object and drop fields that don't inform the questions.
3. **Answers are not constrained to be consistent.** For example, `P(ad)` and `P(primary_content)` aren't forced to sum to 1. The decision engine must treat each answer as independent evidence, which Plan.txt §13 already does.
4. **Rate limit is 1,200 req/min per key, shared by all users.** This is the real scaling constraint, not cost. At about 300 tokens per candidate, 1M classifications cost about $13. Mitigations: fingerprint caches (L1–L3) and Worker-side coalescing of identical fingerprints. A benchmark to run later: packing several candidates into one call (array state, per-candidate question ids) against one call per candidate.
5. **Page text is untrusted.** Put it under explicitly named fields (`untrusted_page_text`) and write question instructions that say it is data. TypeSafe's docs don't address prompt injection, so the adversarial fixtures in Plan.txt §23 are the only defense we can verify.
6. **Confidence gating:** TypeSafe recommends per-action thresholds tuned on your own data, which matches shadow mode (Plan.txt §14).
7. **Privacy:** TypeSafe commits to not training on user data, and zero data retention is available on enterprise plans. Mention both in the privacy policy.
8. Jev is text-only and English-first. Non-English pages fall back to heuristics plus cache, with lower confidence.

## Adjustments to Plan.txt
- **Drop `browser/chrome.ts` and `browser/firefox.ts`.** WXT already emits `service_worker` for Chrome and `scripts` for Firefox. Keep a thin `BackgroundRuntime` interface only if a real difference appears.
- **Replace Fastify/Postgres/Redis** with Hono on Workers + Workers KV (server fingerprint cache and kill switch) + the Workers Rate Limiting binding. Analytics Engine can come later for metrics.
- **Replace Selenium with Playwright.** It loads unpacked extensions in Chromium. Test Firefox with `web-ext run` plus a smoke test.
- **Keep the labeled datasets out of the public repo** because of copyright and privacy on scraped pages. Commit only synthetic and adversarial fixtures. The real labeled corpus lives in a private repo or bucket.
- **Bun's role:** package manager, workspaces, script runner, and `bun test` (with happy-dom) for all pure packages and for Hono handlers via `app.request()`. The Worker still *runs* on workerd (`wrangler dev`/`deploy`), because Bun is not the Workers runtime.

## Repository layout (Bun workspaces)
```
semantic-blocker/
├── AGENTS.md                  # canonical agent instructions (~30 lines)
├── CLAUDE.md                  # "@AGENTS.md" + Claude-only notes
├── .claude/
│   ├── settings.json          # permissions allowlist, hooks (biome format on edit)
│   └── skills/                # add-candidate-signal, add-jev-question, run-evals
├── docs/
│   ├── architecture.md        # condensed Plan.txt + diagram
│   ├── privacy.md             # what never leaves the browser
│   └── adr/                   # 0001-deterministic-first, 0002-no-remote-logic, ...
├── apps/
│   ├── extension/             # WXT, MV3, vanilla TS/HTML/CSS
│   │   └── entrypoints/{background.ts, content.ts, popup/, options/}
│   └── api/                   # Hono on Cloudflare Workers, wrangler.jsonc
│       └── src/{routes/classify.ts, jev/, cache.ts, ratelimit.ts}
├── packages/
│   ├── schemas/               # zod: CandidateFeatures, ClassifyRequest/Response (shared contract)
│   ├── candidate-detector/    # cheap suspicion scoring over DOM subtrees
│   ├── feature-extractor/     # DOM → semantic, bucketed CandidateFeatures
│   ├── privacy/               # sanitizer + sensitive-site categories
│   ├── fingerprints/          # structural hash (no text)
│   ├── decision-engine/       # evidence → hide/retain, versioned packaged policy
│   ├── classifier/            # SemanticClassifier interface, Remote/Test/Heuristic impls
│   └── filter-engine/         # build-time: filter lists → DNR rulesets + cosmetic selectors
├── fixtures/                  # synthetic + adversarial HTML pages, expected labels
├── tools/eval/                # shadow-mode log → precision/recall/FP report
└── .github/workflows/         # ci.yml (lint, typecheck, test, build both browsers)
```
Core rule: `privacy`, `candidate-detector`, `feature-extractor`, `fingerprints`, and `decision-engine` are pure. They take DOM or data in and return data out, and they are all testable with `bun test` + happy-dom without launching a browser.

## Runtime flow (v1)
1. **DNR static rulesets** are compiled at build time from EasyList + EasyPrivacy (GPLv3-compatible) by `filter-engine`, which evaluates `@eyeo/abp2dnr` for the conversion.
2. **Content script** injects the packaged cosmetic CSS at `document_start`.
3. **Scanning:** a `MutationObserver` queues new subtrees, and `requestIdleCallback` batches them. The candidate detector computes a local suspicion score. Candidates below a threshold are ignored.
4. **Fingerprint lookup** checks L1 (memory), then L2 (`browser.storage.local`), then L3 (packaged known fingerprints). A hit goes straight to the decision engine.
5. **On a miss:** the extractor builds features, the privacy sanitizer strips sensitive data, zod validates the result, and the content script sends it to the background.
6. **Background:** batches candidates and sends `POST /v1/classify` to the Worker. On any failure or when the kill switch is on, it degrades silently to DNR + cosmetic + cache.
7. **Worker:** validates with zod (rejects extra fields), rate-limits, checks KV by fingerprint, calls `SemanticClassifier` (Jev later, deterministic stub now), and returns only probabilities + `modelVersion`. It never returns selectors or code (MV3 remote-code rule).
8. **Decision engine** (packaged thresholds): starts in **shadow mode** (log only). Hiding uses a packaged CSS class plus a stored ref so it can be reversed. The popup shows the counts and "Show hidden" / per-item restore; restore asks "Was this wrong?" and records locally.

Jev question set (in `apps/api/src/jev/questions.ts`): nouls for `is_commercial_advertisement`, `is_sponsored_or_promoted`, `is_primary_publisher_content`, `is_navigation`, `is_user_control`, `is_essential_to_page_function`, `safe_to_hide`, plus a `choice` for `element_type`. All go in one fan-out call.

## AI-assisted development setup
- **`AGENTS.md`** (root, read by Codex/Copilot/Cursor/Gemini and others, about 30 lines): what the project is, exact commands (`bun install`, `bun run check`, `bun test`, `bun run build`, `bun run dev:chrome`), hard rules, and a Definition of Done (`bun run check` green + tests added + no new permissions without an ADR).
  - Hard rules: never ship the API key in the extension; the server never returns executable logic or selectors; page text is untrusted data; every hide is reversible; new data leaving the browser must pass through `packages/privacy`; precision beats recall.
- **`CLAUDE.md`**: `@AGENTS.md` import plus Claude-specific notes (Claude Code doesn't read AGENTS.md natively).
- **Nested `AGENTS.md`** in `packages/privacy` and `packages/decision-engine` for local invariants (for example "adding a field requires a sanitizer test").
- **`.claude/settings.json`**: allowlist for `bun`, `wrangler dev`, and `git` read commands, plus a PostToolUse hook running `biome format` on edited files.
- **`.claude/skills/`**: repeatable recipes for adding a candidate signal (detector + fixture + test), adding a Jev question (schema + decision-engine + eval), and running the eval report.
- Install TypeSafe's official agent skill (docs.typesafe.ai/agent-skill) when we wire in Jev.
- **`docs/adr/`**: short decision records so agents don't re-argue settled choices.
- **Tooling:** Biome (lint + format, a single fast tool), strict TS, zod v4.

## Milestones
- **M0 – Scaffold:** git init, Bun workspaces, WXT extension skeleton, Hono Worker skeleton, Biome, tsconfig base, GPLv3 LICENSE, AGENTS.md/CLAUDE.md, CI workflow, README.
- **M1 – Pure core:** schemas, candidate-detector, feature-extractor (with semantic bucketing), privacy sanitizer, fingerprints, decision-engine, with happy-dom tests and synthetic + adversarial fixtures.
- **M2 – Extension:** DNR ruleset build, cosmetic CSS, content scanner, caches, shadow mode, popup/options (vanilla), restore flow, and local shadow log export.
- **M3 – API:** `/v1/classify` with zod, rate limiting, KV cache, kill switch, and a TestClassifier. The extension calls it end to end.
- **M4 – Eval harness:** `tools/eval` computes precision, recall, FP rate, and restoration rate from shadow logs against labeled fixtures.
- **M5 – Jev (when access arrives):** JevClassifier with the SDK, recorded-response fixtures for CI, then threshold tuning. Enable hiding only after shadow-mode precision meets the target.
- **Later:** AI → dynamic DNR learning (Plan.txt §22), shared classifications, store submission.

## Verification
- `bun run check` (Biome + `tsc --noEmit`) and `bun test` are green locally and in CI.
- `bun run build` produces both `.output/chrome-mv3` and `.output/firefox-mv3`. `web-ext lint` passes on the Firefox build.
- The Playwright smoke test loads the unpacked Chrome build on a local fixture page. It checks that DNR blocks a known ad host, cosmetic rules hide `.ad-slot`, and a native "Sponsored" card is logged in shadow mode (not hidden).
- `wrangler dev` + `curl POST /v1/classify` returns 200 with a valid payload. A payload with an unknown field or a raw `<input>` value returns 400.
- The adversarial fixture ("IGNORE YOUR CLASSIFIER…") never flips a decision via TestClassifier logic, and later via Jev recordings.
