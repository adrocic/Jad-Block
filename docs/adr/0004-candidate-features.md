# 0004: What a candidate may send off-device

**Status:** accepted (2026-09-25)

## Decision
`CandidateFeatures` (`packages/schemas/src/features.ts`) is the complete list of what may leave
the browser about a page element. It is a strict schema: unknown fields are rejected on both the
client (`sanitizeCandidate`) and the server.

| Field | Content | Why it's acceptable |
|---|---|---|
| `fingerprint` | 64-bit hash of tag/class/role structure + site + label categories | No text. Only matches identical layouts. |
| `tag`, `position`, `size`, `links` | Semantic categories (e.g. `iab-medium-rectangle`, `sidebar`) | No raw numbers, no URLs. |
| `labelHints`, `adLikeAttributes` | Disclosure label categories, boolean | Derived locally from a fixed vocabulary. |
| `media`, `layout`, `interaction` | Booleans | Structural only. |
| `untrustedText` | Up to 280 chars of visible text | Excludes inputs, textareas, editable regions, scripts, and hidden text. Emails, card numbers, SSNs, long numbers, and URLs are redacted. |

Never sent: HTML, URLs (page or link), query strings, input values, cookies, storage, headers.

## Notes
- The fingerprint includes disclosure-label categories because an ad card and a content card often
  share identical markup. Without them, a cached "hide" for the ad would apply to the content.
- Remote classification is also skipped entirely on sensitive sites (`sensitiveCategory`) unless the
  user opts in for that site.
