/**
 * ShimmerBlock
 *
 * Loading placeholder: a surface-colored block with a soft highlight band
 * that sweeps left-to-right on a loop. Size and corner radius come entirely
 * from the caller's `style` — this component only owns the surface fill,
 * the band, and its motion.
 *
 * The sweep uses a fixed translateX range (-400..400) rather than measuring
 * the block via onLayout, so it works immediately regardless of the
 * caller's size; `overflow: hidden` on the block clips it to bounds.
 *
 * Reduced motion: renders the static surface with no moving band.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import useReducedMotion from '../hooks/useReducedMotion';

type Props = {
  style?: StyleProp<ViewStyle>;
};

const SWEEP_START = -400;
const SWEEP_END = 400;
const SWEEP_DURATION = 1400;

const ShimmerBlock = ({ style }: Props) => {
  const reducedMotion = useReducedMotion();
  const translateX = useRef(new Animated.Value(SWEEP_START)).current;

  useEffect(() => {
    if (reducedMotion) {
      // Static surface — no moving band under reduced motion.
      return undefined;
    }

    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: SWEEP_END,
        duration: SWEEP_DURATION,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [reducedMotion, translateX]);

  return (
    <Animated.View style={[styles.block, style]}>
      {!reducedMotion && (
        <Animated.View
          style={[styles.band, { transform: [{ translateX }, { rotate: '8deg' }] }]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.05)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#222242',
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: '35%',
  },
});

export default ShimmerBlock;
