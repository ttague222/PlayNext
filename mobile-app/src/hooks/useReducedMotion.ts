/**
 * useReducedMotion
 *
 * Reads the OS "reduce motion" accessibility setting and keeps it in sync
 * as the user toggles it while the app is running. Motion primitives
 * (FadeSlideIn, ShimmerBlock, GameCard, MatchPill) read this to swap
 * transform-based animation for simple opacity fades, or to stop looping
 * animations entirely.
 *
 * C2: the OS read and the change subscription are shared at module scope
 * instead of once per hook instance. With several cards (and their
 * FadeSlideIn/MatchPill children) mounting at once, one AccessibilityInfo
 * read/subscription is enough — every hook instance just subscribes to the
 * cached value. This also means every instance mounted before the initial
 * async read resolves sees the SAME resolved value at (almost) the same
 * time, rather than each instance racing its own promise.
 *
 * Defaults to false until the initial async read resolves, so the first
 * render assumes motion is allowed (matches platform default).
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

let cached: boolean | null = null;
const listeners = new Set<(v: boolean) => void>();

// Module-level side effects at import are acceptable here (see plan) — this
// runs once per JS bundle load, not once per hook instance.
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    cached = v;
    listeners.forEach((l) => l(v));
  })
  // Guard for test/host environments where the native module isn't
  // available and the promise rejects instead of resolving — the cache
  // just stays null and every instance keeps its `false` default.
  .catch(() => {});

AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => {
  cached = v;
  listeners.forEach((l) => l(v));
});

export default function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() => cached ?? false);

  useEffect(() => {
    // The cache may have resolved between this instance's useState
    // initializer and this effect running (e.g. a card mounted while the
    // initial read was already in flight) — pick up the latest value.
    if (cached !== null && cached !== reducedMotion) {
      setReducedMotion(cached);
    }

    listeners.add(setReducedMotion);
    return () => {
      listeners.delete(setReducedMotion);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return reducedMotion;
}
