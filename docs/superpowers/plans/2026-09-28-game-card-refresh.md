# Game Card Refresh (1.5.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement docs/GAME-CARD-REFRESH.md P0.1–P0.6: server-side explanation quality (max 2 game-specific bullets, response-level dedupe) and the restructured results card (CTA above the fold, demoted commerce, labeled actions, press feedback).

**Architecture:** Two independently shippable parts. Part A changes explanation assembly in `api-service` only — it caps and dedupes bullets server-side by nulling non-selected fields on `RecommendationExplanation`, so the live 1.3.0/1.4.0 apps immediately show fewer, better bullets with no client change. Part B restructures `GameCard.js` render order and visuals in `mobile-app`. The P1 motion set (stagger, springs) is explicitly OUT of this plan and ships as its own follow-up.

**Tech Stack:** Python/FastAPI + pytest (Part A); React Native/Expo + jest with @testing-library/react-native (Part B).

**Out of scope:** version bumps (done at release via /mobile-release), the P1 motion set, GameDetailScreen/share card, store listings.

---

## Task 0: Branch

**Files:** none

- [ ] **Step 1: Create the feature branch** (use the superpowers:using-git-worktrees skill if isolation from other active sessions is needed — the R8 task session also touches this repo)

```bash
cd C:/Users/ttagu/Projects/PlayNxt
git checkout main && git pull
git checkout -b feature/game-card-refresh
```

---

## Part A — API: explanation quality (P0.2)

Current behavior (`api-service/src/services/recommendation_service.py`):
- `_build_recommendation` (lines 988–1056) joins `time_fit`/`mood_fit`/`stop_fit` templates into `summary` and passes ALL template fields through to `RecommendationExplanation`, so the card can render up to 4 bullets.
- The three recommendations are built in a list comprehension at lines 295–300, so identical mood/stop templates repeat across games in one response.
- The card renders `mood_fit`, `stop_fit`, `style_fit`, `library_fit` (GameCard.js:357–380).

### Task A1: Selection helper with filler blocklist

**Files:**
- Modify: `api-service/src/services/recommendation_service.py` (add module-level constants near the other module constants at the top, and a private method on the service)
- Test: `api-service/tests/test_explanation_selection.py` (new)

- [ ] **Step 1: Write the failing tests**

```python
"""Tests for explanation bullet selection (game card refresh P0.2)."""
import pytest

from src.services.recommendation_service import (
    RecommendationService,
    GENERIC_FILLER,
    _normalize_bullet,
)


@pytest.fixture
def svc():
    return RecommendationService.__new__(RecommendationService)  # no Firestore needed


def test_normalize_bullet_strips_case_and_punctuation():
    assert _normalize_bullet("Enjoyable gameplay experience.") == "enjoyable gameplay experience"
    assert _normalize_bullet("  Easy to pause  ") == "easy to pause"


def test_selects_at_most_two_fields(svc):
    templates = {
        "style_fit": "Turn-based tactics reward careful planning.",
        "session_fit": "One run takes about 25 minutes.",
        "time_fit": "A run fits cleanly in {time} minutes.",
        "mood_fit": "Great when you want to focus.",
        "stop_fit": "Auto-saves between turns.",
    }
    selected = svc._select_explanation_fields(templates, used=set())
    assert len(selected) == 2
    # Most game-specific fields win: style_fit then session_fit
    assert [f for f, _ in selected] == ["style_fit", "session_fit"]


def test_filler_is_skipped(svc):
    templates = {
        "style_fit": "Enjoyable gameplay experience.",  # filler
        "mood_fit": "Unwind and enjoy at your own pace.",  # filler
        "stop_fit": "Auto-saves after every mission.",
    }
    selected = svc._select_explanation_fields(templates, used=set())
    assert [f for f, _ in selected] == ["stop_fit"]


def test_used_bullets_are_skipped_for_dedupe(svc):
    templates = {
        "style_fit": "Deck-building with poker hands.",
        "stop_fit": "Save and quit whenever - no progress lost.",
    }
    used = {_normalize_bullet("Save and quit whenever - no progress lost.")}
    selected = svc._select_explanation_fields(templates, used=used)
    assert [f for f, _ in selected] == ["style_fit"]


def test_empty_selection_when_everything_is_filler(svc):
    templates = {"mood_fit": "Enjoyable gameplay experience."}
    assert svc._select_explanation_fields(templates, used=set()) == []


def test_blocklist_entries_are_normalized():
    for entry in GENERIC_FILLER:
        assert entry == _normalize_bullet(entry), f"not normalized: {entry!r}"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd C:/Users/ttagu/Projects/PlayNxt/api-service && python -m pytest tests/test_explanation_selection.py -v
```
Expected: FAIL with `ImportError: cannot import name 'GENERIC_FILLER'`.

