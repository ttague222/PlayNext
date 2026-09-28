/**
 * PressableScale — shared press feedback (game card refresh P0.6).
 * Scales to 0.97 over 120ms on press-in, springs back on release.
 */
import React, { useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  darkenOnPress?: boolean;
  pressedOverlayStyle?: StyleProp<ViewStyle>;
};

const PressableScale = ({
  style,
  children,
  disabled,
  onPressIn,
  onPressOut,
  accessibilityRole = 'button',
  darkenOnPress,
  pressedOverlayStyle,
  ...rest
}: Props) => {
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);

  const handlePressIn = (e: GestureResponderEvent) => {
    // If `disabled` flips true while a finger is already down, the
    // Pressable still fires onPressIn for the in-flight touch. Bail out
    // before animating or setting pressed state, and don't chain to the
    // caller — a disabled control shouldn't invoke press callbacks.
    if (disabled) {
      return;
    }
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 120,
      useNativeDriver: true,
    }).start();
    setPressed(true);
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    // Always spring back and clear pressed state, even when disabled —
    // otherwise a press that started while enabled and ended after
    // `disabled` flipped true strands the scale/overlay. Only the caller
    // chain is gated on `disabled`, preserving existing semantics there.
    Animated.spring(scale, {
      toValue: 1,
      stiffness: 300,
      damping: 20,
      mass: 1,
      useNativeDriver: true,
    }).start();
    setPressed(false);
    if (!disabled) {
      onPressOut?.(e);
    }
  };

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
        {darkenOnPress && pressed && (
          <View
            pointerEvents="none"
            testID="pressed-overlay"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0,0,0,0.08)' },
              pressedOverlayStyle,
            ]}
          />
        )}
      </Animated.View>
    </Pressable>
  );
};

export default PressableScale;
