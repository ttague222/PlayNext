# Daily Reroll Cap with Premium Upsell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hard daily reroll cap (10/day for free users) that — when hit — shows a premium-only upsell modal instead of another ad option. Includes a visible countdown so users see the cap coming.

**Architecture:** Pure mobile change. `AdContext` already tracks `dailyRerollCount` and resets it each day. We add a new pure utility (`rerollCap.js`) for the cap logic, a new `DailyCapUpsellModal` component, and wire them into `AdContext` + `ResultsScreen`. The existing ad gate (every N rerolls, watch an ad) still fires for rerolls 1-9; at reroll 10, the hard cap modal fires instead.

**Tech Stack:** React Native, AsyncStorage (already wired in AdContext), RevenueCat/PremiumContext (already wired in ResultsScreen).

---

### Task 1: Pure reroll cap utility

**Files:**
- Create: `mobile-app/src/utils/rerollCap.js`
- Create: `mobile-app/src/utils/__tests__/rerollCap.test.js`

- [ ] **Step 1: Write the failing tests**

Create `mobile-app/src/utils/__tests__/rerollCap.test.js`:

```js
import { DAILY_REROLL_CAP, hasHitDailyRerollCap, rerollsRemainingToday } from '../rerollCap';

describe('hasHitDailyRerollCap', () => {
  it('returns false when under the cap', () => {
    expect(hasHitDailyRerollCap(0)).toBe(false);
    expect(hasHitDailyRerollCap(DAILY_REROLL_CAP - 1)).toBe(false);
  });

  it('returns true at exactly the cap', () => {
    expect(hasHitDailyRerollCap(DAILY_REROLL_CAP)).toBe(true);
  });

  it('returns true when over the cap', () => {
    expect(hasHitDailyRerollCap(DAILY_REROLL_CAP + 5)).toBe(true);
  });
});

describe('rerollsRemainingToday', () => {
  it('returns full cap when none used', () => {
    expect(rerollsRemainingToday(0)).toBe(DAILY_REROLL_CAP);
  });

  it('counts down correctly', () => {
    expect(rerollsRemainingToday(3)).toBe(DAILY_REROLL_CAP - 3);
  });

  it('never returns negative', () => {
    expect(rerollsRemainingToday(DAILY_REROLL_CAP + 10)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
cd mobile-app && npx jest --testPathPattern=rerollCap --no-coverage
```

Expected: FAIL — `Cannot find module '../rerollCap'`

- [ ] **Step 3: Implement the utility**

Create `mobile-app/src/utils/rerollCap.js`:

```js
export const DAILY_REROLL_CAP = 10;

/** True when the user has used all their daily rerolls. */
export function hasHitDailyRerollCap(dailyRerollCount) {
  return dailyRerollCount >= DAILY_REROLL_CAP;
}

/** How many rerolls are left today (never negative). */
export function rerollsRemainingToday(dailyRerollCount) {
  return Math.max(0, DAILY_REROLL_CAP - dailyRerollCount);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
cd mobile-app && npx jest --testPathPattern=rerollCap --no-coverage
```

Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/utils/rerollCap.js mobile-app/src/utils/__tests__/rerollCap.test.js
git commit -m "feat: add daily reroll cap pure utility"
```

---

### Task 2: DailyCapUpsellModal component

**Files:**
- Create: `mobile-app/src/components/DailyCapUpsellModal.js`

This modal fires only when the hard daily cap is hit. Unlike `AdOrPremiumModal`, there is no ad option — premium is the only way to keep rerolling today.

- [ ] **Step 1: Create the component**

Create `mobile-app/src/components/DailyCapUpsellModal.js`:

```js
import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Shown when a free user hits their daily reroll cap (10/day).
 * Props:
 *   visible: bool
 *   onGoPremium: () => void  — navigate to PremiumScreen
 *   onDismiss: () => void    — close modal, no reroll
 */
const DailyCapUpsellModal = ({ visible, onGoPremium, onDismiss }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🎮</Text>
          <Text style={styles.title}>You're on a roll!</Text>
          <Text style={styles.body}>
            You've used all 10 of today's rerolls. Unlock unlimited rerolls forever for a one-time $2.99 — or check back tomorrow.
          </Text>

          <Pressable style={styles.premiumButton} onPress={onGoPremium}>
            <LinearGradient
              colors={['#f857a6', '#ff5858']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.premiumGradient}
            >
              <Text style={styles.premiumText}>Unlock Unlimited — $2.99</Text>
            </LinearGradient>
          </Pressable>

          <Pressable style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissText}>Check back tomorrow</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: 'rgba(248, 87, 166, 0.3)',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: '#a0a0b0',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  premiumButton: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#f857a6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  premiumGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  premiumText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  dismissButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 14,
    color: '#606070',
  },
});

