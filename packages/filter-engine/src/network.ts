import { type DeclarativeRule, Filter, FilterConverter, isSafeRule } from "@adguard/dnr-converter";

export type { DeclarativeRule };

export interface NetworkConversion {
  rules: DeclarativeRule[];
  skippedUnsafe: number;
  errors: number;
}

/**
 * Converts a list's network rules to DNR. Unsafe rules (redirect, modifyHeaders) are dropped:
 * they need broader permissions and are a tiny fraction of EasyList/EasyPrivacy.
 */
export async function convertNetworkRules(id: number, text: string): Promise<NetworkConversion> {
  const [result] = await new FilterConverter().convert([new Filter(id, text)]);
  if (!result) throw new Error(`conversion of filter ${id} returned no result`);
  const all = result.ruleset.getDeclarativeRules();
  const rules = all.filter(isSafeRule);
  return { rules, skippedUnsafe: all.length - rules.length, errors: result.errors.length };
}

const HIDE_EXCEPTION = /^@@\|\|([a-z0-9.-]+)\^\$(.+)$/i;

/**
 * Domains exempt from cosmetic filtering via `@@||domain^$generichide` (generic rules only) or
 * `$elemhide` (all cosmetic rules). Only the plain `||domain^` form is recognized.
 */
export function parseHideExceptions(text: string): { generichide: string[]; elemhide: string[] } {
  const generichide = new Set<string>();
  const elemhide = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const match = HIDE_EXCEPTION.exec(raw.trim());
    if (!match) continue;
    const [, domain = "", options = ""] = match;
    const opts = options.toLowerCase().split(",");
    if (opts.includes("elemhide") || opts.includes("ehide")) elemhide.add(domain.toLowerCase());
    else if (opts.includes("generichide") || opts.includes("ghide")) {
      generichide.add(domain.toLowerCase());
    }
  }
  return { generichide: [...generichide], elemhide: [...elemhide] };
}
