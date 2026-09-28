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
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 120,
      useNativeDriver: true,
    }).start();
    setPressed(true);
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    Animated.spring(scale, {
      toValue: 1,
      stiffness: 300,
      damping: 20,
      mass: 1,
      useNativeDriver: true,
    }).start();
    setPressed(false);
    onPressOut?.(e);
  };

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      onPressIn={disabled ? undefined : handlePressIn}
      onPressOut={disabled ? undefined : handlePressOut}
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
