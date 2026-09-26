// Parses element-hiding ("cosmetic") rules from Adblock Plus-syntax lists such as EasyList.
// Supported: `##sel`, `a.com,b.com##sel`, `~a.com##sel`, `a.com#@#sel`, `#@#sel`.
// Skipped: extended/procedural syntax (#?#, #$#, #%#, :-abp-*, :has-text, :xpath), which needs a
// runtime engine rather than plain CSS.

export interface CosmeticRules {
  /** Selectors hidden everywhere with no exceptions. Safe to ship as one static stylesheet. */
  generic: string[];
  /** Generic selectors that some domains exempt: selector → exempt domains. */
  genericWithExceptions: Record<string, string[]>;
  /** Selectors hidden only on specific domains (and their subdomains). */
  byDomain: Record<string, string[]>;
  /** Per-domain exceptions to `byDomain` selectors. */
  exceptionsByDomain: Record<string, string[]>;
}

const COSMETIC = /^([^#]*)#(@?)#(.+)$/;
const UNSUPPORTED_SEPARATOR = /#[?$%]#|#@[?$%]#/;
const PROCEDURAL =
  /:-abp-|:has-text\(|:xpath\(|:contains\(|:matches-css|:upward\(|:remove\(|:style\(/;

function push(map: Record<string, string[]>, key: string, value: string): void {
  const list = map[key];
  if (list) list.push(value);
  else map[key] = [value];
}

export function parseCosmeticFilters(text: string): CosmeticRules {
  const generic = new Set<string>();
  const genericExceptions: Record<string, string[]> = {};
  const globallyExcepted = new Set<string>();
  const byDomain: Record<string, string[]> = {};
  const exceptionsByDomain: Record<string, string[]> = {};

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("!") || line.startsWith("[")) continue;
    if (UNSUPPORTED_SEPARATOR.test(line)) continue;
    const match = COSMETIC.exec(line);
    if (!match) continue;
    const [, domainList = "", exception, selector = ""] = match;
    if (PROCEDURAL.test(selector)) continue;

    const domains = domainList.split(",").filter(Boolean);
    const included = domains.filter((d) => !d.startsWith("~")).map((d) => d.toLowerCase());
    const excluded = domains.filter((d) => d.startsWith("~")).map((d) => d.slice(1).toLowerCase());

    if (exception) {
      if (included.length === 0) globallyExcepted.add(selector);
      for (const d of included) push(exceptionsByDomain, d, selector);
      continue;
    }
    if (included.length === 0) {
      generic.add(selector);
      for (const d of excluded) push(genericExceptions, selector, d);
    } else {
      for (const d of included) push(byDomain, d, selector);
      for (const d of excluded) push(exceptionsByDomain, d, selector);
    }
  }

  // Domain exceptions (`a.com#@#.ad`) also exempt generic selectors on that domain.
  for (const [domain, selectors] of Object.entries(exceptionsByDomain)) {
    for (const selector of selectors) {
      if (generic.has(selector)) push(genericExceptions, selector, domain);
    }
  }

  const result: CosmeticRules = {
    generic: [],
    genericWithExceptions: {},
    byDomain,
    exceptionsByDomain,
  };
  for (const selector of generic) {
    if (globallyExcepted.has(selector)) continue;
    const exempt = genericExceptions[selector];
    if (exempt) result.genericWithExceptions[selector] = [...new Set(exempt)];
    else result.generic.push(selector);
  }
  return result;
}

/** `sub.news.a.com` → [sub.news.a.com, news.a.com, a.com, com]: rules for a parent apply below it. */
export function hostSuffixes(hostname: string): string[] {
  const labels = hostname.toLowerCase().split(".");
  return labels.map((_, i) => labels.slice(i).join("."));
}

/** One rule per selector: a single invalid selector inside a group would void the whole group. */
export function toHidingCss(selectors: Iterable<string>): string {
  let css = "";
  for (const selector of selectors) css += `${selector}{display:none!important}\n`;
  return css;
}

/** Host-specific CSS: domain selectors plus generic-with-exception selectors not exempted here. */
export function cssForHost(rules: Omit<CosmeticRules, "generic">, hostname: string): string {
  const suffixes = hostSuffixes(hostname);
  const excepted = new Set(suffixes.flatMap((s) => rules.exceptionsByDomain[s] ?? []));
  const selectors = new Set<string>();
  for (const s of suffixes) {
    for (const selector of rules.byDomain[s] ?? []) {
      if (!excepted.has(selector)) selectors.add(selector);
    }
  }
  for (const [selector, exempt] of Object.entries(rules.genericWithExceptions)) {
    if (!suffixes.some((s) => exempt.includes(s))) selectors.add(selector);
  }
  return toHidingCss(selectors);
}
