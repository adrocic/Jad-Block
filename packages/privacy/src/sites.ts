export type SensitiveCategory =
  | "not-web"
  | "local-network"
  | "banking"
  | "webmail"
  | "health"
  | "password-manager";

// Exact hosts (and their subdomains) that are sensitive regardless of keywords.
const KNOWN_HOSTS: Record<string, SensitiveCategory> = {
  "mail.google.com": "webmail",
  "outlook.live.com": "webmail",
  "outlook.office.com": "webmail",
  "outlook.office365.com": "webmail",
  "mail.yahoo.com": "webmail",
  "mail.proton.me": "webmail",
  "app.fastmail.com": "webmail",
  "mychart.com": "health",
  "1password.com": "password-manager",
  "bitwarden.com": "password-manager",
  "lastpass.com": "password-manager",
  "dashlane.com": "password-manager",
  "paypal.com": "banking",
};

// Keywords matched against whole hostname labels (split on "." and "-").
const LABEL_KEYWORDS: Record<string, SensitiveCategory> = {
  bank: "banking",
  banking: "banking",
  onlinebanking: "banking",
  creditunion: "banking",
  webmail: "webmail",
  mail: "webmail",
  patient: "health",
  patientportal: "health",
  mychart: "health",
  health: "health",
  vault: "password-manager",
};

const LOCAL_SUFFIXES = [".local", ".internal", ".lan", ".home", ".corp", ".intranet", ".test"];

function isPrivateIp(host: string): boolean {
  if (host === "[::1]" || host.startsWith("[fc") || host.startsWith("[fd")) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(host);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/**
 * Returns why a page is too sensitive for remote semantic analysis, or null if it isn't.
 * Remote analysis is off on these pages unless the user opts in for that site.
 * Deliberately over-inclusive: a false positive only costs us semantic detection on that page.
 */
export function sensitiveCategory(pageUrl: string): SensitiveCategory | null {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return "not-web";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "not-web";

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || !host.includes(".") || isPrivateIp(host)) return "local-network";
  if (LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return "local-network";

  for (const [known, category] of Object.entries(KNOWN_HOSTS)) {
    if (host === known || host.endsWith(`.${known}`)) return category;
  }
  for (const label of host.split(/[.-]/)) {
    const category = LABEL_KEYWORDS[label];
    if (category) return category;
  }
  return null;
}
