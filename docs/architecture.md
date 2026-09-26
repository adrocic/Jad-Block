# Architecture

Full reasoning: [original-proposal.md](original-proposal.md) (the design) and
[build-plan.md](build-plan.md) (adjustments after researching Jev, stack, and milestones).

```
Network ─▶ DNR static rules (EasyList/EasyPrivacy, compiled at build) ─▶ blocked before download
DOM ─▶ packaged cosmetic CSS ─▶ MutationObserver ─▶ candidate detector (local suspicion score)
      ─▶ fingerprint ─▶ cache L1 memory / L2 storage / L3 packaged ─ hit ─▶ decision engine
                                   │ miss
                                   ▼
      feature extractor ─▶ privacy sanitizer ─▶ zod schema ─▶ background ─▶ Worker /v1/classify
                                                                        ─▶ SemanticClassifier (Jev)
      probabilities ◀────────────────────────────────────────────────────────┘
      ─▶ decision engine (packaged thresholds; shadow mode first) ─▶ reversible hide
```

## Invariants
- The classifier provides evidence and the packaged decision engine decides. See ADR 0002.
- Jev is the last mile, not the first line of defense. See ADR 0001.
- Jev can't do arithmetic or counting, so the feature extractor turns numbers into semantic
  categories (for example "standard IAB medium-rectangle size") before anything is sent.
- Page rendering never waits on the classifier. Every failure falls back to DNR + cosmetic + cache.
