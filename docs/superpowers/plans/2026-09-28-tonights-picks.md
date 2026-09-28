# Tonight's Picks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Tonight's Picks (spec: `docs/superpowers/specs/2026-09-28-tonights-picks-design.md`): a day-stable set of 3 picks from the user's last-used context, surfaced as a card on the Play tab, with an opt-in local evening reminder. Mobile-only, zero backend changes.

**Architecture:** A new pure-logic `tonightService` owns persistence (last context, day-scoped cache, reminder meta) and the single daily fetch through the existing `/recommend` API. `RecommendationContext` gains context persistence on successful fetches and a `startTonightSession` entry that seeds a Results session from the cache without a network call. UI is one new card on `PlayScreen`, one Alert-based soft prompt, and one Profile settings row. The reminder is a locally scheduled `expo-notifications` daily trigger deep-linking `'tonight'`.

**Tech Stack:** React Native + Expo (SDK 54), AsyncStorage, expo-notifications (already installed), Jest + jest-expo + @testing-library/react-native.

**Two sanctioned deviations from the spec (both generalizations, decided at planning):**
1. *Every* completed normal-flow session rewrites today's cache (spec named only the "Change" path; the hero CTA runs the identical flow and is indistinguishable, and "card reflects your latest real session" is more coherent).
2. The Profile reminder time control is five preset chips (6pm–10pm) instead of a free time picker: avoids adding the `@react-native-community/datetimepicker` native dependency for no real UX gain.

**Conventions that bind every task:**
- The global AsyncStorage mock in `jest.setup.js` is *stateless* (always resolves null). Any test needing storage round-trips defines the per-file stateful mock shown in Task 1 — this is the established house pattern.
- Screens use arrow-function consts, `useNavigation()`, styles at file bottom, all API access through services.
- Commit after every green test run. Run tests from `mobile-app/`: `npx jest <path> -v` (PowerShell-safe).

---

## File Structure

| File | Responsibility |
|---|---|
| Create `mobile-app/src/services/tonightService.js` | All Tonight's Picks logic + storage + reminder scheduling. No React imports. |
| Create `mobile-app/src/services/__tests__/tonightService.test.js` | Unit tests for the above |
| Create `mobile-app/src/utils/tonightReminderPrompt.js` | One-time Alert soft prompt (mirrors `pushPrompt.js`) |
| Create `mobile-app/src/utils/__tests__/tonightReminderPrompt.test.js` | Unit tests |
| Create `mobile-app/src/components/TonightCard.js` | Presentation-only card (loading/ready/error states) |
| Create `mobile-app/src/components/__tests__/TonightCard.test.js` | Render tests |
| Modify `mobile-app/src/context/RecommendationContext.js` | Persist context + cache on success; `sessionSource`; `startTonightSession` |
| Create `mobile-app/src/context/__tests__/RecommendationContext.tonight.test.js` | Context tests |
| Modify `mobile-app/src/screens/PlayScreen.js` | Render card, prefetch on focus, press/change/deep-link handling |
| Modify `mobile-app/src/screens/ProfileScreen.js` | Reminder row (toggle + preset time chips) |
| Modify `mobile-app/App.js` | `'tonight'` deep-link case |
| Modify `mobile-app/jest.setup.js` | Global expo-notifications mock |
| Modify `mobile-app/src/config/changelog.js` | 1.5.0 changelog entry |
| Modify `docs/PRD.md` | §4 entry path, §12 local reminder, §14 events |

---

### Task 1: tonightService — date helper + last-context persistence

**Files:**
- Create: `mobile-app/src/services/tonightService.js`
- Create: `mobile-app/src/services/__tests__/tonightService.test.js`

- [ ] **Step 1: Write the failing tests**

Create `mobile-app/src/services/__tests__/tonightService.test.js`:

```javascript
/**
 * tonightService unit tests.
 * Uses a per-file STATEFUL AsyncStorage mock (the global jest.setup stub is
 * stateless by design) — declared before importing the service.
 */
const store = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((k, v) => { store[k] = v; return Promise.resolve(); }),
  getItem: jest.fn((k) => Promise.resolve(store[k] ?? null)),
  removeItem: jest.fn((k) => { delete store[k]; return Promise.resolve(); }),
}));
jest.mock('../api', () => ({
  __esModule: true,
  default: { getRecommendations: jest.fn() },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import {
  localDateString,
  saveLastContext,
  getLastContext,
  LAST_CONTEXT_KEY,
} from '../tonightService';

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  jest.clearAllMocks();
});

describe('localDateString', () => {
  it('formats a date as local YYYY-MM-DD', () => {
    expect(localDateString(new Date(2026, 9, 5))).toBe('2026-10-05'); // month is 0-based
  });
});

describe('last context persistence', () => {
  const prefs = {
    timeAvailable: 60,
    energyMood: 'wind_down',
    genres: ['roguelike'],
    platforms: ['pc'],
    sessionType: 'solo',
    discoveryMode: 'familiar',
    favorHistory: true, // premium field: must NOT be persisted
  };

  it('round-trips the context subset', async () => {
    expect(await saveLastContext(prefs)).toBe(true);
    const loaded = await getLastContext();
    expect(loaded).toEqual({
      timeAvailable: 60,
      energyMood: 'wind_down',
      genres: ['roguelike'],
      platforms: ['pc'],
      sessionType: 'solo',
      discoveryMode: 'familiar',
    });
  });

  it('refuses to save without required inputs', async () => {
    expect(await saveLastContext({ timeAvailable: 60 })).toBe(false);
    expect(await saveLastContext({ energyMood: 'casual' })).toBe(false);
    expect(store[LAST_CONTEXT_KEY]).toBeUndefined();
  });

  it('returns null when nothing stored or JSON is corrupt', async () => {
    expect(await getLastContext()).toBeNull();
    store[LAST_CONTEXT_KEY] = '{not json';
    expect(await getLastContext()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/services/__tests__/tonightService.test.js -v`
Expected: FAIL — cannot find module `../tonightService`.

- [ ] **Step 3: Write the implementation**

Create `mobile-app/src/services/tonightService.js`:

```javascript
/**
 * Tonight's Picks — daily ritual service.
 *
 * Owns the persisted last-used recommendation context, the day-scoped picks
 * cache, view tracking for the reminder soft prompt, and the local daily
 * reminder. Pure logic + storage: no React imports.
 *
 * Spec: docs/superpowers/specs/2026-09-28-tonights-picks-design.md
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

export const LAST_CONTEXT_KEY = '@playnxt_last_context';
export const TONIGHT_PICKS_KEY = '@playnxt_tonights_picks';
export const TONIGHT_META_KEY = '@playnxt_tonight_meta';

/** Local-timezone calendar date, e.g. '2026-10-05'. The cache day boundary. */
export function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Persist the subset of preferences Tonight's Picks reuses. Premium filters
 * are deliberately excluded (session-scoped, entitlement-dependent).
 * Returns false (and writes nothing) unless time + mood are both set.
 */
export async function saveLastContext(preferences) {
  if (!preferences?.timeAvailable || !preferences?.energyMood) return false;
  const context = {
    timeAvailable: preferences.timeAvailable,
    energyMood: preferences.energyMood,
    genres: preferences.genres || [],
    platforms: preferences.platforms || [],
    sessionType: preferences.sessionType || 'any',
    discoveryMode: preferences.discoveryMode || 'familiar',
  };
  try {
    await AsyncStorage.setItem(LAST_CONTEXT_KEY, JSON.stringify(context));
    return true;
  } catch {
    return false;
  }
}

export async function getLastContext() {
  try {
    const raw = await AsyncStorage.getItem(LAST_CONTEXT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/services/__tests__/tonightService.test.js -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/services/tonightService.js mobile-app/src/services/__tests__/tonightService.test.js
git commit -m "feat: tonight service context persistence"
```

