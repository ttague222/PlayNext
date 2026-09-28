/**
 * MatchPill
 *
 * The "NN% match" pill shown in each GameCard's title row.
 *
 * I3/M5: previously the count-up ticked GameCard's own state, so every tick
 * re-rendered the whole card. Isolating the pill into its own component
 * means a tick's setState only re-renders this small Text, not the card's
 * full tree. The count-up is also now delayed to match when the header
 * segment that contains this pill actually becomes visible (its FadeSlideIn
 * fade), instead of starting at t=0 while still hidden behind that fade.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

const MATCH_COUNT_UP_DURATION = 500;
// Matches the header/CTA FadeSlideIn segment's delay in GameCard
// (entranceIndex * 120 + 50) so the number starts ticking right as the
// pill becomes visible, not before.
const MATCH_COUNT_UP_INDEX_DELAY_STEP = 120;
const MATCH_COUNT_UP_DELAY_OFFSET = 50;

type Props = {
  matchPercent: number;
  /** Animate a count-up from 0 on mount. Read once, at mount, into a ref —
   * a later change to this prop must not restart or stop an animation
   * already in flight (there isn't one in practice; GameCard derives it
   * from mount-time state, same as FadeSlideIn's own `enabled`). */
  countUp: boolean;
  entranceIndex?: number;
};

const MatchPill = ({ matchPercent, countUp, entranceIndex = 0 }: Props) => {
  const countUpRef = useRef(countUp);

  const matchCountAnim = useRef(
    new Animated.Value(countUpRef.current ? 0 : matchPercent)
  ).current;
  const [displayedMatchPercent, setDisplayedMatchPercent] = useState(
    countUpRef.current ? 0 : matchPercent
  );

  useEffect(() => {
    if (!countUpRef.current) {
      return undefined;
    }

    const listenerId = matchCountAnim.addListener(({ value }) => {
      setDisplayedMatchPercent(Math.round(value));
    });

    const animation = Animated.timing(matchCountAnim, {
      toValue: matchPercent,
      duration: MATCH_COUNT_UP_DURATION,
      delay: entranceIndex * MATCH_COUNT_UP_INDEX_DELAY_STEP + MATCH_COUNT_UP_DELAY_OFFSET,
      useNativeDriver: false,
    });
    animation.start();

    return () => {
      // Stop the JS-driven timing loop, not just the listener — otherwise
      // it keeps ticking (and calling setState) after unmount.
      animation.stop();
      matchCountAnim.removeListener(listenerId);
    };
    // Mount-only: the count-up runs once per card instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.matchPill} testID="match-pill">
      <Text style={styles.matchPillText}>
        {countUpRef.current ? displayedMatchPercent : matchPercent}% match
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.35)',
    flexShrink: 0,
  },
  matchPillText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default MatchPill;