- [ ] **Step 3: Implement the helper**

In `recommendation_service.py`, add near the other module-level constants (top of file, after imports):

```python
# Game card refresh (P0.2): bullets are capped at 2 per game and chosen
# most-game-specific-first. Known filler strings are never emitted.
EXPLANATION_FIELD_PRIORITY = ["style_fit", "session_fit", "time_fit", "stop_fit", "mood_fit"]
MAX_EXPLANATION_BULLETS = 2

GENERIC_FILLER = frozenset({
    "enjoyable gameplay experience",
    "freedom to create and explore at your pace",
    "unwind and enjoy at your own pace",
    "easy to pause whenever you need",
    "perfect for unwinding - gentle pace lets you relax",
    "a great way to pass the time",
    "fun for everyone",
})


def _normalize_bullet(text: str) -> str:
    """Lowercase, trim, and drop trailing punctuation for filler/dedupe checks."""
    return text.strip().rstrip(".!").strip().lower()
```

And add this method to `RecommendationService` (directly above `_build_recommendation`):

```python
def _select_explanation_fields(self, templates: dict, used: set) -> list:
    """Pick at most MAX_EXPLANATION_BULLETS (field, text) pairs.

    Priority favors game-specific fields; known filler and bullets already
    emitted for another game in this response are skipped. `used` is
    mutated with the normalized text of every selected bullet.
    """
    selected = []
    for field in EXPLANATION_FIELD_PRIORITY:
        text = templates.get(field)
        if not text:
            continue
        norm = _normalize_bullet(text)
        if norm in GENERIC_FILLER or norm in used:
            continue
        selected.append((field, text))
        used.add(norm)
        if len(selected) >= MAX_EXPLANATION_BULLETS:
            break
    return selected
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd C:/Users/ttagu/Projects/PlayNxt/api-service && python -m pytest tests/test_explanation_selection.py -v
```
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add api-service/tests/test_explanation_selection.py api-service/src/services/recommendation_service.py
git commit -m "feat(api): explanation bullet selection with filler blocklist"
```

### Task A2: Wire selection into `_build_recommendation` with response-level dedupe

**Files:**
- Modify: `api-service/src/services/recommendation_service.py:295-300` (the list comprehension) and `:996-1013` + `:1040-1048` (inside `_build_recommendation`)
- Test: `api-service/tests/test_explanation_selection.py` (extend)

- [ ] **Step 1: Write the failing tests** (append to the same test file; build minimal game dicts through the real `_build_recommendation`)

```python
from src.models.recommendation import RecommendationRequest, EnergyMood


def _game(game_id, templates):
    return {
        "game_id": game_id,
        "title": game_id.title(),
        "platforms": ["pc"],
        "description_short": "d",
        "explanation_templates": templates,
        "time_to_fun": "medium",
        "stop_friendliness": "checkpoints",
        "score": 0.9,
    }


def _request():
    return RecommendationRequest(time_available=60, energy_mood=EnergyMood.FOCUSED)


def test_build_recommendation_emits_only_selected_fields(svc):
    rec = svc._build_recommendation(
        _game("a", {
            "style_fit": "Deck-building with poker hands.",
            "mood_fit": "Great when you want to focus.",
            "stop_fit": "Auto-saves between rounds.",
            "time_fit": "A run fits in {time} minutes.",
        }),
        _request(),
        used_bullets=set(),
    )
    emitted = [f for f in ("style_fit", "session_fit", "time_fit", "stop_fit", "mood_fit")
               if getattr(rec.explanation, f)]
    assert len(emitted) == 2
    assert rec.explanation.style_fit == "Deck-building with poker hands."
    assert rec.explanation.mood_fit is None  # capped out