export default DailyCapUpsellModal;
```

- [ ] **Step 2: Run all tests to confirm nothing broke**

```
cd mobile-app && npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add mobile-app/src/components/DailyCapUpsellModal.js
git commit -m "feat: add DailyCapUpsellModal for hard reroll cap"
```

---

### Task 3: Expose cap functions from AdContext

**Files:**
- Modify: `mobile-app/src/context/AdContext.js`

`AdContext` already tracks `dailyRerollCount`. Add two derived functions that components can call.

- [ ] **Step 1: Import the cap utility at the top of AdContext.js**

In `mobile-app/src/context/AdContext.js`, add after the existing imports:

```js
import { hasHitDailyRerollCap, rerollsRemainingToday } from '../utils/rerollCap';
```

- [ ] **Step 2: Expose the functions in the context value**

Find the `return` statement inside `AdProvider` that returns the `AdContext.Provider`. Add two new values to the object passed to `value`:

```js
isDailyCapHit: hasHitDailyRerollCap(dailyRerollCount),
rerollsRemainingToday: rerollsRemainingToday(dailyRerollCount),
```

(Search for the existing `value={{` block in AdContext.js — it already spreads ad state like `isAdLoading`, `adsEnabled`, etc. Add these two to that same object.)

- [ ] **Step 3: Run all tests to confirm nothing broke**

```
cd mobile-app && npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add mobile-app/src/context/AdContext.js
git commit -m "feat: expose isDailyCapHit and rerollsRemainingToday from AdContext"
```

---

### Task 4: Wire cap into ResultsScreen

**Files:**
- Modify: `mobile-app/src/screens/ResultsScreen.js`

`ResultsScreen` already handles the ad gate. This task:
1. Checks `isDailyCapHit` **before** the ad gate check in `handleReroll`
2. Shows `DailyCapUpsellModal` when the cap is hit
3. Updates the rerolls-remaining counter to show today's total remaining (not just until-next-ad)

- [ ] **Step 1: Add new imports to ResultsScreen.js**

Add to the existing import block at the top of `mobile-app/src/screens/ResultsScreen.js`:

```js
import DailyCapUpsellModal from '../components/DailyCapUpsellModal';
```

- [ ] **Step 2: Destructure new AdContext values**

In `ResultsScreen`, the existing `usePremium()` destructuring already pulls `shouldShowAdBeforeReroll`, `recordReroll`, etc. Add two more values from `usePremium()` (which re-exports from AdContext):

```js
const {
  recordReroll,
  isPremium,
  isAdLoading,
  isRewardedAdsEnabled,
  shouldShowAdBeforeReroll,
  showRewardedAd,
  getRerollsUntilAd,
  shouldShowPremiumPrompt,
  AD_INTERVAL,
  isDailyCapHit,          // ADD THIS
  rerollsRemainingToday,  // ADD THIS
} = usePremium();
```

Note: `PremiumContext` re-exports `useAds()` values for backward compatibility — verify `isDailyCapHit` and `rerollsRemainingToday` are passed through in `PremiumContext.js`. If they aren't yet, add them to the spread in `PremiumProvider`'s context value:

In `mobile-app/src/context/PremiumContext.js`, find where ad values are re-exported (the `...ads` spread or individual re-exports) and confirm the new values flow through. If using a spread (`...ads`), they'll be included automatically.

- [ ] **Step 3: Add showDailyCapModal state**

In the `ResultsScreen` component, after the existing `useState` declarations, add:

```js
const [showDailyCapModal, setShowDailyCapModal] = useState(false);
```

- [ ] **Step 4: Update handleReroll to check the daily cap first**

Replace the existing `handleReroll` function:

```js
  const handleReroll = async () => {
    // Hard daily cap check — shown before the ad gate
    if (!isPremium && isDailyCapHit) {
      setShowDailyCapModal(true);
      return;
    }

    // Existing ad gate check
    if (shouldShowAdBeforeReroll()) {
      setShowAdOrPremiumModal(true);
      setPendingRerollAction(() => performReroll);
      return;
    }

    await performReroll();
  };
```

- [ ] **Step 5: Update the rerolls-remaining counter display**

Find the existing `rerollsRemaining` text in the reroll button JSX (it currently says "X free rerolls left" using `getRerollsUntilAd()`). Replace that condition block with one that shows today's total remaining:

```jsx
                {!isPremium && !isRerolling && !isAdLoading && (
                  <Text style={styles.rerollsRemaining}>
                    {isDailyCapHit
                      ? 'No rerolls left today'
                      : `${rerollsRemainingToday} reroll${rerollsRemainingToday !== 1 ? 's' : ''} left today`}
                  </Text>
                )}
                {isPremium && !isRerolling && (
                  <Text style={styles.rerollsRemaining}>Unlimited rerolls</Text>
                )}
```

(This replaces the existing `!isPremium && !isRerolling && !isAdLoading && isRewardedAdsEnabled` block and the `isPremium` block below it.)

- [ ] **Step 6: Add DailyCapUpsellModal to the JSX**

At the bottom of the return JSX, after the existing `<AdOrPremiumModal ... />`, add:

```jsx
        {/* Daily reroll cap upsell */}
        <DailyCapUpsellModal
          visible={showDailyCapModal}
          onGoPremium={() => {
            setShowDailyCapModal(false);
            navigation.navigate('Premium');
          }}
          onDismiss={() => setShowDailyCapModal(false)}
        />
```

- [ ] **Step 7: Run all tests**

```
cd mobile-app && npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add mobile-app/src/screens/ResultsScreen.js
git commit -m "feat: hard daily reroll cap with premium upsell modal"
```
