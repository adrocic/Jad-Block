// Structural fingerprints: the same layout on the same site hashes the same across page loads,
// regardless of the text or images inside. Never includes text, so it's safe to cache and send.

const ANCESTOR_DEPTH = 3;
const MAX_CLASSES = 3;
const MAX_CHILDREN = 12;

/**
 * CSS-in-JS and build tools generate class names that change between deploys (e.g. "css-1q2w3e",
 * "sc-bdVaJa", "_a1b2c3"). They'd make fingerprints unstable, so they're dropped.
 */
export function isGeneratedClass(name: string): boolean {
  return (
    /\d.*\d/.test(name) || /^(css|sc|jsx|emotion|styled|svelte)-/.test(name) || /^_/.test(name)
  );
}

function nodeSignature(el: Element): string {
  const classes = Array.from(el.classList)
    .filter((c) => !isGeneratedClass(c))
    .sort()
    .slice(0, MAX_CLASSES);
  const role = el.getAttribute("role");
  return [el.localName, ...classes.map((c) => `.${c}`), role ? `[${role}]` : ""].join("");
}

/**
 * The pre-hash signature. Exposed for debugging and tests.
 *
 * `discriminators` are non-private semantic categories that must split the cache even when markup
 * is identical, e.g. disclosure labels: an ad card and a content card often share exact markup,
 * and a cached "hide" for one must never apply to the other.
 */
export function structuralSignature(
  el: Element,
  site: string,
  discriminators: readonly string[] = [],
): string {
  const ancestors: string[] = [];
  let parent = el.parentElement;
  for (let i = 0; i < ANCESTOR_DEPTH && parent && parent.localName !== "body"; i++) {
    ancestors.unshift(nodeSignature(parent));
    parent = parent.parentElement;
  }
  const children = Array.from(el.children)
    .slice(0, MAX_CHILDREN)
    .map((child) => child.localName);
  const extra = [...discriminators].sort().join(",");
  return `${site}|${ancestors.join(">")}>${nodeSignature(el)}|${children.join(",")}|${extra}`;
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/** 64-bit FNV-1a as 16 hex chars. Not cryptographic, which is fine for cache keys. */
export function fnv1a64(input: string): string {
  let hash = FNV_OFFSET;
  for (const byte of new TextEncoder().encode(input)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
}

/** Fingerprint of an element's layout on a site (pass the page's hostname as `site`). */
export function fingerprint(
  el: Element,
  site: string,
  discriminators: readonly string[] = [],
): string {
  return fnv1a64(structuralSignature(el, site, discriminators));
}
