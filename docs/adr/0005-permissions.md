# 0005: Extension permissions

**Status:** accepted (2026-09-25)

| Permission | Why |
|---|---|
| `declarativeNetRequest` | Static EasyList/EasyPrivacy rulesets, plus one dynamic `allowAllRequests` rule per site the user disables. No `declarativeNetRequestFeedback`, since we don't read which requests matched. |
| `scripting` | Registers the generic cosmetic stylesheet with `excludeMatches` (list `$generichide` sites plus user-disabled sites), and injects per-host cosmetic CSS with `origin: "USER"` so pages can't override it. No install warning. |
| `storage` | Settings, classification cache (L2), local shadow log. |
| `<all_urls>` host access | The content script must run on every page to find native ads, and `insertCSS` needs host access. |

Not requested: `webRequest`/`webRequestBlocking` (not available for blocking in MV3), `tabs`
(`activeTab` isn't needed because the popup messages the tab's content script), `webNavigation`,
`declarativeNetRequestFeedback`, `unlimitedStorage`.