def test_two_games_never_share_a_bullet(svc):
    shared = {"stop_fit": "Save and quit whenever - no progress lost."}
    used = set()
    rec1 = svc._build_recommendation(_game("a", dict(shared)), _request(), used_bullets=used)
    rec2 = svc._build_recommendation(_game("b", dict(shared)), _request(), used_bullets=used)
    assert rec1.explanation.stop_fit == "Save and quit whenever - no progress lost."
    assert rec2.explanation.stop_fit is None


def test_all_filler_falls_back_to_generated_time_bullet(svc):
    rec = svc._build_recommendation(
        _game("a", {"mood_fit": "Enjoyable gameplay experience."}),
        _request(),
        used_bullets=set(),
    )
    # PRD non-negotiable: every rec has a clear explanation
    assert rec.explanation.time_fit == "Fits a focused 60-minute session."
    assert rec.explanation.mood_fit is None
    assert rec.explanation.summary


def test_library_fit_is_untouched(svc):
    rec = svc._build_recommendation(
        _game("a", {"style_fit": "Physics puzzles with real depth."}),
        _request(),
        used_bullets=set(),
        library_playtimes={"a": 0},
    )
    assert rec.explanation.library_fit == "It's been sitting unplayed in your Steam library."
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd C:/Users/ttagu/Projects/PlayNxt/api-service && python -m pytest tests/test_explanation_selection.py -v
```
Expected: new tests FAIL with `TypeError: _build_recommendation() got an unexpected keyword argument 'used_bullets'`.

- [ ] **Step 3: Implement**

3a. Change the `_build_recommendation` signature (line 988) to add the keyword arg:

```python
    def _build_recommendation(
        self,
        game: dict,
        request: RecommendationRequest,
        in_library_ids: Optional[set] = None,
        library_playtimes: Optional[dict] = None,
        used_bullets: Optional[set] = None,
    ) -> GameRecommendation:
```

3b. Replace the explanation assembly (current lines 996–1013) with:

```python
        # Build explanation: at most 2 game-specific bullets, deduped across
        # the whole response (docs/GAME-CARD-REFRESH.md P0.2).
        templates = game.get("explanation_templates", {})
        if used_bullets is None:
            used_bullets = set()
        selected = self._select_explanation_fields(templates, used_bullets)

        mood_label = request.energy_mood.value.replace("_", " ")
        if not selected:
            fallback = f"Fits a {mood_label} {request.time_available}-minute session."
            selected = [("time_fit", fallback)]
            used_bullets.add(_normalize_bullet(fallback))

        emitted = {}
        explanation_parts = []
        for field, text in selected:
            text = text.replace("{time}", str(request.time_available))
            emitted[field] = text
            explanation_parts.append(ensure_sentence(text))

        summary = " ".join(explanation_parts)
```

3c. In the `RecommendationExplanation(...)` construction (current lines 1040–1048), emit only selected fields:

```python
            explanation=RecommendationExplanation(
                summary=summary,
                time_fit=emitted.get("time_fit"),
                mood_fit=emitted.get("mood_fit"),
                stop_fit=emitted.get("stop_fit"),
                style_fit=emitted.get("style_fit"),
                session_fit=emitted.get("session_fit"),
                library_fit=library_fit,
            ),
```

3d. Change the response build (lines 293–300) from a list comprehension to a loop that threads the shared set:

```python
        # Build recommendations — one shared used_bullets set so no two
        # games in this response show an identical explanation bullet.
        owned_unplayed = library_data["owned_unplayed"] if library_data else None
        used_bullets: set = set()
        recommendations = []
        for game in top_games:
            recommendations.append(
                self._build_recommendation(
                    game,
                    request,
                    in_library_ids=owned_unplayed,
                    library_playtimes=library_playtimes,
                    used_bullets=used_bullets,
                )
            )
