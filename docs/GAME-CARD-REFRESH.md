# Game Card Refresh (Results Screen)

> Spec for the release after 1.4.0 (target 1.5.0). Drafted 2026-09-28 from the
> design critique of the live 1.3.0 card (Game Dev Tycoon screenshot, real
> device). Scope is the results-screen `GameCard` plus the server-side
> explanation quality that the card showcases.
>
> Mockups (before / v1 pass / elevated / states & motion):
> https://claude.ai/artifact/QDGUYtQoBZ5iShfYBeCJ6o (private canvas, ask Tom
> for access).

## Problem Statement

The results card spans roughly two full screens on a standard phone, so the
decision moment (title, why it fits, "I'll play this!") is never visible in one
glance and the primary CTA sits about 1.5 screens below the title. The most
saturated element on screen is a tertiary commerce button (brand-colored
subscription chips), not the CTA. Meanwhile the "Why this fits" box gets hero
treatment but frequently shows near-identical boilerplate across different
games, which undermines the product's core promise (PRD §3: max 3 picks, each
with a clear explanation).

## Goals

1. Title, platforms, one-line description, match %, and the primary CTA visible
   in a single viewport (baseline: iPhone 15 / 393pt width) without scrolling.
2. Every explanation bullet contains at least one game-specific clause; no two
   games in the same result set share an identical bullet.
3. The CTA is the only saturated-fill element on the card.
4. Move the needle on `recommendation_accepted` rate (leading) without hurting
   `already_played` / thumbs-down rates (guardrail).

## Non-Goals

- No new card capabilities (no video, no screenshots carousel, no reviews).
  This is a hierarchy and content-quality pass, not a feature addition.
- No changes to the share card, celebration modal, or GameDetailScreen. Same
  visual language, separate surfaces; touch them in a later pass if this works.
- No redesign of the reroll / ad-gate flow.
- No price or paywall changes.
- No Play/App Store listing screenshot updates in this release (listing
  refresh is a separate decision tied to the ASO plan).

## User Stories

- As a player who just asked for picks, I want to see what the game is and act
  on it without scrolling, so that choosing takes seconds.
- As a player comparing my 3 picks, I want the "why" to say something true
  about THIS game, so that I trust the recommendation.
- As a player who owns a subscription, I want to see where I can play at a
  glance without it shouting over the recommendation itself.
- As a player who dislikes a pick, I want the dislike control labeled, so I
  don't confuse it with "already played."

## Requirements

### P0 — Must have

**P0.1 Compact decision block.**
Order: art (with TOP PICK + match % overlaid) → title + platforms → one-line
description → CTA row. "Why this fits", chips, commerce, and secondary actions
follow below the CTA.
- [ ] On a 393×852pt viewport, art through CTA fits without scrolling.
- [ ] Match % badge remains visible after the art scrolls (move % into the
      title row or pin it; do not lose it with the image).

**P0.2 Explanation quality (server side, `api-service`).**
`recommendation_service` explanation generation:
- [ ] Max 2 bullets per game (down from 3).
- [ ] Each bullet references at least one of: genre/mechanic, session length
      fit to the requested time, mood mapping, or library status.