---

### Task 2: tonightService — day-scoped picks cache

**Files:**
- Modify: `mobile-app/src/services/tonightService.js`
- Modify: `mobile-app/src/services/__tests__/tonightService.test.js`

- [ ] **Step 1: Write the failing tests** (append to the test file; extend the import list with `saveTonightCache, getCachedPicks, TONIGHT_PICKS_KEY`)

```javascript
describe('tonight cache', () => {
  const context = { timeAvailable: 60, energyMood: 'casual', genres: [], platforms: [], sessionType: 'any', discoveryMode: 'familiar' };
  const games = [{ game_id: 'hades', title: 'Hades' }];

  it('stores todays cache and returns it', async () => {
    await saveTonightCache({ context, sessionId: 's1', games });
    const cached = await getCachedPicks();
    expect(cached.date).toBe(localDateString());
    expect(cached.sessionId).toBe('s1');
    expect(cached.games).toEqual(games);
    expect(cached.context).toEqual(context);
  });

  it('returns null for a stale (yesterday) cache', async () => {
    store[TONIGHT_PICKS_KEY] = JSON.stringify({ date: '2020-01-01', context, sessionId: 's1', games });
    expect(await getCachedPicks()).toBeNull();
  });

  it('returns null for empty games or corrupt JSON', async () => {
    store[TONIGHT_PICKS_KEY] = JSON.stringify({ date: localDateString(), context, sessionId: 's1', games: [] });
    expect(await getCachedPicks()).toBeNull();
    store[TONIGHT_PICKS_KEY] = '{broken';
    expect(await getCachedPicks()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx jest src/services/__tests__/tonightService.test.js -v`
Expected: FAIL — `saveTonightCache` is not a function.

- [ ] **Step 3: Implement** (append to `tonightService.js`)

```javascript
/** Write today's cache. Callers pass the context + response they already have. */
export async function saveTonightCache({ context, sessionId, games }) {
  try {
    const cache = { date: localDateString(), context, sessionId, games };
    await AsyncStorage.setItem(TONIGHT_PICKS_KEY, JSON.stringify(cache));
    return cache;
  } catch {
    return null;
  }
}

/** Today's cache, or null when missing, stale, empty, or unreadable. */
export async function getCachedPicks() {
  try {
    const raw = await AsyncStorage.getItem(TONIGHT_PICKS_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (cache?.date !== localDateString()) return null;
    if (!Array.isArray(cache.games) || cache.games.length === 0) return null;
    return cache;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/services/__tests__/tonightService.test.js -v`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/services/tonightService.js mobile-app/src/services/__tests__/tonightService.test.js
