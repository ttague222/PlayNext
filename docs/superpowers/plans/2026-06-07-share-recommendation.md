# Share Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Share" button to the CelebrationModal so users can share their accepted game pick via a pre-filled native share sheet.

**Architecture:** Pure mobile change — a new pure utility builds the share message, and the CelebrationModal gets a third button that calls `Share.share()` from React Native. No backend changes needed.

**Tech Stack:** React Native `Share` API (built-in), Expo, React Native StyleSheet.

---

### Task 1: Share message utility

**Files:**
- Create: `mobile-app/src/utils/shareGame.js`
- Create: `mobile-app/src/utils/__tests__/shareGame.test.js`

App Store ID: `6757089064` (from `eas.json`)
Android package: `com.playnxt.app` (from `app.config.js`)

- [ ] **Step 1: Write the failing tests**

Create `mobile-app/src/utils/__tests__/shareGame.test.js`:

```js
import { buildShareMessage } from '../shareGame';

describe('buildShareMessage', () => {
  it('includes the game title', () => {
    const { message } = buildShareMessage({ title: 'Hades' });
    expect(message).toContain('Hades');
  });

  it('includes the iOS App Store link', () => {
    const { message } = buildShareMessage({ title: 'Hades' });
    expect(message).toContain('6757089064');
  });

  it('includes the Android Play Store link', () => {
    const { message } = buildShareMessage({ title: 'Hades' });
    expect(message).toContain('com.playnxt.app');
  });

  it('sets the share title to the game name', () => {
    const { title } = buildShareMessage({ title: 'Vampire Survivors' });
    expect(title).toContain('Vampire Survivors');
  });

  it('handles a game with no title gracefully', () => {
    const { message } = buildShareMessage({});
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
cd mobile-app && npx jest --testPathPattern=shareGame --no-coverage
```

Expected: FAIL — `Cannot find module '../shareGame'`

- [ ] **Step 3: Implement the utility**

Create `mobile-app/src/utils/shareGame.js`:

```js
const IOS_URL = 'https://apps.apple.com/app/id6757089064';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.playnxt.app';

/**
 * Build the share sheet content for an accepted game recommendation.
 * Returns { title, message } for use with React Native's Share.share().
 */
export function buildShareMessage(game) {
  const gameTitle = game?.title || 'a game';
  return {
    title: `Playing ${gameTitle} tonight`,
    message: `Playing ${gameTitle} tonight 🎮\n\nFound it with PlayNxt — the app that recommends games based on your mood and time.\n\niOS: ${IOS_URL}\nAndroid: ${ANDROID_URL}`,
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
cd mobile-app && npx jest --testPathPattern=shareGame --no-coverage
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/utils/shareGame.js mobile-app/src/utils/__tests__/shareGame.test.js
git commit -m "feat: add buildShareMessage utility for game sharing"
```

---

### Task 2: Share button in CelebrationModal

**Files:**
- Modify: `mobile-app/src/components/CelebrationModal.js`

The modal currently has two buttons: "Keep Browsing" (primary) and "I'm all set" (secondary). Add "Share this pick" as a tertiary button between them. The share sheet is native — no modal or navigation needed.

- [ ] **Step 1: Import Share and buildShareMessage at the top of CelebrationModal.js**

In `mobile-app/src/components/CelebrationModal.js`, add to existing imports:

```js
import { View, Text, Pressable, StyleSheet, Modal, Animated, Share } from 'react-native';
import { buildShareMessage } from '../utils/shareGame';
```

(Replace the existing `react-native` import line — just add `Share` to the destructured list.)

- [ ] **Step 2: Add the handleShare function inside CelebrationModal**

Add after `handleKeepBrowsing` (around line 101), before the `if (!game) return null` check:

```js
  const handleShare = async () => {
    if (!game) return;
    try {
      const { title, message } = buildShareMessage(game);
      await Share.share({ title, message });
    } catch {
      // User dismissed or share failed — no-op
    }
  };
```

- [ ] **Step 3: Add the Share button to the JSX**

In the `buttonsContainer` (after the `keepBrowsingButton` Pressable, before the `doneButton` Pressable), add:

```jsx
            {/* Tertiary: Share */}
            <Pressable
              style={({ pressed }) => [
                styles.shareButton,
                isAnimatingOut && styles.buttonDisabled,
                pressed && !isAnimatingOut && styles.buttonPressed,
              ]}
              onPress={handleShare}
            >
              <Text style={styles.shareText}>📤  Share this pick</Text>
            </Pressable>
```

- [ ] **Step 4: Add the share button styles**

In the `StyleSheet.create({...})` object, after the `doneButton` style:

```js
  shareButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareText: {
    fontSize: 15,
    color: '#a0a0b0',
    fontWeight: '500',
  },
```

- [ ] **Step 5: Run all mobile tests to check nothing broke**

```
cd mobile-app && npx jest --no-coverage
```

Expected: All tests pass (100+).

- [ ] **Step 6: Commit**

```bash
git add mobile-app/src/components/CelebrationModal.js
git commit -m "feat: add share button to CelebrationModal"
```