- [ ] Generic filler phrases ("enjoyable gameplay experience", "freedom to
      create and explore") are removed from the template pool.
- [ ] Within one response, no two games share an identical bullet string
      (dedupe at assembly time; fall back to a different template).
- [ ] `library_fit` line (Backlog Mode) unchanged.
- Note: deploys with the API, independent of the app binary. Ship first.

**P0.3 Demote commerce.**
- [ ] Subscription and storefront chips render as outline/ghost chips
      (monochrome fill, small brand glyph or plain text), one shared row
      labeled "WHERE TO PLAY".
- [ ] The CTA gradient is the only saturated fill on the card.

**P0.4 Dedupe chips vs bullets.**
- [ ] "Jump right in" / "Stop anytime" chips are removed; stop-friendliness
      and time-to-fun facts live only in the explanation bullets (or a single
      meta row if a bullet doesn't cover them).

**P0.5 Action row clarity.**
- [ ] Thumbs-down gets a label ("Not for me") and routes to the existing
      Not For Me collection.
- [ ] "Already played" uses a non-checkmark icon at rest; checkmark appears
      only as post-tap confirmation.

### P1 — Nice to have

- Section labels ("WHERE TO PLAY") in small caps matching the "WHY THIS FITS"
  treatment; collapse mixed corner radii to two values (outer 20, inner 12).
- Tighten inter-section vertical spacing ~30% (audit `paddingVertical` in
  `GameCard.js` styles).
- Analytics: add `card_cta_visible_without_scroll` (bool at first render) to
  the existing funnel events to measure P0.1 directly.

### P2 — Future considerations

- Collapsible "More ways to play" row if commerce metadata grows.
- Per-user explanation personalization beyond library (history-aware wording,
  premium "lean on what's worked").
- Applying the same hierarchy pass to GameDetailScreen and the share card.

## Interaction & Motion

Elevated pass (2026-09-28), mockups on the "Elevated" and "States & motion"
artboards of the design canvas. Principles: animate only `transform` and
`opacity` (GPU path in Reanimated); exits faster than entries; the more often
an action repeats, the less it animates.

### P0.6 — Press feedback (must have)

- [ ] Every tappable on the card scales to 0.97 over 120ms ease-out on
      press-in and springs back on release (Reanimated `withTiming` in /
      `withSpring` out). Applies to CTA, action row, commerce chips.
- [ ] CTA additionally darkens ~8% while pressed (opacity overlay, not a
      color animation).

### P1 — Motion set (nice to have, ship together or not at all)

| Moment | Spec | Rationale |
|---|---|---|
| First render of a result set | Hero, title block, reason lines stagger in: translateY(8) + fade, 220ms, cubic-bezier(0.23, 1, 0.32, 1), 50ms apart | Seen a few times per session; restrained cascade, well under 300ms total feel |
| Reroll | No stagger. 150ms crossfade of card content only | Frequent action; decoration must never make it feel slower |
| Art loading | Shimmer sweep on the surface color, 1.4s linear loop, block pre-sized | No spinner, no layout shift |
| Save confirmed | Bookmark icon fills with spring (duration 0.4, bounce 0.25); label "Save" to "Saved" under a 2px blur crossfade | Rare action, earns a small moment of delight |
| Not for me | Card exits translateX(-24) + 2deg tilt + fade, 180ms ease-out; next pick settles up 240ms | Spatial continuity; exit faster than entry |
| Match % on first set | Count-up over 500ms, first result set only, never on reroll | Decorative; frequency-gated |

- [ ] `prefers-reduced-motion` (RN `AccessibilityInfo.isReduceMotionEnabled`):
      replace all movement with 150ms fades; keep the shimmer static.
- [ ] No entrance animation on anything keyboard/system initiated (deep links
      land on a settled card).

### Visual refinements in the Elevated pass (fold into P0.1/P0.3 build)

- Full-bleed hero with a scrim gradient into the card surface; match pill
  straddles the hero/content seam.
- Boxed sections replaced by hairline dividers (rgba(255,255,255,0.06)) with
  11px/700 tracked labels; 4-step text ramp #FFFFFF / #C9C9D6 / #9B9BB0 /
  #8A8AA5; title 26/800 at -0.5 tracking.
- Meta line gains typical session length ("~20 min sessions") sourced from
  the existing time-to-fun data.
- CTA 56pt with soft brand glow (shadow color from the accent).
- Included-subscription chip gets a green presence dot; store chips stay
  ghost.

## Success Metrics

- Leading (2 weeks post-release): `recommendation_accepted` per result-set up
  vs. 1.4.0 baseline; reroll rate flat or down; time from results render to
  first action down.
- Guardrail: thumbs-down rate not up more than noise; crash-free rate
  unchanged (layout change only).
- Qualitative: no two identical bullets in any spot-checked result set.

## Open Questions

- [Design] Does match % move into the title row permanently, or pin over the
  art on scroll? (Prototype both; title-row is cheaper.)
- [Eng] Are explanation templates purely server-side today, or does the app
  post-process? (Verify in `recommendation_service.py` before splitting work.)
- [Data] Is `recommendation_accepted` already segmented by card position
  (top pick vs #2/#3)? Needed for the success metric.

## Timeline

- 1.4.0 release ships first (version bump + /mobile-release pending, ~Oct 3).
- P0.2 (API) can deploy any time after 1.4.0 ships; it improves the live card
  immediately.
- Card layout work (P0.1, P0.3–P0.5) targets 1.5.0. Full production-artifact
  device verification required (same runbook pattern as 1.3.0), since this
  touches the highest-traffic screen.
