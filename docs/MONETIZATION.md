# PlayNxt Monetization Strategy

## Core Principle (Non-Negotiable)

**PlayNxt must never feel like it's optimizing for money instead of helping the user decide.**

The moment users think "This app is trying to sell me something" — you lose the core value.

Monetization must be:
- Optional
- Value-add
- Never influence recommendations

---

## Phase 1: Free First, No Monetization (MVP)

**Do not monetize at launch.**

First goals:
- Prove the problem
- Validate retention
- Build trust

Target user sentiment: *"Why is this free?"*

---

## Phase 2: Premium Upgrade (Primary Model)

### Model
One-time purchase or low-cost annual subscription — best fit for adult gamers.

### Premium Features

| Feature | Description | Value Proposition |
|---------|-------------|-------------------|
| **Smart History** | See what worked in the past, filter by "worked before", reuse good fits | "Saves me time every week" |
| **Unlimited Rerolls** | Free tier has limited rerolls per session/day | Monetizes decision fatigue, not discovery |
| **Advanced Filters** | Shortest session, controller-friendly, low cognitive load | Power user features |
| **Cross-Device Sync** | Save preferences across devices (requires login) | Fair and useful |

### Pricing Recommendation

| Option | Price | Notes |
|--------|-------|-------|
| One-time purchase | $2.99 | **Recommended** — builds trust |
| Monthly | $1.99/month | For testing |
| Annual | $9.99/year | Best value messaging |

**Initial recommendation:** One-time purchase for trust.

---

## Phase 3: Affiliate Revenue (Optional, Careful)

### Implementation
- "Play on Steam" → affiliate link
- "Available on Xbox Game Pass" → affiliate link
- "Available on PlayStation Store" → affiliate link

### Hard Rules
Affiliate links must be:
- ✅ Clearly labeled
- ✅ Secondary UI (not primary CTA)
- ✅ Never affect ranking or recommendations

Position as: **"Jump to play"** — not "Buy now"

---

## Phase 4: Enterprise / Licensing (Future)

Potential longer-term opportunities:
- License recommendation logic to indie storefronts
- Partner with subscription services (Game Pass, PS Plus)
- Media site integrations

Not building for now — just keep the door open.

---

## Models to Avoid

| Model | Risk | Reason |
|-------|------|--------|
| ❌ Ads | High | Breaks trust, hurts UX |
| ❌ Sponsored recommendations | Very High | Destroys core promise |
| ❌ Pay-to-unlock games | High | Confuses value prop |
| ❌ Data resale | Very High | Privacy violation |
| ❌ Dark-pattern upsells | Very High | User hostile |

---

## Premium Introduction Guidelines

### Timing
Only show premium prompts after:
1. User has accepted multiple recommendations
2. User has submitted "this worked for me" feedback at least once

### Copy Examples

**Do:**
> "Want to save what works and get even better picks?"

**Don't:**
> "Upgrade to Premium"

### UI Placement
- Never interrupt the core flow
- Show in settings or after positive feedback
- Use soft, non-intrusive prompts

---

## Implementation Checklist

### MVP (Phase 1)
- [ ] No monetization code
- [ ] Track engagement metrics for future gating decisions
- [ ] Store signal history (foundation for Smart History)

### Phase 2 Launch
- [ ] Add premium flag to user model
- [ ] Implement reroll limits for free tier
- [ ] Build Smart History feature
- [ ] Add in-app purchase (iOS/Android)
- [ ] Add web payment option (Stripe)
- [ ] Cross-device sync with authentication

### Phase 3
- [ ] Add affiliate link fields to game metadata
- [ ] Build "where to play" UI component
- [ ] Track affiliate click-through rates

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Conversion rate (free → premium) | 3-5% | Premium purchases / Active users |
| Premium retention | >80% | Premium users returning monthly |
| Revenue per user (RPU) | $0.10-0.15 | Total revenue / Total users |
| Affiliate click-through | 5-10% | Clicks / Recommendations shown |

---

## Summary

**Recommended initial model:**
1. Free MVP (no monetization)
2. One-time premium unlock ($2.99)
3. Premium = Smart History + Unlimited Rerolls + Cross-Device Sync

This aligns with PlayNxt's promise:

> **Save me time. Respect my attention.**