git commit -m "feat: tonight picks day-scoped cache"
```

---

### Task 3: tonightService — single-flight daily fetch

**Files:**
- Modify: `mobile-app/src/services/tonightService.js`
- Modify: `mobile-app/src/services/__tests__/tonightService.test.js`

- [ ] **Step 1: Write the failing tests** (append; extend imports with `fetchTonightsPicks`)

```javascript
describe('fetchTonightsPicks', () => {
  const context = { timeAvailable: 30, energyMood: 'wind_down', genres: [], platforms: ['pc'], sessionType: 'solo', discoveryMode: 'familiar' };
  const response = { session_id: 'srv-1', recommendations: [{ game_id: 'celeste', title: 'Celeste' }], fallback_applied: false };

  it('returns null without a saved context and never calls the API', async () => {
    expect(await fetchTonightsPicks()).toBeNull();
    expect(api.getRecommendations).not.toHaveBeenCalled();
  });

  it('fetches with the saved context and caches the result', async () => {
    store[LAST_CONTEXT_KEY] = JSON.stringify(context);
    api.getRecommendations.mockResolvedValue(response);

    const result = await fetchTonightsPicks({ excludedGameIds: ['notme'] });

    expect(api.getRecommendations).toHaveBeenCalledWith(expect.objectContaining({
      time_available: 30,
      energy_mood: 'wind_down',
      genres: null,           // empty array collapses to null, matching the normal flow
      platforms: ['pc'],
      session_type: 'solo',
      discovery_mode: 'familiar',
      excluded_game_ids: ['notme'],
    }));
    expect(result.games).toEqual(response.recommendations);
    expect(result.sessionId).toBe('srv-1');
    expect(await getCachedPicks()).toEqual(result); // persisted
  });

  it('returns the existing cache without refetching', async () => {
    store[LAST_CONTEXT_KEY] = JSON.stringify(context);
    await saveTonightCache({ context, sessionId: 'old', games: [{ game_id: 'x', title: 'X' }] });
    const result = await fetchTonightsPicks();
    expect(result.sessionId).toBe('old');
    expect(api.getRecommendations).not.toHaveBeenCalled();
  });

  it('single-flights concurrent calls', async () => {
    store[LAST_CONTEXT_KEY] = JSON.stringify(context);
    let resolve;
    api.getRecommendations.mockReturnValue(new Promise((r) => { resolve = r; }));
    const p1 = fetchTonightsPicks();
    const p2 = fetchTonightsPicks();
    resolve(response);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(api.getRecommendations).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
  });

  it('propagates API failure and clears the in-flight guard', async () => {
    store[LAST_CONTEXT_KEY] = JSON.stringify(context);
    api.getRecommendations.mockRejectedValueOnce(new Error('boom'));
    await expect(fetchTonightsPicks()).rejects.toThrow('boom');
    api.getRecommendations.mockResolvedValueOnce(response);
    const retry = await fetchTonightsPicks(); // guard must not be stuck
    expect(retry.sessionId).toBe('srv-1');
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx jest src/services/__tests__/tonightService.test.js -v`
Expected: FAIL — `fetchTonightsPicks` is not a function.

- [ ] **Step 3: Implement** (append to `tonightService.js`)

```javascript
let _inFlight = null;

/**
 * Return today's picks, fetching and caching them on first call of the day.
 * Concurrent callers share one request. Returns null when no context is
 * saved yet (feature dormant). Throws on API failure — callers show a retry
 * state. `excludedGameIds` lets callers pass Not-For-Me ids (the service has
 * no access to SavedGamesContext).
 */
export async function fetchTonightsPicks({ excludedGameIds = [] } = {}) {
  const cached = await getCachedPicks();
  if (cached) return cached;
  if (_inFlight) return _inFlight;

  _inFlight = (async () => {
    const context = await getLastContext();
    if (!context) return null;
    const response = await api.getRecommendations({
      time_available: context.timeAvailable,
      energy_mood: context.energyMood,
      genres: context.genres?.length ? context.genres : null,
      platforms: context.platforms?.length ? context.platforms : null,
      session_type: context.sessionType,
      discovery_mode: context.discoveryMode,
      session_id: `local-tonight-${Date.now()}`,
      excluded_game_ids: excludedGameIds,
    });
    return saveTonightCache({
      context,
      sessionId: response.session_id,
      games: response.recommendations,
    });
  })();

  try {
    return await _inFlight;
  } finally {
    _inFlight = null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/services/__tests__/tonightService.test.js -v`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/services/tonightService.js mobile-app/src/services/__tests__/tonightService.test.js
git commit -m "feat: single-flight daily tonight picks fetch"
```

---

### Task 4: tonightService — view tracking + reminder-offer logic

**Files:**
- Modify: `mobile-app/src/services/tonightService.js`
- Modify: `mobile-app/src/services/__tests__/tonightService.test.js`

- [ ] **Step 1: Write the failing tests** (append; extend imports with `recordTonightView, shouldOfferReminder, markReminderPromptShown, TONIGHT_META_KEY`)

```javascript
describe('view tracking and reminder offer', () => {
  it('does not offer after a single day of views', async () => {
    await recordTonightView();
    await recordTonightView(); // same day, deduped
    const meta = JSON.parse(store[TONIGHT_META_KEY]);
    expect(meta.viewDates).toHaveLength(1);
    expect(await shouldOfferReminder()).toBe(false);
  });

  it('offers on the second distinct day, once', async () => {
    store[TONIGHT_META_KEY] = JSON.stringify({ viewDates: ['2020-01-01'], promptShown: false, reminderEnabled: false, reminderTime: '20:00' });
    await recordTonightView(); // second distinct day
    expect(await shouldOfferReminder()).toBe(true);
    await markReminderPromptShown();
    expect(await shouldOfferReminder()).toBe(false); // never re-prompt
  });

  it('does not offer when the reminder is already enabled', async () => {
    store[TONIGHT_META_KEY] = JSON.stringify({ viewDates: ['2020-01-01', localDateString()], promptShown: false, reminderEnabled: true, reminderTime: '20:00' });
    expect(await shouldOfferReminder()).toBe(false);
  });

  it('caps stored view dates at 30', async () => {
    const dates = Array.from({ length: 30 }, (_, i) => `2020-01-${String(i + 1).padStart(2, '0')}`);
    store[TONIGHT_META_KEY] = JSON.stringify({ viewDates: dates, promptShown: true, reminderEnabled: false, reminderTime: '20:00' });
    await recordTonightView();
    const meta = JSON.parse(store[TONIGHT_META_KEY]);
    expect(meta.viewDates).toHaveLength(30);
    expect(meta.viewDates[29]).toBe(localDateString());
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx jest src/services/__tests__/tonightService.test.js -v`
Expected: FAIL — `recordTonightView` is not a function.

- [ ] **Step 3: Implement** (append to `tonightService.js`)

```javascript
export const DEFAULT_REMINDER_TIME = '20:00';

const DEFAULT_META = {
  viewDates: [],        // distinct local dates the user viewed tonight picks
  promptShown: false,   // soft prompt is once-ever
  reminderEnabled: false,
  reminderTime: DEFAULT_REMINDER_TIME,
};

async function getMeta() {
  try {
    const raw = await AsyncStorage.getItem(TONIGHT_META_KEY);
    return raw ? { ...DEFAULT_META, ...JSON.parse(raw) } : { ...DEFAULT_META };
  } catch {
    return { ...DEFAULT_META };
  }
}

async function saveMeta(meta) {
  try {
    await AsyncStorage.setItem(TONIGHT_META_KEY, JSON.stringify(meta));
  } catch {
    // Meta is best-effort; losing it only delays the soft prompt.
  }
}

/** Record that the user viewed tonight's picks today (deduped per day). */
export async function recordTonightView() {
  const meta = await getMeta();
  const today = localDateString();
  if (!meta.viewDates.includes(today)) {
    meta.viewDates = [...meta.viewDates, today].slice(-30);
    await saveMeta(meta);
  }
  return meta;
}

/** Soft prompt gate: second distinct viewing day, never shown before, not already enabled. */
export async function shouldOfferReminder() {
  const meta = await getMeta();
  return !meta.promptShown && !meta.reminderEnabled && new Set(meta.viewDates).size >= 2;
}

export async function markReminderPromptShown() {
  const meta = await getMeta();
  await saveMeta({ ...meta, promptShown: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/services/__tests__/tonightService.test.js -v`
Expected: PASS (17 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/services/tonightService.js mobile-app/src/services/__tests__/tonightService.test.js
git commit -m "feat: tonight view tracking and reminder offer gate"
```

---

### Task 5: tonightService — local reminder scheduling (+ global expo-notifications mock)

**Files:**
- Modify: `mobile-app/jest.setup.js`
- Modify: `mobile-app/src/services/tonightService.js`
- Modify: `mobile-app/src/services/__tests__/tonightService.test.js`

- [ ] **Step 1: Add a global expo-notifications mock**

Append to `mobile-app/jest.setup.js` (after the existing expo mocks). This protects every component test that transitively imports `tonightService` or `notificationService`:

```javascript
// Mock expo-notifications (native module, not available in jest)
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'ExponentPushToken[test]' })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('tonight-reminder')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));
```

- [ ] **Step 2: Write the failing tests** (append to `tonightService.test.js`; add at top-of-file imports: `import * as Notifications from 'expo-notifications';` and extend the service import list with `getReminderSettings, setReminder, DEFAULT_REMINDER_TIME, REMINDER_NOTIFICATION_ID`). The per-file AsyncStorage mock stays; expo-notifications comes from the global mock.

```javascript
describe('reminder scheduling', () => {
  it('schedules a daily notification and persists settings', async () => {
    const result = await setReminder(true, '21:00');
    expect(result).toEqual({ enabled: true, time: '21:00' });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: REMINDER_NOTIFICATION_ID,
      content: {
        title: 'PlayNxt',
        body: 'Your picks for tonight are ready.',
        data: { deep_link: 'tonight' },
      },
      trigger: { type: 'daily', hour: 21, minute: 0 },
    });
    expect(await getReminderSettings()).toEqual({ enabled: true, time: '21:00' });
  });

  it('cancels before rescheduling so only one reminder ever exists', async () => {
    await setReminder(true, '20:00');
    await setReminder(true, '22:00');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REMINDER_NOTIFICATION_ID);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('disabling cancels and persists', async () => {
    await setReminder(true, '20:00');
    const result = await setReminder(false);
    expect(result.enabled).toBe(false);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REMINDER_NOTIFICATION_ID);
    expect(await getReminderSettings()).toEqual({ enabled: false, time: '20:00' }); // time remembered
  });

  it('reports permissionDenied without scheduling when OS denies', async () => {
    Notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    Notifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    const result = await setReminder(true, DEFAULT_REMINDER_TIME);
    expect(result).toEqual({ enabled: false, permissionDenied: true });
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(await getReminderSettings()).toEqual(expect.objectContaining({ enabled: false }));
  });
});
```

- [ ] **Step 3: Run tests to verify the new ones fail**

Run: `npx jest src/services/__tests__/tonightService.test.js -v`
Expected: FAIL — `setReminder` is not a function.

- [ ] **Step 4: Implement** (append to `tonightService.js`; add `import * as Notifications from 'expo-notifications';` at the top with the other imports)

```javascript
export const REMINDER_NOTIFICATION_ID = 'tonight-reminder';

export async function getReminderSettings() {
  const meta = await getMeta();
  return { enabled: meta.reminderEnabled, time: meta.reminderTime };
}

/**
 * Enable/disable the local daily reminder. Requests OS permission when
 * needed. Returns { enabled, time } on success, { enabled: false,
 * permissionDenied: true } when the OS blocks it.
 */
export async function setReminder(enabled, time = DEFAULT_REMINDER_TIME) {
  const meta = await getMeta();

  if (!enabled) {
    try {
      await Notifications.cancelScheduledNotificationAsync(REMINDER_NOTIFICATION_ID);
    } catch {
      // Nothing scheduled is fine.
    }
    await saveMeta({ ...meta, reminderEnabled: false });
    return { enabled: false };
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') {
    await saveMeta({ ...meta, reminderEnabled: false });
    return { enabled: false, permissionDenied: true };
  }

  const [hour, minute] = time.split(':').map(Number);
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_NOTIFICATION_ID);
  } catch {
    // First schedule: nothing to cancel.
  }
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_NOTIFICATION_ID,
    content: {
      title: 'PlayNxt',
      body: 'Your picks for tonight are ready.',
      data: { deep_link: 'tonight' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
  await saveMeta({ ...meta, reminderEnabled: true, reminderTime: time });
  return { enabled: true, time };
}
```

- [ ] **Step 5: Run the whole service test file, then the full suite (setup file changed)**

Run: `npx jest src/services/__tests__/tonightService.test.js -v` → PASS (21 tests).
Run: `npx jest` → all suites PASS (the new global mock must not break existing tests).

- [ ] **Step 6: Commit**

```bash
git add mobile-app/jest.setup.js mobile-app/src/services/tonightService.js mobile-app/src/services/__tests__/tonightService.test.js
git commit -m "feat: local daily tonight reminder scheduling"
```

---

### Task 6: RecommendationContext — persist context/cache on success, sessionSource, startTonightSession

**Files:**
- Modify: `mobile-app/src/context/RecommendationContext.js`
- Create: `mobile-app/src/context/__tests__/RecommendationContext.tonight.test.js`

- [ ] **Step 1: Write the failing tests**

Create `mobile-app/src/context/__tests__/RecommendationContext.tonight.test.js`:

```javascript
/**
 * Tonight's Picks additions to RecommendationContext:
 * - successful normal-flow fetch persists last context + today's cache
 * - startTonightSession seeds a session from cache without a network call
 * - sessionSource rides rec_requested / rec_accepted
 */
import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('../SavedGamesContext', () => ({
  useSavedGames: () => ({ notForMeGameIds: [] }),
}));
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    createSession: jest.fn(() => Promise.resolve({ session_id: 'sess-1' })),
    getRecommendations: jest.fn(),
    acceptRecommendation: jest.fn(() => Promise.resolve({})),
  },
}));
jest.mock('../../services/tonightService', () => ({
  saveLastContext: jest.fn(() => Promise.resolve(true)),
  saveTonightCache: jest.fn(() => Promise.resolve({})),
}));
jest.mock('../../services/analyticsService', () => ({ logEvent: jest.fn() }));

