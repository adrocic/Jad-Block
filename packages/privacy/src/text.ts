import { MAX_UNTRUSTED_TEXT } from "@semantic-blocker/schemas";

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
const URL_LIKE = /\b(?:https?:\/\/|www\.)\S+/gi;
const SSN = /\b\d{3}[- ]\d{2}[- ]\d{4}\b/g;
// Runs of 13-19 digits, optionally split by spaces or dashes, that could be card numbers.
const CARD_CANDIDATE = /\b(?:\d[ -]?){12,18}\d\b/g;
// Any remaining run of 7+ digits (phone numbers, account numbers, IDs).
const LONG_NUMBER = /\+?\(?\d(?:[\s().-]*\d){6,}/g;

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Removes personal data from visible page text before it can leave the browser, then collapses
 * whitespace and truncates. Order matters: specific patterns run before the generic number catch-all.
 */
export function sanitizeText(input: string): string {
  let text = input
    .replace(EMAIL, "[email]")
    .replace(URL_LIKE, "[url]")
    .replace(SSN, "[number]")
    .replace(CARD_CANDIDATE, (match) => (passesLuhn(match.replace(/\D/g, "")) ? "[card]" : match))
    .replace(LONG_NUMBER, "[number]")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length > MAX_UNTRUSTED_TEXT) {
    text = `${text.slice(0, MAX_UNTRUSTED_TEXT - 1).trimEnd()}…`;
  }
  return text;
}
