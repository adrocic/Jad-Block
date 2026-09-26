// End-to-end smoke test: loads the built Chrome extension into Playwright's Chromium and checks
// DNR blocking, cosmetic hiding, semantic shadow/enforce behavior, opt-in remote classification
// against a local `wrangler dev` Worker, and per-site disabling. Every hostname resolves to
// 127.0.0.1, so no request reaches the real internet.
// Run: bun run e2e (builds the Chrome extension with WXT_API_URL=http://api.test:8787 first)
// Runs on Node (type stripping), not Bun: Playwright's browser launch hangs under Bun on Windows.
import { strict as assert } from "node:assert";
import { type ChildProcess, execSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type BrowserContext, chromium, type Page, type Worker } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const EXTENSION = join(here, "..", "..", "apps", "extension", ".output", "chrome-mv3");
const hits: string[] = [];

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://placeholder");
  const host = request.headers.host?.split(":")[0] ?? "";
  hits.push(`${host}${url.pathname}`);
  if (url.pathname.endsWith(".js")) {
    response.writeHead(200, { "content-type": "text/javascript" }).end("/* script */");
  } else {
    response.writeHead(200, { "content-type": "text/html" }).end(page(port));
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as AddressInfo).port;

function page(port: number): string {
  return `<!doctype html><html><head><title>Shop news</title></head><body>
<main><article>
  <h1>Local shop reopens after renovation</h1>
  <p>The corner hardware store reopened on Saturday after a six-month renovation that doubled its
  floor space and added a garden center, drawing a long line of customers before opening time.</p>
  <div class="ad-slot" id="cosmetic-target">Generic ad slot</div>
  <div class="native-card" id="semantic-target" style="width:640px;height:180px">
    <span>Sponsored</span>
    <a href="https://brand.example/offer">Save on power tools this week</a>
  </div>
  <p>The owners said they plan to host weekend workshops for new homeowners starting next month,
  covering basic repairs, painting, and simple woodworking projects for beginners.</p>
</article></main>
<script src="http://adnxs.com:${port}/ad.js"></script>
<script src="http://cdn.shop.example:${port}/ok.js"></script>
</body></html>`;
}

async function until<T>(what: string, check: () => Promise<T | undefined | false>, ms = 10_000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timed out waiting for: ${what}`);
}

const storageSet = (sw: Worker, items: Record<string, unknown>) =>
  sw.evaluate((i) => chrome.storage.local.set(i), items);

async function loadPage(page: Page, url: string) {
  hits.length = 0;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(1500); // idle-time semantic scan
}

const isHidden = (page: Page, selector: string) =>
  page.$eval(selector, (el) => getComputedStyle(el).display === "none");

const API_PORT = 8787;

/** Starts the classification Worker locally (workerd via wrangler) and waits until healthy. */
async function startApi(): Promise<ChildProcess> {
  const api = spawn("bunx", ["wrangler", "dev", "--port", String(API_PORT), "--ip", "127.0.0.1"], {
    cwd: join(here, "..", "..", "apps", "api"),
    shell: process.platform === "win32",
    stdio: "ignore",
  });
  await until(
    "local API",
    async () => {
      const res = await fetch(`http://127.0.0.1:${API_PORT}/health`).catch(() => null);
      return res?.ok;
    },
    60_000,
  );
  return api;
}

function stopApi(api: ChildProcess | undefined): void {
  if (!api?.pid) return;
  // wrangler spawns workerd; on Windows only taskkill /T takes down the whole tree.
  if (process.platform === "win32") execSync(`taskkill /pid ${api.pid} /T /F`, { stdio: "ignore" });
  else api.kill("SIGTERM");
}

type LogEntry = { state: string; modelVersion: string };
const readShadowLog = async (sw: Worker) =>
  ((await sw.evaluate(() => chrome.storage.local.get("shadowLog"))).shadowLog ?? []) as LogEntry[];

let context: BrowserContext | undefined;
let api: ChildProcess | undefined;
const results: string[] = [];
const pass = (name: string) => results.push(`  ✔ ${name}`);

try {
  api = await startApi();

  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
      "--host-resolver-rules=MAP * 127.0.0.1",
    ],
  });
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  await until("generic cosmetic registration", async () => {
    const scripts = await sw.evaluate(() => chrome.scripting.getRegisteredContentScripts());
    return scripts.length > 0;
  });
  pass("service worker started and registered generic cosmetic CSS");

  // Chrome silently leaves rulesets disabled when the global static-rule limit is exceeded.
  const { declared, enabled } = await sw.evaluate(async () => ({
    declared: (chrome.runtime.getManifest().declarative_net_request?.rule_resources ?? []).map(
      (r) => r.id,
    ),
    enabled: await chrome.declarativeNetRequest.getEnabledRulesets(),
  }));
  assert.ok(declared.length >= 2, `expected chunked rulesets, got ${declared}`);
  assert.deepEqual([...enabled].sort(), [...declared].sort());
  pass(`all ${declared.length} static DNR rulesets are enabled`);

  const url = `http://shop.example:${port}/`;
  const page = await context.newPage();
  await loadPage(page, url);

  assert.ok(!hits.some((h) => h.startsWith("adnxs.com")), `ad request reached server: ${hits}`);
  assert.ok(hits.includes("cdn.shop.example/ok.js"), "first-party script should load");
  pass("DNR blocks the ad server; first-party requests load");

  assert.ok(await isHidden(page, "#cosmetic-target"));
  pass("generic cosmetic rule hides .ad-slot");

  const log = await until("shadow log entry", async () => {
    const entries = await readShadowLog(sw);
    return entries.length > 0 ? entries : false;
  });
  assert.equal(log[0]?.state, "would-hide");
  assert.equal(log[0]?.modelVersion, "heuristic-1", "remote must be off by default");
  assert.equal(await isHidden(page, "#semantic-target"), false);
  pass("shadow mode logs the native ad as would-hide, classified locally by default");

  await storageSet(sw, { mode: "enforce" });
  await loadPage(page, url);
  assert.ok(await isHidden(page, "#semantic-target"));
  assert.ok(await page.$("#semantic-target[data-sb-hidden]"));
  pass("enforce mode hides the native ad reversibly (data-sb-hidden)");

  await storageSet(sw, { remoteClassification: true, shadowLog: [] });
  await loadPage(page, url);
  const remoteLog = await until("remote classification", async () => {
    const entries = await readShadowLog(sw);
    return entries.some((e) => e.modelVersion === "api-heuristic-1") ? entries : false;
  });
  assert.ok(remoteLog.length > 0);
  assert.ok(await isHidden(page, "#semantic-target"));
  pass("opted in: the native ad is classified by the Worker API (api-heuristic-1)");

  await storageSet(sw, { disabledSites: ["shop.example"] });
  await until("site allow rule", async () => {
    const rules = await sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules());
    return rules.length > 0;
  });
  await loadPage(page, url);
  assert.ok(
    hits.some((h) => h.startsWith("adnxs.com")),
    "ad request should pass when disabled",
  );
  assert.equal(await isHidden(page, "#cosmetic-target"), false);
  assert.equal(await isHidden(page, "#semantic-target"), false);
  pass("disabling the site turns off network, cosmetic, and semantic blocking");

  console.log(`e2e passed\n${results.join("\n")}`);
} catch (error) {
  console.log(results.join("\n"));
  console.error("e2e FAILED:", error);
  process.exitCode = 1;
} finally {
  await context?.close();
  server.close();
  stopApi(api);
}
