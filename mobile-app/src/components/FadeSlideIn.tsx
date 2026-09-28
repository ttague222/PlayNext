/**
 * FadeSlideIn
 *
 * Mount-only entrance animation: fades in while sliding up slightly.
 * Used to stagger card segments (hero / title block / why-section) on the
 * first result set. Animates exactly once per mount — re-renders (new
 * props, parent state changes) never restart it.
 *
 * Reduced motion: swaps the slide+fade for an opacity-only fade at a
 * shorter duration, per platform accessibility guidance.
 *
 * `enabled={false}`: renders children statically at their resting state
 * (opacity 1, no offset) with no animation and no flash of the pre-animation
 * state.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import useReducedMotion from '../hooks/useReducedMotion';

type Props = {
  children: React.ReactNode;
  delay?: number;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const ENTRANCE_EASING = Easing.bezier(0.23, 1, 0.32, 1);
const ENTRANCE_DURATION = 220;
const REDUCED_MOTION_DURATION = 150;
const START_TRANSLATE_Y = 8;

const FadeSlideIn = ({ children, delay = 0, enabled = true, style }: Props) => {
  const reducedMotion = useReducedMotion();

  // Read once, at mount — these decide both the starting Animated.Value and
  // the animation the mount-only effect below runs. Since useRef's
  // initializer and this component's first render happen together, they
  // always agree on enabled/reducedMotion, even though reducedMotion may
  // still change (once) shortly after mount when the async accessibility
  // read resolves.
  const opacity = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  const translateY = useRef(
    new Animated.Value(enabled && !reducedMotion ? START_TRANSLATE_Y : 0)
  ).current;

  useEffect(() => {
    if (!enabled) {
      // Static: values already start at their final resting state above.
      return;
    }

    if (reducedMotion) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: REDUCED_MOTION_DURATION,
        delay,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTRANCE_DURATION,
        delay,
        easing: ENTRANCE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: ENTRANCE_DURATION,
        delay,
        easing: ENTRANCE_EASING,
        useNativeDriver: true,
      }),
    ]).start();
    // Mount-only by design (see module doc) — intentionally not re-running
    // when enabled/delay/reducedMotion change after the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

export default FadeSlideIn;
