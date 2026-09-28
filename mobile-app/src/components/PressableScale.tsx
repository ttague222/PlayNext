/**
 * PressableScale — shared press feedback (game card refresh P0.6).
 * Scales to 0.97 over 120ms on press-in, springs back on release.
 */
import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

const PressableScale = ({ style, children, disabled, onPressIn, onPressOut, ...rest }: Props) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e: any) => {
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 120,
      useNativeDriver: true,
    }).start();
    onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    Animated.spring(scale, {
      toValue: 1,
      stiffness: 300,
      damping: 20,
      mass: 1,
      useNativeDriver: true,
    }).start();
    onPressOut?.(e);
  };

  return (
    <Pressable
      disabled={disabled}
      onPressIn={disabled ? undefined : handlePressIn}
      onPressOut={disabled ? undefined : handlePressOut}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
};

export default PressableScale;
