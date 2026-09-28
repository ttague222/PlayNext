# Card Motion Set (P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Implement the P1 motion set from docs/GAME-CARD-REFRESH.md "Interaction & Motion" (ships together or not at all) plus three carried nits from the final card-refresh review.

**Architecture:** Motion primitives (`useReducedMotion` hook, `FadeSlideIn`, `ShimmerBlock`) live in mobile-app/src/components; GameCard consumes them, driven by two new props from ResultsScreen (`animateEntrance` for the first result set, `isSaved` from a `savedGameIds` set). Everything animates `transform`/`opacity` only, native driver. Reduced motion replaces movement with 150ms fades and stops the shimmer loop.

**Motion values (from spec):** entrance = translateY(8)+fade, 220ms, Easing.bezier(0.23,1,0.32,1), 50ms between card segments (hero → title block → reasons), +120ms per card index, FIRST result set only; reroll/swap = no stagger; shimmer = 1.4s linear loop, pre-sized block; Save confirm = bookmark fill + spring pop (Animated.spring, friction 5, tension 140) + 150ms label opacity crossfade (RN has no cheap text blur — documented deviation from the "2px blur" spec line); swap-out = old card to translateX(-24) 2deg tilt fade over 180ms while `isSwapping`, replacement settles in translateY(12)+fade 240ms; match % count-up 500ms first set only.

**Carried nits (Task N0):**
- API `_build_recommendation`: normalized texts of bullets dropped by the `[:2]` trim must be REMOVED from `used_bullets` (they were registered during selection but never emitted); fix the backwards trim comment ("keeps the front, drops from the back").
- PressableScale: press handlers stay attached regardless of `disabled` so a mid-press disable cannot strand `pressed`/scale; `handlePressIn` no-ops when disabled, `handlePressOut` always resets.

**Out of scope:** version bumps; GameDetailScreen/share/celebration surfaces; any new dependency (Reanimated NOT added — core `Animated` only).

## Tasks

- [ ] **N0**: nits above, TDD (API test: game A session/time-only drops time_fit from the trim, game B with the identical time_fit template can still emit it; PressableScale test: pressIn → rerender disabled → pressOut clears the overlay). Commit "fix: release trimmed bullets and unstick disabled press state".
- [ ] **M1**: `useReducedMotion.ts` (AccessibilityInfo.isReduceMotionEnabled + change subscription), `FadeSlideIn.tsx` (props: delay, enabled; mount-only animation; reduced-motion = 150ms fade), `ShimmerBlock.tsx` (style prop; loops highlight; static surface under reduced motion); replace GameCard's thumbnail ActivityIndicator overlay with ShimmerBlock. Tests for all three + updated GameCard render. Commit "feat(mobile): motion primitives and art shimmer".
- [ ] **M2**: ResultsScreen tracks first-set entrance (`hasAnimatedInRef`, set after first successful non-reroll render; rerolls/swaps never re-arm) and passes `animateEntrance` + `entranceIndex` to GameCard; GameCard wraps hero / title-block(+CTA) / why-section in FadeSlideIn (delays entranceIndex*120 + 0/50/100) only when `animateEntrance`; match pill counts up 500ms only then, static otherwise. Commit "feat(mobile): first-set entrance stagger and match count-up".
- [ ] **M3**: ResultsScreen `savedGameIds` Set state updated where the save flow confirms (read the SaveModal handler; add the id on success), passes `isSaved`; GameCard Save button renders filled bookmark + "Saved" with spring pop + label crossfade on transition; swap motion: GameCard animates out (translateX(-24), 2deg, fade, 180ms) while `isSwapping`, and settles in (translateY(12)+fade 240ms) when `game.game_id` changes without `animateEntrance`. Tests: isSaved renders "Saved"; game_id change rerender safe. Commit "feat(mobile): save confirmation and swap motion".
- [ ] **M4**: full suites (api pytest, mobile jest, tsc) green; final integration review; merge via PR.