import api from '../../services/api';
import { saveLastContext, saveTonightCache } from '../../services/tonightService';
import { logEvent } from '../../services/analyticsService';
import { RecommendationProvider, useRecommendation } from '../RecommendationContext';

const RESPONSE = {
  session_id: 'sess-1',
  recommendations: [
    { game_id: 'hades', title: 'Hades' },
    { game_id: 'celeste', title: 'Celeste' },
  ],
  fallback_applied: false,
  fallback_message: null,
};

// Probe harness: exposes the hook value to the test.
let ctx;
const Probe = () => {
  ctx = useRecommendation();
  return <Text>probe</Text>;
};
const renderCtx = () =>
  render(
    <RecommendationProvider>
      <Probe />
    </RecommendationProvider>
  );

beforeEach(() => jest.clearAllMocks());

it('persists context and rewrites todays cache on successful normal fetch', async () => {
  api.getRecommendations.mockResolvedValue(RESPONSE);
  renderCtx();
  await act(async () => {
    await ctx.updatePreference('timeAvailable', 60);
    await ctx.updatePreference('energyMood', 'casual');
  });
  await act(async () => {
    await ctx.getRecommendations();
  });
  expect(saveLastContext).toHaveBeenCalledWith(expect.objectContaining({ timeAvailable: 60, energyMood: 'casual' }));
  expect(saveTonightCache).toHaveBeenCalledWith(expect.objectContaining({
    sessionId: 'sess-1',
    games: RESPONSE.recommendations,
  }));
  expect(logEvent).toHaveBeenCalledWith('rec_requested', expect.objectContaining({ source: 'flow' }));
});

it('startTonightSession seeds state from cache with no API call', async () => {
  renderCtx();
  const cache = {
    date: '2026-10-05',
    sessionId: 'cached-sess',
    context: { timeAvailable: 30, energyMood: 'wind_down', genres: [], platforms: [], sessionType: 'solo', discoveryMode: 'familiar' },
    games: RESPONSE.recommendations,
  };
  act(() => {
    expect(ctx.startTonightSession(cache)).toBe(true);
  });
  await waitFor(() => expect(ctx.recommendations).toEqual(RESPONSE.recommendations));
  expect(ctx.sessionId).toBe('cached-sess');
  expect(ctx.preferences.timeAvailable).toBe(30);
  expect(ctx.preferences.energyMood).toBe('wind_down');
  expect(ctx.shownGameIds).toEqual(['hades', 'celeste']);
  expect(api.getRecommendations).not.toHaveBeenCalled();

  await act(async () => {
    await ctx.acceptRecommendation('hades', 'Hades');
  });
  expect(logEvent).toHaveBeenCalledWith('rec_accepted', expect.objectContaining({ source: 'tonight' }));
});

