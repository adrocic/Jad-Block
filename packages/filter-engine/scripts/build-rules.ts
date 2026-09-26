// Compiles the committed filter-list snapshots into extension assets:
//   generated/rules/<list>-<n>.json  DNR static rulesets (wxt.config.ts declares every chunk)
//   generated/cosmetic/generic.css  selectors hidden on every site
//   generated/cosmetic/cosmetic.json  per-host selectors and exception domains
// Run: bun packages/filter-engine/scripts/build-rules.ts
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type CosmeticRules,
  convertNetworkRules,
  parseCosmeticFilters,
  parseHideExceptions,
  toHidingCss,
} from "../src/index";
import { LISTS } from "./lists";

const root = join(import.meta.dir, "..");
const out = join(root, "..", "..", "apps", "extension", "public", "generated");

export interface CosmeticAsset extends Omit<CosmeticRules, "generic"> {
  /** Sites where no cosmetic rules apply. */
  elemhide: string[];
  /** Sites where generic cosmetic rules (generic.css) don't apply. */
  generichide: string[];
}

/**
 * Rules per static ruleset file. Keeps each file around 2 MB: Firefox's addons-linter refuses to
 * parse files over 5 MB. DNR resolves priorities across all enabled rulesets, so allow rules
 * still override blocks in other chunks.
 */
const RULES_PER_CHUNK = 20_000;

await rm(join(out, "rules"), { recursive: true, force: true });
await mkdir(join(out, "rules"), { recursive: true });
await mkdir(join(out, "cosmetic"), { recursive: true });

const merged: CosmeticAsset & { generic: string[] } = {
  generic: [],
  genericWithExceptions: {},
  byDomain: {},
  exceptionsByDomain: {},
  elemhide: [],
  generichide: [],
};

for (const [index, list] of LISTS.entries()) {
  const text = await readFile(join(root, "lists", `${list.id}.txt`), "utf8");
  const network = await convertNetworkRules(index + 1, text);
  for (let start = 0, n = 1; start < network.rules.length; start += RULES_PER_CHUNK, n++) {
    const chunk = network.rules.slice(start, start + RULES_PER_CHUNK);
    await writeFile(join(out, "rules", `${list.id}-${n}.json`), JSON.stringify(chunk));
  }

  const cosmetic = parseCosmeticFilters(text);
  const hide = parseHideExceptions(text);
  merged.generic.push(...cosmetic.generic);
  Object.assign(merged.genericWithExceptions, cosmetic.genericWithExceptions);
  for (const [key, source] of [
    ["byDomain", cosmetic.byDomain],
    ["exceptionsByDomain", cosmetic.exceptionsByDomain],
  ] as const) {
    for (const [domain, selectors] of Object.entries(source)) {
      merged[key][domain] = [...(merged[key][domain] ?? []), ...selectors];
    }
  }
  merged.elemhide.push(...hide.elemhide);
  merged.generichide.push(...hide.generichide);

  console.log(
    `${list.id}: ${network.rules.length} network rules (${network.skippedUnsafe} unsafe skipped, ` +
      `${network.errors} unconvertible), ${cosmetic.generic.length} generic selectors, ` +
      `${Object.keys(cosmetic.byDomain).length} domains with specific selectors`,
  );
}

const { generic, ...asset } = merged;
await writeFile(join(out, "cosmetic", "generic.css"), toHidingCss(new Set(generic)));
await writeFile(join(out, "cosmetic", "cosmetic.json"), JSON.stringify(asset));
