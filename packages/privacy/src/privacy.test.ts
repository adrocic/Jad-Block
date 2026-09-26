import { describe, expect, test } from "bun:test";
import { MAX_UNTRUSTED_TEXT } from "@jad-block/schemas";
import { sampleFeatures } from "@jad-block/schemas/testing";
import { sanitizeCandidate, sanitizeText, sensitiveCategory } from "./index";

describe("sanitizeText", () => {
  test("redacts email addresses", () => {
    expect(sanitizeText("Contact jane.doe+ads@example.co.uk today")).toBe("Contact [email] today");
  });

  test("redacts Luhn-valid card numbers in common formats", () => {
    expect(sanitizeText("Card 4111 1111 1111 1111 on file")).toBe("Card [card] on file");
    expect(sanitizeText("Card 4111-1111-1111-1111")).toBe("Card [card]");
  });

  test("redacts SSNs", () => {
    expect(sanitizeText("SSN 123-45-6789")).toBe("SSN [number]");
  });

  test("redacts phone and account numbers", () => {
    expect(sanitizeText("Call (555) 123-4567 now")).toBe("Call [number] now");
    expect(sanitizeText("Account 00123456789")).toBe("Account [number]");
  });

  test("redacts URLs, which can carry tokens in query strings", () => {
    expect(sanitizeText("Go to https://example.com/reset?token=abc123 now")).toBe(
      "Go to [url] now",
    );
  });

  test("keeps short numbers that describe ads, like prices and percentages", () => {
    expect(sanitizeText("Save 50% — only $19.99 in 2026")).toBe("Save 50% — only $19.99 in 2026");
  });

  test("collapses whitespace and truncates to the schema limit", () => {
    expect(sanitizeText("  Sponsored \n\n  Learn   more ")).toBe("Sponsored Learn more");
    const long = sanitizeText("word ".repeat(200));
    expect(long.length).toBeLessThanOrEqual(MAX_UNTRUSTED_TEXT);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("sensitiveCategory", () => {
  test.each([
    ["https://mail.google.com/mail/u/0/", "webmail"],
    ["https://www.chase.com.onlinebanking.example/", "banking"],
    ["https://secure.bank-of-somewhere.com/login", "banking"],
    ["https://mychart.somehospital.org/", "health"],
    ["https://vault.bitwarden.com/", "password-manager"],
    ["http://localhost:3000/", "local-network"],
    ["http://192.168.1.1/", "local-network"],
    ["http://10.0.0.5/admin", "local-network"],
    ["https://wiki.corp/", "local-network"],
    ["http://intranet/", "local-network"],
    ["file:///C:/Users/me/page.html", "not-web"],
    ["chrome://settings", "not-web"],
    ["not a url", "not-web"],
  ])("%s is %s", (url, category) => {
    expect(sensitiveCategory(url)).toBe(category as ReturnType<typeof sensitiveCategory>);
  });

  test.each([
    "https://www.nytimes.com/2026/09/25/world/story.html",
    "https://www.reddit.com/r/programming/",
    "https://bankrate-news.example.com/", // "bankrate" is not the whole label "bank"
    "https://www.mailchimp.com/",
    "http://172.32.0.1/", // just outside the 172.16/12 private range
  ])("%s is not sensitive", (url) => {
    expect(sensitiveCategory(url)).toBeNull();
  });
});

describe("sanitizeCandidate", () => {
  test("sanitizes text and returns a schema-valid candidate", () => {
    const out = sanitizeCandidate(sampleFeatures({ untrustedText: "Sponsored by me@x.com" }));
    expect(out.untrustedText).toBe("Sponsored by [email]");
  });

  test("rejects candidates with unknown fields instead of silently passing them", () => {
    const bad = { ...sampleFeatures(), cookies: "session=abc" };
    expect(() => sanitizeCandidate(bad)).toThrow();
  });
});