it('rejects an empty cache', () => {
  renderCtx();
  act(() => {
    expect(ctx.startTonightSession({ games: [] })).toBe(false);
    expect(ctx.startTonightSession(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/context/__tests__/RecommendationContext.tonight.test.js -v`
Expected: FAIL — `ctx.startTonightSession` is not a function (first assertions about saveLastContext also fail).

- [ ] **Step 3: Implement in `RecommendationContext.js`**

3a. Add the import (after the `useSavedGames` import):

```javascript
import { saveLastContext, saveTonightCache } from '../services/tonightService';
```

3b. Add state (next to the other session state, after the `sessionId` declaration):

```javascript
  // Where the current session came from: 'flow' (normal input flow) or
  // 'tonight' (seeded from the Tonight's Picks cache). Rides analytics events.
  const [sessionSource, setSessionSource] = useState('flow');
```

3c. In `startSession`, mark the source. Add `setSessionSource('flow');` as the first line of the `try` block (before `const session = await api.createSession();`).

3d. In `getRecommendations`, persist context + cache after a successful response. Insert directly after the `setShownGameIds` update (the line `setShownGameIds((prev) => [...new Set([...prev, ...newGameIds])]);`) and before the `logEvent('rec_requested', ...)` call:

```javascript
      // Tonight's Picks: a completed normal-flow fetch is the user's freshest
      // real context, so it seeds/rewrites both the saved context and today's
      // ritual cache. Fire-and-forget; failures never affect the session.
      if (sessionSource === 'flow') {
        saveLastContext(preferences);
        saveTonightCache({
          context: {
            timeAvailable: preferences.timeAvailable,
            energyMood: preferences.energyMood,
            genres: preferences.genres || [],
            platforms: preferences.platforms || [],
            sessionType: preferences.sessionType,
            discoveryMode: preferences.discoveryMode,
          },
          sessionId: response.session_id,
          games: response.recommendations,
        });
      }
```

3e. Add `source: sessionSource` to the three analytics calls:
- `logEvent('rec_requested', { ... })` in `getRecommendations`: add `source: sessionSource,`
- `logEvent('rec_requested', { ... })` in `reroll`: add `source: sessionSource,`
- `logEvent('rec_accepted', { game_id: gameId })` in `acceptRecommendation`: change to `logEvent('rec_accepted', { game_id: gameId, source: sessionSource });`

Update the dependency arrays: add `sessionSource` to the deps of `getRecommendations`, `reroll`, and `acceptRecommendation`.

3f. Add `startTonightSession` (place after `startSession`):

```javascript
  /**
   * Seed a Results session from the Tonight's Picks cache — no network call.
   * Reroll/accept/swap then work exactly as in a fetch-seeded session: the
   * cached server session id carries over and the cached games are already
   * in shownGameIds, so rerolls exclude them.
   */
  const startTonightSession = useCallback((cache) => {
    if (!cache?.games?.length || !cache?.context) return false;
    setSessionId(cache.sessionId || `local-tonight-${Date.now()}`);
    setRecommendations(cache.games);
    setShownGameIds(cache.games.map((g) => g.game_id));
    setFallbackApplied(false);
    setFallbackMessage(null);
    setSessionSource('tonight');
    setPreferences({
      ...DEFAULT_PREFERENCES,
      timeAvailable: cache.context.timeAvailable,
      energyMood: cache.context.energyMood,
      genres: cache.context.genres || [],
      platforms: cache.context.platforms || [],
      sessionType: cache.context.sessionType || 'any',
      discoveryMode: cache.context.discoveryMode || 'familiar',
    });
    return true;
  }, []);
```

3g. Export it: add `startTonightSession,` to the `value` object (in the Actions group after `startSession`).

Note the empty-cache test also passes `{ games: [] }` with no `context` — the guard covers both.

- [ ] **Step 4: Run the new tests, then the full suite (context is load-bearing)**

Run: `npx jest src/context/__tests__/RecommendationContext.tonight.test.js -v` → PASS (3 tests).
Run: `npx jest` → all suites PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/context/RecommendationContext.js mobile-app/src/context/__tests__/RecommendationContext.tonight.test.js
git commit -m "feat: tonight session seeding and context persistence"
```

---

### Task 7: TonightCard component

**Files:**
- Create: `mobile-app/src/components/TonightCard.js`
- Create: `mobile-app/src/components/__tests__/TonightCard.test.js`

- [ ] **Step 1: Write the failing tests**

Create `mobile-app/src/components/__tests__/TonightCard.test.js`:

```javascript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../../services/gameImages', () => ({
  getGameImage: jest.fn(() => Promise.resolve(null)), // covers render without art
}));

import TonightCard, { formatContextLine } from '../TonightCard';

const CONTEXT = { timeAvailable: 60, energyMood: 'wind_down', genres: [], platforms: [], sessionType: 'solo', discoveryMode: 'familiar' };
const GAMES = [
  { game_id: 'hades', title: 'Hades' },
  { game_id: 'celeste', title: 'Celeste' },
  { game_id: 'unpacking', title: 'Unpacking' },
];

describe('formatContextLine', () => {
  it('formats time and mood', () => {
    expect(formatContextLine(CONTEXT)).toBe('60 min · Wind down');
    expect(formatContextLine({ timeAvailable: 120, energyMood: 'intense' })).toBe('2+ hrs · Intense');
  });
  it('is safe on unknown mood values', () => {
    expect(formatContextLine({ timeAvailable: 30, energyMood: 'mystery' })).toBe('30 min · mystery');
  });
});

describe('TonightCard', () => {
  it('renders title, context line, and games when ready', () => {
    const { getByText } = render(
      <TonightCard status="ready" context={CONTEXT} games={GAMES} onPress={jest.fn()} onChangePress={jest.fn()} />
    );
    getByText("Tonight's Picks");
    getByText('60 min · Wind down');
    getByText('Hades');
    getByText('Celeste');
    getByText('Unpacking');
  });

  it('fires onPress and onChangePress', () => {
    const onPress = jest.fn();
    const onChangePress = jest.fn();
    const { getByTestId, getByText } = render(
      <TonightCard status="ready" context={CONTEXT} games={GAMES} onPress={onPress} onChangePress={onChangePress} />
    );
    fireEvent.press(getByTestId('tonight-card'));
    expect(onPress).toHaveBeenCalled();
    fireEvent.press(getByText('Change'));
    expect(onChangePress).toHaveBeenCalled();
  });

  it('renders the loading state', () => {
    const { getByText, queryByText } = render(
      <TonightCard status="loading" context={CONTEXT} games={[]} onPress={jest.fn()} onChangePress={jest.fn()} />
    );
    getByText("Tonight's Picks");
    getByText('Picking for tonight…');
    expect(queryByText('Hades')).toBeNull();
  });

  it('renders the error state with retry copy', () => {
    const { getByText } = render(
      <TonightCard status="error" context={CONTEXT} games={[]} onPress={jest.fn()} onChangePress={jest.fn()} />
    );
    getByText("Couldn't load tonight's picks. Tap to retry.");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/components/__tests__/TonightCard.test.js -v`
Expected: FAIL — cannot find module `../TonightCard`.

- [ ] **Step 3: Implement**

Create `mobile-app/src/components/TonightCard.js`:

```javascript
/**
 * Tonight's Picks card for the Play tab.
 * Presentation-only: parent owns state and data (spec §5.2).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getGameImage } from '../services/gameImages';

const MOOD_LABELS = {
  wind_down: 'Wind down',
  casual: 'Casual',
  focused: 'Focused',
  intense: 'Intense',
};

export function formatContextLine(context) {
  if (!context) return '';
  const time = context.timeAvailable >= 120 ? '2+ hrs' : `${context.timeAvailable} min`;
  const mood = MOOD_LABELS[context.energyMood] || context.energyMood;
  return `${time} · ${mood}`;
}

const Thumb = ({ game }) => {
  const [uri, setUri] = useState(null);
  useEffect(() => {
    let mounted = true;
    getGameImage(game.game_id, game.title)
      .then((img) => { if (mounted && img) setUri(img); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [game.game_id, game.title]);

  return (
    <View style={styles.thumbWrap}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="game-controller-outline" size={18} color="#4a4a6a" />
        </View>
      )}
      <Text style={styles.thumbTitle} numberOfLines={1}>{game.title}</Text>
    </View>
  );
};

/**
 * @param {'loading'|'ready'|'error'} status
 * @param {object} context - saved context (for the subtitle line)
 * @param {Array} games - today's picks (ready state)
 * @param {Function} onPress - open picks (ready) or retry (error/loading)
 * @param {Function} onChangePress - jump into the normal input flow
 */
const TonightCard = ({ status, context, games, onPress, onChangePress }) => {
  return (
    <TouchableOpacity
      testID="tonight-card"
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Tonight's Picks, ${formatContextLine(context)}`}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="moon-outline" size={16} color="#e94560" />
          <Text style={styles.title}>Tonight's Picks</Text>
        </View>
        <TouchableOpacity onPress={onChangePress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.change}>Change</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.contextLine}>{formatContextLine(context)}</Text>

      {status === 'ready' && (
        <View style={styles.thumbRow}>
          {games.map((game) => (
            <Thumb key={game.game_id} game={game} />
          ))}
        </View>
      )}
      {status === 'loading' && <Text style={styles.stateText}>Picking for tonight…</Text>}
      {status === 'error' && (
        <Text style={styles.stateText}>Couldn't load tonight's picks. Tap to retry.</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.25)',
    padding: 16,
    marginTop: 24,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  change: { color: '#e94560', fontSize: 13, fontWeight: '600' },
  contextLine: { color: '#a0a0b8', fontSize: 13, marginTop: 4 },
  thumbRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  thumbWrap: { flex: 1, alignItems: 'center' },
  thumb: { width: '100%', aspectRatio: 3 / 4, borderRadius: 8 },
  thumbPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbTitle: { color: '#d0d0e0', fontSize: 11, marginTop: 6, maxWidth: '100%' },
  stateText: { color: '#a0a0b8', fontSize: 13, marginTop: 12 },
});

export default TonightCard;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/components/__tests__/TonightCard.test.js -v`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/components/TonightCard.js mobile-app/src/components/__tests__/TonightCard.test.js
git commit -m "feat: TonightCard component"
```

---

### Task 8: Reminder soft prompt util

**Files:**
- Create: `mobile-app/src/utils/tonightReminderPrompt.js`
- Create: `mobile-app/src/utils/__tests__/tonightReminderPrompt.test.js`

- [ ] **Step 1: Write the failing tests**

Create `mobile-app/src/utils/__tests__/tonightReminderPrompt.test.js`:

```javascript
import { Alert } from 'react-native';

jest.mock('../../services/tonightService', () => ({
  shouldOfferReminder: jest.fn(),
  markReminderPromptShown: jest.fn(() => Promise.resolve()),
  setReminder: jest.fn(() => Promise.resolve({ enabled: true, time: '20:00' })),
  DEFAULT_REMINDER_TIME: '20:00',
}));
jest.mock('../../services/analyticsService', () => ({ logEvent: jest.fn() }));

import { shouldOfferReminder, markReminderPromptShown, setReminder } from '../../services/tonightService';
import { logEvent } from '../../services/analyticsService';
import { maybeOfferTonightReminder } from '../tonightReminderPrompt';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

it('does nothing when the gate says no', async () => {
  shouldOfferReminder.mockResolvedValue(false);
  expect(await maybeOfferTonightReminder()).toBe(false);
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(markReminderPromptShown).not.toHaveBeenCalled();
});

it('marks shown BEFORE presenting, then shows the alert', async () => {
  shouldOfferReminder.mockResolvedValue(true);
  expect(await maybeOfferTonightReminder()).toBe(true);
  expect(markReminderPromptShown).toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledTimes(1);
});

it('accept button enables the reminder and logs both events', async () => {
  shouldOfferReminder.mockResolvedValue(true);
  await maybeOfferTonightReminder();
  const buttons = Alert.alert.mock.calls[0][2];
  const accept = buttons.find((b) => b.text !== 'Not now');
  await accept.onPress();
  expect(setReminder).toHaveBeenCalledWith(true, '20:00');
  expect(logEvent).toHaveBeenCalledWith('tonight_reminder_prompt', { accepted: true });
  expect(logEvent).toHaveBeenCalledWith('tonight_reminder_set', { enabled: true });
});

it('decline logs the prompt event only', async () => {
  shouldOfferReminder.mockResolvedValue(true);
  await maybeOfferTonightReminder();
  const decline = Alert.alert.mock.calls[0][2].find((b) => b.text === 'Not now');
  decline.onPress();
  expect(logEvent).toHaveBeenCalledWith('tonight_reminder_prompt', { accepted: false });
  expect(setReminder).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/utils/__tests__/tonightReminderPrompt.test.js -v`
Expected: FAIL — cannot find module `../tonightReminderPrompt`.

- [ ] **Step 3: Implement**

Create `mobile-app/src/utils/tonightReminderPrompt.js` (pattern mirrors `pushPrompt.js`, including record-before-show):

```javascript
import { Alert } from 'react-native';
import {
  shouldOfferReminder,
  markReminderPromptShown,
  setReminder,
  DEFAULT_REMINDER_TIME,
} from '../services/tonightService';
import { logEvent } from '../services/analyticsService';

/**
 * One-time soft prompt for the nightly reminder, shown after the second
 * distinct day of viewing Tonight's Picks. Fire-and-forget at call sites:
 * never throws, never blocks navigation.
 */
export async function maybeOfferTonightReminder() {
  try {
    if (!(await shouldOfferReminder())) return false;
    // Record BEFORE showing so "Not now" (or a lost callback) never reprompts.
    await markReminderPromptShown();
    Alert.alert(
      'Nightly nudge?',
      "Want a reminder when tonight's picks are ready? One quiet notification around 8pm. You can change the time in Profile.",
      [
        {
          text: 'Not now',
          style: 'cancel',
          onPress: () => logEvent('tonight_reminder_prompt', { accepted: false }),
        },
        {
          text: 'Remind me',
          onPress: async () => {
            logEvent('tonight_reminder_prompt', { accepted: true });
            const result = await setReminder(true, DEFAULT_REMINDER_TIME);
            logEvent('tonight_reminder_set', { enabled: !!result.enabled });
          },
        },
      ],
    );
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/utils/__tests__/tonightReminderPrompt.test.js -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/utils/tonightReminderPrompt.js mobile-app/src/utils/__tests__/tonightReminderPrompt.test.js
git commit -m "feat: tonight reminder soft prompt"
```

---

### Task 9: PlayScreen integration

**Files:**
- Modify: `mobile-app/src/screens/PlayScreen.js`
- Create: `mobile-app/src/screens/__tests__/PlayScreen.tonight.test.js`

- [ ] **Step 1: Write the failing tests**

Create `mobile-app/src/screens/__tests__/PlayScreen.tonight.test.js`:

```javascript
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: undefined }),
  // Run focus effects immediately, once, like a focused mount.
  useFocusEffect: (cb) => { const React = require('react'); React.useEffect(cb, []); },
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }) => children }));

const mockStartTonightSession = jest.fn(() => true);
jest.mock('../../context/RecommendationContext', () => ({
  useRecommendation: () => ({
    startSession: jest.fn(),
    resetPreferences: jest.fn(),
    startTonightSession: mockStartTonightSession,
  }),
}));
jest.mock('../../context/SavedGamesContext', () => ({
  useSavedGames: () => ({ notForMeGameIds: [] }),
}));
jest.mock('../../services/tonightService', () => ({
  getLastContext: jest.fn(),
  getCachedPicks: jest.fn(),
  fetchTonightsPicks: jest.fn(),
  recordTonightView: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../utils/tonightReminderPrompt', () => ({
  maybeOfferTonightReminder: jest.fn(() => Promise.resolve(false)),
}));
jest.mock('../../services/analyticsService', () => ({ logEvent: jest.fn() }));
jest.mock('../../services/gameImages', () => ({ getGameImage: jest.fn(() => Promise.resolve(null)) }));

import { getLastContext, getCachedPicks, fetchTonightsPicks, recordTonightView } from '../../services/tonightService';
import { logEvent } from '../../services/analyticsService';
import PlayScreen from '../PlayScreen';

const CONTEXT = { timeAvailable: 60, energyMood: 'casual', genres: [], platforms: [], sessionType: 'any', discoveryMode: 'familiar' };
const CACHE = { date: '2026-10-05', sessionId: 's1', context: CONTEXT, games: [{ game_id: 'hades', title: 'Hades' }] };

beforeEach(() => jest.clearAllMocks());

it('shows no card when no context is saved', async () => {
  getLastContext.mockResolvedValue(null);
  const { queryByText } = render(<PlayScreen />);
  await waitFor(() => expect(getLastContext).toHaveBeenCalled());
  expect(queryByText("Tonight's Picks")).toBeNull();
  expect(fetchTonightsPicks).not.toHaveBeenCalled();
});

it('renders ready card straight from cache without fetching', async () => {
  getLastContext.mockResolvedValue(CONTEXT);
  getCachedPicks.mockResolvedValue(CACHE);
  const { getByText } = render(<PlayScreen />);
  await waitFor(() => getByText("Tonight's Picks"));
  getByText('Hades');
  expect(fetchTonightsPicks).not.toHaveBeenCalled();
});

it('prefetches when no cache exists yet', async () => {
  getLastContext.mockResolvedValue(CONTEXT);
  getCachedPicks.mockResolvedValue(null);
  fetchTonightsPicks.mockResolvedValue(CACHE);
  const { getByText } = render(<PlayScreen />);
  await waitFor(() => getByText('Hades'));
  expect(fetchTonightsPicks).toHaveBeenCalled();
});

it('tapping a ready card seeds the session, navigates, records the view', async () => {
  getLastContext.mockResolvedValue(CONTEXT);
  getCachedPicks.mockResolvedValue(CACHE);
  const { getByTestId, getByText } = render(<PlayScreen />);
  await waitFor(() => getByText('Hades'));
  fireEvent.press(getByTestId('tonight-card'));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Results'));
  expect(mockStartTonightSession).toHaveBeenCalledWith(CACHE);
  expect(recordTonightView).toHaveBeenCalled();
  expect(logEvent).toHaveBeenCalledWith('tonight_picks_viewed', { via: 'card' });
});

it('shows the error state when the prefetch fails', async () => {
  getLastContext.mockResolvedValue(CONTEXT);
  getCachedPicks.mockResolvedValue(null);
  fetchTonightsPicks.mockRejectedValue(new Error('offline'));
  const { getByText } = render(<PlayScreen />);
  await waitFor(() => getByText("Couldn't load tonight's picks. Tap to retry."));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/screens/__tests__/PlayScreen.tonight.test.js -v`
Expected: FAIL — `queryByText("Tonight's Picks")` etc. (card not rendered; handlers absent).

- [ ] **Step 3: Implement in `PlayScreen.js`**

3a. Extend imports:

```javascript
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react'; // merge into the existing react import
import { useSavedGames } from '../context/SavedGamesContext';
import TonightCard from '../components/TonightCard';
import {
  getLastContext,
  getCachedPicks,
  fetchTonightsPicks,
  recordTonightView,
} from '../services/tonightService';
import { maybeOfferTonightReminder } from '../utils/tonightReminderPrompt';
import { logEvent } from '../services/analyticsService';
```

3b. Pull `startTonightSession` from `useRecommendation()` (add to the existing destructuring) and `notForMeGameIds` from `useSavedGames()`. Add `const route = useRoute();`.

3c. Add state + loader inside the component (after the animation refs):

```javascript
  // Tonight's Picks card state
  const [tonightStatus, setTonightStatus] = useState('hidden'); // hidden | loading | ready | error
  const [tonightCache, setTonightCache] = useState(null);
  const [tonightContext, setTonightContext] = useState(null);

  const loadTonight = useCallback(async () => {
    try {
      const context = await getLastContext();
      if (!context) {
        setTonightStatus('hidden');
        return null;
      }
      setTonightContext(context);
      const cached = await getCachedPicks();
      if (cached) {
        setTonightCache(cached);
        setTonightStatus('ready');
        return cached;
      }
      setTonightStatus('loading');
      const fresh = await fetchTonightsPicks({ excludedGameIds: notForMeGameIds || [] });
      if (fresh) {
        setTonightCache(fresh);
        setTonightStatus('ready');
        return fresh;
      }
      setTonightStatus('hidden');
      return null;
    } catch {
      setTonightStatus('error');
      return null;
    }
  }, [notForMeGameIds]);

  // Refresh on every focus: catches date rollover and post-session cache rewrites.
  useFocusEffect(
    useCallback(() => {
      loadTonight();
    }, [loadTonight])
  );

  const openTonight = useCallback(
    (cache, via) => {
      if (!startTonightSession(cache)) return;
      recordTonightView();
      logEvent('tonight_picks_viewed', { via });
      navigation.navigate('Results');
      maybeOfferTonightReminder();
    },
    [startTonightSession, navigation]
  );

  const handleTonightPress = useCallback(async () => {
    if (tonightStatus === 'ready' && tonightCache) {
      openTonight(tonightCache, 'card');
      return;
    }
    // loading/error: (re)try, then open if it lands
    const cache = await loadTonight();
    if (cache) openTonight(cache, 'card');
  }, [tonightStatus, tonightCache, openTonight, loadTonight]);

  const handleTonightChange = useCallback(() => {
    handleStart(); // same entry as the hero CTA: completing the flow rewrites context + cache
  }, []);

  // Notification deep link: open tonight's picks as soon as they're available.
  useEffect(() => {
    if (!route?.params?.openTonight) return;
    (async () => {
      const cache = tonightStatus === 'ready' && tonightCache ? tonightCache : await loadTonight();
      if (cache) openTonight(cache, 'notification');
    })();
  }, [route?.params?.openTonight]);
```

(`handleStart` already exists; leave it unchanged. `handleTonightChange` is defined after `handleStart` so it can reference it.)

3d. Render the card. Inside the existing `<View style={styles.content}>`, directly below the main CTA block, add:

```javascript
          {tonightStatus !== 'hidden' && (
            <TonightCard
              status={tonightStatus}
              context={tonightContext}
              games={tonightCache?.games || []}
              onPress={handleTonightPress}
              onChangePress={handleTonightChange}
            />
          )}
```

- [ ] **Step 4: Run the new tests, then the full suite**

Run: `npx jest src/screens/__tests__/PlayScreen.tonight.test.js -v` → PASS (5 tests).
Run: `npx jest` → all suites PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/screens/PlayScreen.js mobile-app/src/screens/__tests__/PlayScreen.tonight.test.js
git commit -m "feat: Tonight's Picks card on Play tab"
```

---

### Task 10: ProfileScreen reminder row

**Files:**
- Modify: `mobile-app/src/screens/ProfileScreen.js`

No component test for this screen exists (house pattern: settings rows are emulator-verified); logic is already covered by the Task 5 service tests.

- [ ] **Step 1: Implement**

1a. Add imports:

```javascript
import { getReminderSettings, setReminder, DEFAULT_REMINDER_TIME } from '../services/tonightService';
```

1b. Add state + handlers (next to the existing notifications toggle state, around line 70):

```javascript
  // Tonight's Picks reminder (local notification, independent of push)
  const [reminder, setReminder_] = useState({ enabled: false, time: DEFAULT_REMINDER_TIME });
  const [reminderBusy, setReminderBusy] = useState(false);

  useEffect(() => {
    getReminderSettings().then(setReminder_).catch(() => {});
  }, []);

  const REMINDER_TIMES = [
    { label: '6 PM', value: '18:00' },
    { label: '7 PM', value: '19:00' },
    { label: '8 PM', value: '20:00' },
    { label: '9 PM', value: '21:00' },
    { label: '10 PM', value: '22:00' },
  ];

  const applyReminder = async (enabled, time) => {
    if (reminderBusy) return;
    setReminderBusy(true);
    try {
      const result = await setReminder(enabled, time);
      if (result.permissionDenied) {
        Alert.alert(
          'Notifications blocked',
          'Enable notifications for PlayNxt in your device Settings to get the nightly reminder.'
        );
      }
      setReminder_({ enabled: !!result.enabled, time: result.time || time });
      logEvent('tonight_reminder_set', { enabled: !!result.enabled });
    } finally {
      setReminderBusy(false);
    }
  };
```

(`Alert` and `logEvent` are already imported in this file; verify and add if not.)

1c. Render, directly below the existing Notifications section (after its closing element, around line 345). Follow the file's existing section-row helper/markup style exactly — the snippet below shows content, adapt the wrappers to match neighboring sections:

```javascript
          {/* Tonight's Picks reminder */}
          <View style={styles.settingRow}>
            <View style={styles.settingLabelWrap}>
              <Ionicons name="moon-outline" size={22} color="#808080" />
              <Text style={styles.settingLabel}>Nightly picks reminder</Text>
            </View>
            <Switch
              value={reminder.enabled}
              onValueChange={(next) => applyReminder(next, reminder.time)}
              disabled={reminderBusy}
            />
          </View>
          {reminder.enabled && (
            <View style={styles.reminderTimesRow}>
              {REMINDER_TIMES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.timeChip, reminder.time === t.value && styles.timeChipActive]}
                  onPress={() => applyReminder(true, t.value)}
                  disabled={reminderBusy}
                >
                  <Text style={[styles.timeChipText, reminder.time === t.value && styles.timeChipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
```

1d. Add styles to the bottom `StyleSheet.create` (match the file's palette):

```javascript
  reminderTimesRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexWrap: 'wrap',
  },
  timeChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  timeChipActive: { backgroundColor: '#e94560' },
  timeChipText: { color: '#a0a0b8', fontSize: 13 },
  timeChipTextActive: { color: '#ffffff', fontWeight: '600' },
```

- [ ] **Step 2: Run the full suite (no new tests; guard against import breakage)**

Run: `npx jest`
Expected: all suites PASS.

- [ ] **Step 3: Commit**

```bash
git add mobile-app/src/screens/ProfileScreen.js
git commit -m "feat: nightly reminder settings row in Profile"
```

---

### Task 11: App.js deep link + 1.5.0 changelog entry

**Files:**
- Modify: `mobile-app/App.js:106-121` (notification response listener)
- Modify: `mobile-app/src/config/changelog.js`

- [ ] **Step 1: Add the `'tonight'` deep-link case**

In the `addNotificationResponseListener` handler in `App.js`, insert a new branch before the final `else`:

```javascript
      } else if (data.deep_link === 'tonight') {
        // Local nightly reminder: land on Play, which auto-opens tonight's picks.
        navigationRef.navigate('Main', { screen: 'Play', params: { openTonight: Date.now() } });
```

(`openTonight: Date.now()` guarantees a changed param each tap, so PlayScreen's effect re-fires on repeat notifications.)

- [ ] **Step 2: Add the 1.5.0 changelog entry**

In `mobile-app/src/config/changelog.js`, add above the `'1.4.0'` entry, matching its exact shape (verify field names against the 1.4.0 entry before writing):

```javascript
  '1.5.0': {
    version: '1.5.0',
    headline: "Tonight's Picks",
    features: [
      {
        title: 'Your picks, ready every evening',
        description: "Three games chosen for your usual time and mood, waiting on the Play tab. Same three all day. No more deciding.",
      },
      {
        title: 'Nightly reminder',
        description: 'Want a nudge at 8pm? Turn on the reminder in Profile and pick your time.',
      },
    ],
    ctas: [],
  },
```

- [ ] **Step 3: Run the full suite**

Run: `npx jest`
Expected: all suites PASS (changelogService tests exercise the CHANGELOG shape).

- [ ] **Step 4: Commit**

```bash
git add mobile-app/App.js mobile-app/src/config/changelog.js
git commit -m "feat: tonight deep link and 1.5.0 changelog entry"
```

---

### Task 12: Documentation

**Files:**
- Modify: `docs/PRD.md`
- Modify: `docs/FEATURE-STRATEGY-Q4-2026.md`

- [ ] **Step 1: PRD §4 — add the entry path.** In section 4 (User Flow), after 4.4, add:

```markdown
### 4.5 Tonight's Picks **[SHIPPED 1.5.0]**

A daily-ritual shortcut on the Play tab: the last completed session's inputs
(time, mood, optional filters) are persisted and reused to precompute three
picks per local day, cached on-device and stable until midnight. Tapping the
card opens the standard Results screen; "Change" runs the normal input flow,
which rewrites both the saved context and the day's picks. Time and mood are
carried, never omitted — every request still satisfies §3. Fully anonymous;
no backend additions (`src/services/tonightService.js`).
```

- [ ] **Step 2: PRD §12 — add the local reminder.** In the Notifications section, add:

```markdown
- **Tonight's Picks reminder** **[SHIPPED 1.5.0]** — locally scheduled daily
  notification (`expo-notifications`, no server), opt-in via a one-time soft
  prompt after the second distinct day of use or via Profile; default 8:00pm,
  preset times 6–10pm. Deep-links to the day's picks (`deep_link: 'tonight'`).
```

- [ ] **Step 3: PRD §14 — add events** to the analytics table:

```markdown
| `tonight_picks_viewed` (`via`) | Tonight's Picks ritual adoption |
| `tonight_reminder_prompt` / `tonight_reminder_set` | Reminder opt-in funnel |
| `rec_requested` / `rec_accepted` now carry `source: flow \| tonight` | Acceptance-rate comparison per entry path |
```

- [ ] **Step 4:** In `docs/FEATURE-STRATEGY-Q4-2026.md`, mark F1 as in progress: change the Oct 5 row's release cell to `**1.5.0 — Tonight's Picks** (built; ship gate: device pass)`.

- [ ] **Step 5: Commit**

```bash
git add docs/PRD.md docs/FEATURE-STRATEGY-Q4-2026.md
git commit -m "docs: PRD and strategy updates for Tonight's Picks"
```

---

### Task 13: Full verification

- [ ] **Step 1: Full test suite**

Run from `mobile-app/`: `npx jest`
Expected: all suites PASS, zero skips.

- [ ] **Step 2: expo-doctor**

Run: `npx expo-doctor`
Expected: same pass count as main (two checks are network-dependent).

- [ ] **Step 3: Record the emulator validation checklist** (executed at release time per `superpowers:mobile-release` / the 1.5.0 runbook — not part of this plan's execution):

1. Fresh install → no Tonight card until one full session completes → card appears with covers.
2. Kill + relaunch → same 3 picks (cache hit, no spinner).
3. Airplane mode → tap card → Results renders from cache without network.
4. `adb shell su 0 date` (or emulator Extended Controls → date change) to tomorrow → reopen → new picks.
5. Enable reminder in Profile at a minute in the future → background the app → notification fires → tap → lands on tonight's picks.
6. Soft prompt appears only on the second distinct day of viewing (simulate via date change), and never again after answering.
7. Normal flow still works end to end; changelog modal shows the 1.5.0 entry on upgrade.

- [ ] **Step 4: Final commit of any stragglers, push the branch**

---

## Self-Review Notes (completed at planning time)

- **Spec coverage:** §3.1 card/states/Change → Tasks 7, 9; §3.2 prefetch → Task 9; §3.3 stability/variety → Tasks 2–3, 6 (reroll untouched); §4 reminder → Tasks 5, 8, 10, 11; §5.1 keys/shapes → Tasks 1–4; §5.2 modules → file structure; §5.3 Results hydration → Task 6; §6 analytics → Tasks 6, 8, 9, 10; §7 edge cases → guards in Tasks 2, 3, 6, 9 + emulator checklist; §8 testing → every task; §10 PRD → Task 12. The two planning deviations are declared in the header.
- **Type consistency:** cache shape `{date, context, sessionId, games}` and context shape `{timeAvailable, energyMood, genres, platforms, sessionType, discoveryMode}` are identical across tonightService, RecommendationContext, TonightCard, and PlayScreen. `setReminder` returns `{enabled, time}` / `{enabled: false, permissionDenied: true}` consistently in Tasks 5, 8, 10.
- **Placeholder scan:** clean; ProfileScreen markup is explicitly "adapt wrappers to the file's existing section style," which is an instruction to follow local convention, not a gap.