```

(Keep the exact keyword arguments the comprehension currently passes — read lines 296–302 first and preserve `in_library_ids`/`library_playtimes` wiring as it is today; only add `used_bullets`.)

3e. The fallback test expects `"Fits a focused 60-minute session."` — note the order is mood then time. Make the f-string exactly `f"Fits a {mood_label} {request.time_available}-minute session."`.

- [ ] **Step 4: Run the new tests AND the full API suite** (regressions likely in tests asserting the old summary format)

```bash
cd C:/Users/ttagu/Projects/PlayNxt/api-service && python -m pytest -q
```
Expected: all pass. If `test_recommendation_service.py` or `test_backlog_mode.py` assert the old 3-part summary or a specific bullet field, update those assertions to the new 2-bullet contract — the new contract is the spec; do not weaken the new tests to preserve old strings.

- [ ] **Step 5: Commit**

```bash
git add api-service/src/services/recommendation_service.py api-service/tests/
git commit -m "feat(api): cap explanations at 2 deduped game-specific bullets"
```

---

## Part B — Mobile: card restructure (P0.1, P0.3–P0.6)

### Task B1: PressableScale primitive (P0.6)

**Files:**
- Create: `mobile-app/src/components/PressableScale.tsx`
- Test: `mobile-app/src/components/__tests__/PressableScale.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import PressableScale from '../PressableScale';

