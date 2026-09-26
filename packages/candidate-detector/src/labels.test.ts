import { expect, test } from "bun:test";
import { matchLabel } from "./labels";

test.each([
  ["Sponsored", "sponsored"],
  ["· Sponsored ·", "sponsored"],
  ["Sponsored by Acme Insurance", "sponsored"],
  ["SPONSORED CONTENT", "sponsored"],
  ["Promoted", "promoted"],
  ["Advertisement", "advertisement"],
  ["Advertisement:", "advertisement"],
  ["[Ad]", "ad"],
  ["Ad · shop.example", "ad"],
  ["Paid partnership with BrandCo", "paid-partnership"],
  ["Partner content", "partner-content"],
])("%p is a %s label", (text, hint) => {
  expect(matchLabel(text)).toBe(hint as ReturnType<typeof matchLabel>);
});

test.each([
  "",
  "Add to cart",
  "Adventure",
  "Headlines",
  "Our charity run was sponsored by the city",
  "Sponsorship opportunities",
  "Promotions and discounts for members",
])("%p is not a label", (text) => {
  expect(matchLabel(text)).toBeNull();
});
