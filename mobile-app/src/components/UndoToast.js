/**
 * PlayNxt Undo Toast
 *
 * Bottom snackbar shown after a "Not for me" rejection. Rejection is
 * permanent and server-enforced, so a misclick needs a recovery path.
 * Auto-dismisses after DISMISS_MS.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';

const DISMISS_MS = 6000;

const UndoToast = ({ visible, message, onUndo, onDismiss }) => {
  const slideAnim = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    if (!visible) return undefined;

    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
    }).start();

    const timer = setTimeout(onDismiss, DISMISS_MS);
    return () => {
      clearTimeout(timer);
      slideAnim.setValue(80);
    };
  }, [visible, slideAnim, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
      pointerEvents="box-none"
    >
      <View style={styles.toast}>
        <Text style={styles.message} numberOfLines={1}>
          {message}
        </Text>
        <TouchableOpacity
          onPress={onUndo}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.undoText}>UNDO</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#26263a',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    gap: 12,
  },
  message: {
    flex: 1,
    fontSize: 14,
    color: '#e0e0e0',
  },
  undoText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f857a6',
    letterSpacing: 0.5,
  },
});

export default UndoToast;