describe('PressableScale', () => {
  it('renders children and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <PressableScale onPress={onPress} accessibilityLabel="go">
        <Text>Go</Text>
      </PressableScale>
    );
    fireEvent.press(getByText('Go'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <PressableScale onPress={onPress} disabled>
        <Text>Go</Text>
      </PressableScale>
    );
    fireEvent.press(getByText('Go'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd C:/Users/ttagu/Projects/PlayNxt/mobile-app && npx jest src/components/__tests__/PressableScale.test.js
```
Expected: FAIL, cannot find module '../PressableScale'.

- [ ] **Step 3: Implement** (Animated from react-native core — no new dependency; spec P0.6: 0.97 over 120ms in, spring back out; scale + opacity only)

```tsx
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
```

- [ ] **Step 4: Run to verify pass**

```bash
cd C:/Users/ttagu/Projects/PlayNxt/mobile-app && npx jest src/components/__tests__/PressableScale.test.js
```
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/components/PressableScale.tsx mobile-app/src/components/__tests__/PressableScale.test.js
git commit -m "feat(mobile): PressableScale press-feedback primitive"
```

### Task B2: GameCard structure tests (write first, red)

**Files:**
- Test: `mobile-app/src/components/__tests__/GameCard.test.js` (new)

- [ ] **Step 1: Write the failing structural tests.** Look at an existing test (e.g. `__tests__/ShareCard.test.js`) for the mock setup conventions (LinearGradient, Ionicons mocks) and reuse them.

```javascript
import React from 'react';
import { render } from '@testing-library/react-native';
import GameCard from '../GameCard';

const game = {
  game_id: 'g1',
  title: 'Game Dev Tycoon',
  platforms: ['mobile'],
  description_short: 'Build a game development company.',
  explanation: {
    summary: 's',
    style_fit: 'Sim management with real depth.',
    stop_fit: 'Auto-saves between decisions.',
    mood_fit: null,
    time_fit: null,
    session_fit: null,
    library_fit: null,
  },
  time_to_fun: 'quick',
  stop_friendliness: 'anytime',
  subscription_services: ['netflix_games'],
  store_links: { app_store: 'https://x', google_play: 'https://y' },
  match_score: 1,
  in_library: false,
};

const renderCard = (overrides = {}) =>
  render(
    <GameCard
      game={game}
      rank={1}
      onAccept={jest.fn()}
      onAlreadyPlayed={jest.fn()}
      onNotForMe={jest.fn()}
      onSave={jest.fn()}
      {...overrides}
    />
  );

describe('GameCard (1.5.0 refresh)', () => {
  it('renders the CTA before the explanation section (P0.1)', () => {
    const { getByTestId } = renderCard();
    const cta = getByTestId('card-cta');
    const why = getByTestId('card-why');
    // React Test Instance order: compare positions in the rendered tree
    const root = cta.parent.parent;
    const flat = JSON.stringify(root.props?.children ?? '');
    expect(cta).toBeTruthy();
    expect(why).toBeTruthy();
  });

  it('shows the match percent in the title row so it survives scrolling (P0.1)', () => {
    const { getByTestId } = renderCard();
    expect(getByTestId('match-pill')).toHaveTextContent('100% match');
  });

  it('merges commerce into one WHERE TO PLAY section (P0.3)', () => {
    const { getByText, queryByText } = renderCard();
    expect(getByText('WHERE TO PLAY')).toBeTruthy();
    expect(queryByText('Play with subscription')).toBeNull();
    expect(queryByText('Where to buy')).toBeNull();
  });

  it('drops the Jump right in / Stop anytime chips (P0.4)', () => {
    const { queryByText } = renderCard();
    expect(queryByText(/Jump right in|Quick start/)).toBeNull();
    expect(queryByText(/Stop anytime|Flexible/)).toBeNull();
  });

  it('keeps the In your library chip when owned (P0.4)', () => {
    const { getByText } = renderCard({ game: { ...game, in_library: true } });
    expect(getByText('In your library')).toBeTruthy();
  });

  it('labels all three secondary actions (P0.5)', () => {
    const { getByText } = renderCard();
    expect(getByText('Played it')).toBeTruthy();
    expect(getByText('Not for me')).toBeTruthy();
    expect(getByText('Save')).toBeTruthy();
  });

  it('renders at most the bullets the API sent', () => {
    const { getByText } = renderCard();
    expect(getByText('Sim management with real depth.')).toBeTruthy();
    expect(getByText('Auto-saves between decisions.')).toBeTruthy();
  });
});
```

Note on the first test: after Task B3 adds `testID="card-cta"` and `testID="card-why"`, assert order by rendering with `toJSON()` and checking the CTA's index precedes the why-section's index in the serialized output:

```javascript
  it('renders the CTA before the explanation section (P0.1)', () => {
    const { toJSON } = renderCard();
    const s = JSON.stringify(toJSON());
    expect(s.indexOf('card-cta')).toBeGreaterThan(-1);
    expect(s.indexOf('card-why')).toBeGreaterThan(-1);
    expect(s.indexOf('card-cta')).toBeLessThan(s.indexOf('card-why'));
  });
```

Use the `toJSON()` version — it is the reliable one.

- [ ] **Step 2: Run to verify they fail**

```bash
cd C:/Users/ttagu/Projects/PlayNxt/mobile-app && npx jest src/components/__tests__/GameCard.test.js
```
Expected: FAIL (no testIDs, old labels, old sections).

- [ ] **Step 3: Commit the red tests**

```bash
git add mobile-app/src/components/__tests__/GameCard.test.js
git commit -m "test(mobile): GameCard 1.5.0 structure tests (red)"
```

### Task B3: Restructure GameCard render (P0.1, P0.4, elevated visuals)

**Files:**
- Modify: `mobile-app/src/components/GameCard.js` (render: lines ~283–608; styles at bottom)

Reference: the "Elevated" artboard on the mockup canvas (linked in the spec header).

- [ ] **Step 1: Reorder the render** to: thumbnail → header (title + match pill) → description → CTA → why → WHERE TO PLAY → meta (library chip only) → secondary actions.

Concretely:
1. Move the accept `<Pressable>` block (current lines 536–554) to directly after the description `<Text>` (current line 341). Wrap it in a `<View testID="card-cta">`. Replace the outer `Pressable` with `PressableScale` (import it at top: `import PressableScale from './PressableScale';`):

```jsx
        {/* Primary CTA — above the fold (P0.1) */}
        <View testID="card-cta">
          <PressableScale
            style={[styles.acceptButton, (isSwapping || isAccepting) && styles.buttonDisabled]}
            onPress={(isSwapping || isAccepting) ? undefined : onAccept}
            disabled={isSwapping || isAccepting}
            accessibilityLabel="I'll play this"
          >
            <LinearGradient
              colors={(isSwapping || isAccepting) ? ['#888', '#666'] : ['#f857a6', '#ff5858']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.acceptGradient}
            >
              <Ionicons name="game-controller" size={20} color="#ffffff" />
              <Text style={styles.acceptText}>{isAccepting ? 'Saving...' : "I'll play this!"}</Text>
            </LinearGradient>
          </PressableScale>
        </View>
```

2. Move the match badge out of the image overlay (delete lines 326–329, the `matchBadgeOverlay` View) and into the header (lines 332–338), which becomes:

```jsx
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>{game.title}</Text>
            <View style={styles.matchPill} testID="match-pill">
              <Text style={styles.matchPillText}>{matchPercent}% match</Text>
            </View>
          </View>
          <Text style={styles.platforms}>
            {validatedPlatforms.map((p) => PLATFORM_LABELS[p] || p).join(' · ')}
          </Text>
        </View>
```

3. Add the hero scrim inside `thumbnailContainer` (after the Image/placeholder, before the badges):

```jsx
          <LinearGradient
            colors={['transparent', 'rgba(30,30,60,0.55)', '#1e1e3c']}
            locations={[0.45, 0.78, 1]}
            style={styles.heroScrim}
            pointerEvents="none"
          />
```

4. On the why-section container (line 345), add `testID="card-why"`, delete the inner `LinearGradient` (lines 346–351), and remove `mood_fit` from nowhere — keep all field renders (the API now sends at most 2 plus library_fit).

5. Delete the two generic meta tags (lines 386–398, the `time_to_fun` and `stop_friendliness` chips) but KEEP the `metaRow` View and the `in_library` chip (lines 399–404).

- [ ] **Step 2: Update styles** (in the `StyleSheet.create` at the bottom — add new, adjust existing):

```javascript
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
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
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
  },
```

Adjust existing styles: `explanationBox` — remove background/gradient look, use `borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 18, borderLeftWidth: 0` (drop the box background); `title` — add `letterSpacing: -0.5, flexShrink: 1`. Delete now-unused styles (`matchBadgeOverlay`, `matchTextOverlay`, and the `metaTag` styles if no longer referenced — check with a grep before deleting).

- [ ] **Step 3: Run the structure tests**

```bash
cd C:/Users/ttagu/Projects/PlayNxt/mobile-app && npx jest src/components/__tests__/GameCard.test.js
```
Expected: order, match-pill, P0.4 tests pass; WHERE TO PLAY and action-label tests still fail (Tasks B4/B5).

- [ ] **Step 4: Commit**

```bash
git add mobile-app/src/components/GameCard.js
git commit -m "feat(mobile): game card decision block above the fold (P0.1, P0.4)"
```

### Task B4: WHERE TO PLAY ghost chips (P0.3)

**Files:**
- Modify: `mobile-app/src/components/GameCard.js` (replace the Subscription section lines ~407–450 and Store Links section ~452–532 with ONE section)

- [ ] **Step 1: Replace both sections** with a single merged section. Keep the existing handlers exactly (`handleSubscriptionPress` with `generateSubscriptionAffiliateLink` + `trackAffiliateClick`, `handleStorePress` with `generateStoreAffiliateLink` + platform prioritization logic — lift the store-sorting IIFE (lines 460–487) unchanged into the new section):

```jsx
        {/* WHERE TO PLAY — one demoted commerce row (P0.3) */}
        {(game.subscription_services?.length > 0 ||
          (game.store_links && Object.keys(game.store_links).length > 0)) && (
          <View style={styles.whereToPlaySection}>
            <Text style={styles.whereToPlayLabel}>WHERE TO PLAY</Text>
            <View style={styles.whereToPlayChips}>
              {game.subscription_services?.map((service) => {
                const config = SUBSCRIPTION_CONFIG[service] || SUBSCRIPTION_CONFIG.default;
                const affiliateUrl = generateSubscriptionAffiliateLink(service, game.title);
                return (
                  <PressableScale
                    key={service}
                    style={[styles.ghostChip, styles.ghostChipIncluded]}
                    disabled={!affiliateUrl}
                    onPress={async () => {
                      if (affiliateUrl) {
                        trackAffiliateClick('subscription', service, game.game_id, game.title);
                        await Linking.openURL(affiliateUrl);
                      }
                    }}
                    accessibilityLabel={`Play on ${config.name}`}
                  >
                    <View style={styles.includedDot} />
                    <Text style={styles.ghostChipTextIncluded}>{config.name} · included</Text>
                  </PressableScale>
                );
              })}
              {sortedStores.map((store) => {
                const config = STORE_CONFIG[store];
                if (!config) return null;
                const affiliateUrl = generateStoreAffiliateLink(
                  store, game.store_links[store], game.game_id
                );
                return (
                  <PressableScale
                    key={store}
                    style={styles.ghostChip}
                    onPress={async () => {
                      trackAffiliateClick('store', store, game.game_id, game.title);
                      try {
                        await Linking.openURL(affiliateUrl);
                      } catch (err) {
                        Alert.alert('Error', `Could not open ${config.name}.`);
                      }
                    }}
                    accessibilityLabel={`Buy on ${config.name}`}
                  >
                    <Text style={styles.ghostChipText}>{config.name}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        )}
```

`sortedStores` is the existing prioritization logic (current lines 460–487) computed just above the returned JSX in the component body (it uses `game.store_links` and `userPlatforms`, both already in scope), guarded for missing `store_links`:

```javascript
  const availableStores = Object.entries(game.store_links || {})
    .filter(([, url]) => url)
    .map(([store]) => store);
  let prioritizedStores = [];
  let otherStores = [];
  if (userPlatforms && userPlatforms.length > 0) {
    const preferredStoreIds = new Set(
      userPlatforms.flatMap((platform) => PLATFORM_TO_STORES[platform] || [])
    );
    prioritizedStores = availableStores.filter((s) => preferredStoreIds.has(s));
    otherStores = availableStores.filter((s) => !preferredStoreIds.has(s));
  } else {
    prioritizedStores = availableStores;
  }
  const sortedStores = [...prioritizedStores, ...otherStores];
```

- [ ] **Step 2: Add styles**

```javascript
  whereToPlaySection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 18,
    gap: 12,
  },
  whereToPlayLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: '#8a8aa5',
  },
  whereToPlayChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ghostChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  ghostChipIncluded: {
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  includedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
  },
  ghostChipText: {
    fontSize: 13,
    color: '#b8b8c8',
  },
  ghostChipTextIncluded: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dde9e0',
  },
```

Delete now-unused subscription/store chip styles after a grep confirms nothing else references them.

- [ ] **Step 3: Run tests**

```bash
cd C:/Users/ttagu/Projects/PlayNxt/mobile-app && npx jest src/components/__tests__/GameCard.test.js
```
Expected: WHERE TO PLAY test passes; only the action-label test remains red.

- [ ] **Step 4: Commit**

```bash
git add mobile-app/src/components/GameCard.js
git commit -m "feat(mobile): merge commerce into ghost-chip WHERE TO PLAY row (P0.3)"
```

### Task B5: Labeled secondary actions (P0.5) with press feedback (P0.6)

**Files:**
- Modify: `mobile-app/src/components/GameCard.js` (secondary actions, current lines ~557–608)

- [ ] **Step 1: Replace the secondary actions row** — three equal labeled buttons on `PressableScale`; "Played it" loses the resting checkmark (bookmark-check only after tap is handled by parent state; at rest show a plain check icon INSIDE the flow? No — spec P0.5: non-checkmark at rest), "Not for me" gains its label:

```jsx
          {/* Secondary actions — labeled (P0.5) */}
          <View style={styles.secondaryActions}>
            <PressableScale
              style={[styles.secondaryButton, isSwapping && styles.buttonDisabled]}
              onPress={isSwapping ? undefined : onAlreadyPlayed}
              disabled={isSwapping}
              accessibilityLabel="Played it"
            >
              {isSwapping ? (
                <ActivityIndicator color="#a0a0a0" size="small" />
              ) : (
                <>
                  <Ionicons name="game-controller-outline" size={15} color="#c2c2d2" />
                  <Text style={styles.secondaryButtonText}>Played it</Text>
                </>
              )}
            </PressableScale>
            {onNotForMe && (
              <PressableScale
                style={[styles.secondaryButton, styles.notForMeButton, isSwapping && styles.buttonDisabled]}
                onPress={isSwapping ? undefined : onNotForMe}
                disabled={isSwapping}
                accessibilityLabel="Not for me"
              >
                <Ionicons name="thumbs-down-outline" size={15} color="#f89b9b" />
                <Text style={styles.notForMeText}>Not for me</Text>
              </PressableScale>
            )}
            {onSave && (
              <PressableScale
                style={[styles.secondaryButton, styles.saveButton, isSwapping && styles.buttonDisabled]}
                onPress={isSwapping ? undefined : onSave}
                disabled={isSwapping}
                accessibilityLabel="Save"
              >
                <Ionicons name="bookmark-outline" size={15} color="#f5b544" />
                <Text style={styles.saveButtonText}>Save</Text>
              </PressableScale>
            )}
          </View>
```

- [ ] **Step 2: Styles** — replace `alreadyPlayedButton`/`alreadyPlayedIcon`/`alreadyPlayedText` and adjust `notForMeButton`/`saveButton`:

```javascript
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#c2c2d2',
  },
  notForMeButton: {
    borderColor: 'rgba(248,113,113,0.35)',
  },
  notForMeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f89b9b',
  },
  saveButton: {
    borderColor: 'rgba(245,158,11,0.4)',
    backgroundColor: 'rgba(245,158,11,0.05)',
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f5b544',
  },
```

- [ ] **Step 3: Full component test run**

```bash
cd C:/Users/ttagu/Projects/PlayNxt/mobile-app && npx jest src/components/__tests__/GameCard.test.js
```
Expected: all GameCard tests pass.

- [ ] **Step 4: Commit**

```bash
git add mobile-app/src/components/GameCard.js
git commit -m "feat(mobile): labeled secondary actions with press feedback (P0.5, P0.6)"
```

### Task B6: Full-suite verification

- [ ] **Step 1: Run the entire mobile suite** (ResultsScreen/CelebrationModal tests may reference removed labels)

```bash
cd C:/Users/ttagu/Projects/PlayNxt/mobile-app && npx jest
```
Expected: all suites pass (was 22 suites / 176+ tests at 1.3.0; count has grown since). Fix any test that asserted the old card structure — the new structure is the spec.

- [ ] **Step 2: Run the API suite once more**

```bash
cd C:/Users/ttagu/Projects/PlayNxt/api-service && python -m pytest -q
```
Expected: all pass.

- [ ] **Step 3: Visual pass in Expo Go** (layout only; production-artifact verification happens at release)

```bash
cd C:/Users/ttagu/Projects/PlayNxt/mobile-app && npx expo start
```
Check on a 393pt-wide device/emulator: art → title/match → description → CTA all visible without scrolling (P0.1 acceptance); WHERE TO PLAY ghost row; labeled actions; library chip when synced.

- [ ] **Step 4: Commit any test fixes**

```bash
git add -A && git commit -m "test: align suites with 1.5.0 card structure"
```

### Task B7: Finish

- [ ] **Step 1:** Use the superpowers:finishing-a-development-branch skill: push `feature/game-card-refresh`, open a PR titled "Game card refresh (1.5.0): P0.1–P0.6", body referencing docs/GAME-CARD-REFRESH.md and the mockup canvas, noting: Part A is independently deployable (API), Part B ships in the 1.5.0 binary, P1 motion set intentionally deferred, and full production-artifact device verification (runbook pattern) is required before release.

---

## Self-review notes

- Spec coverage: P0.1 (B3 + B6 visual check), P0.2 (A1+A2), P0.3 (B4), P0.4 (B3), P0.5 (B5), P0.6 (B1, applied in B3/B4/B5). P0.1's "match % survives scroll" satisfied by moving the pill into the header (the cheaper option flagged in the spec's open questions). P1 motion set: deliberately excluded, ships as its own plan.
- Open question from spec resolved during planning: explanations ARE assembled purely server-side from per-game Firestore `explanation_templates`; the app renders whatever fields arrive, so nulling non-selected fields caps the live apps too. The Firestore template *data* cleanup (better style_fit/session_fit copy per game) is follow-up seeding work, not in this plan — the blocklist + priority selection handles the worst filler at assembly time.
- `used_bullets` threading: exact current kwargs at the call site (lines 296–302) must be preserved; executor reads before editing.
