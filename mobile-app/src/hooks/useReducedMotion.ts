/**
 * useReducedMotion
 *
 * Reads the OS "reduce motion" accessibility setting and keeps it in sync
 * as the user toggles it while the app is running. Motion primitives
 * (FadeSlideIn, ShimmerBlock) read this to swap transform-based animation
 * for simple opacity fades, or to stop looping animations entirely.
 *
 * Defaults to false until the initial async read resolves, so the first
 * render assumes motion is allowed (matches platform default).
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export default function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isMounted) {
        setReducedMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled: boolean) => {
        setReducedMotion(enabled);
      }
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}
