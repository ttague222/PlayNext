# Store listing copy

Source of truth for the text on the App Store and Google Play listings.

Store copy was previously untracked and lived only in App Store Connect, which is how it drifted out of sync with the app — the live description described a swipe interaction and a "Let's Play" button that do not exist. Keep these files updated **in the same PR as the feature change**, then paste into the console.

| File | Field | Limit |
|---|---|---|
| `app-store/description.txt` | App Store → Description | 4,000 |

Apple does not index the description for search, so write it for conversion. Google Play does index its long description.

## Rules

1. **Every claim must be traceable to shipped code.** Not the PRD, not the roadmap — the build that is actually live. The PRD is stale in places (it says ads are out of scope; the app ships ads).
2. **Don't name a button unless that string exists in the app.** The `Let's Play` claim came from naming a CTA that was never built.
3. **Don't state a premium-gated behavior as if it were free.** History-based personalization requires sign-in plus `favor_history`, so it cannot be described as a flat benefit.

Planned metadata changes (title, subtitle, keyword field) live in `../ASO-PLAN.md` and are not yet applied to the live listings.
