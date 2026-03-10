# Three Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three bugs identified by the PM agent: missing post-accept feedback UI wiring, anonymous user staleness protection gap, and non-deterministic recommendation scoring.

**Architecture:** Two Python fixes in `api-service/src/services/recommendation_service.py` (with tests in `api-service/tests/test_recommendation_service.py`), and one React Native fix in `mobile-app/src/screens/ResultsScreen.js`. Each fix is fully independent.

**Tech Stack:** Python 3.11 / pytest / FastAPI (bugs 2 & 3), React Native / Jest (bug 1).

---

## Chunk 1: Fix non-deterministic scoring (Bug 3)

Root cause: `random.uniform(0, 0.3)` added to every game score at line 356–357 of `recommendation_service.py` can override the full deterministic heuristic ranking, violating PRD Principle #8.

Fix: Remove the random component. The franchise diversity logic already ensures variety in results.

### Task 1: Remove random scoring noise and add determinism test

**Files:**
- Modify: `api-service/src/services/recommendation_service.py:353-357`
- Test: `api-service/tests/test_recommendation_service.py`

- [ ] **Step 1: Write the failing test**

Open `api-service/tests/test_recommendation_service.py`. Add this test to the `TestRecommendationService` class (or at the module level if no such class exists):

```python
def test_scoring_is_deterministic():
    """Scoring must produce the same ranking every call (PRD Principle #8)."""
    from src.services.recommendation_service import RecommendationService

    service = RecommendationService.__new__(RecommendationService)

    games = [
        {
            "game_id": "game-a",
            "stop_friendliness": "anytime",
            "time_to_fun": "short",
            "energy_level": "low",
            "play_style": ["action"],
            "platforms": ["pc"],
            "subscription_services": ["game_pass"],
        },
        {
            "game_id": "game-b",
            "stop_friendliness": "commitment",
            "time_to_fun": "long",
            "energy_level": "high",
            "play_style": ["narrative"],
            "platforms": ["playstation"],
            "subscription_services": [],
        },
    ]

    request = RecommendationRequest(
        time_available=30,
        mood=EnergyMood.WIND_DOWN,
    )

    results_1 = service._score_games(games, request)
    results_2 = service._score_games(games, request)

    scores_1 = {g["game_id"]: g["score"] for g in results_1}
    scores_2 = {g["game_id"]: g["score"] for g in results_2}

    assert scores_1 == scores_2, (
        "Scoring must be deterministic. Same input must produce same scores. "
        "If this fails, random noise is still present in _score_games."
    )
    # game-a must outscore game-b: anytime stop + short time-to-fun + mood match
    assert scores_1["game-a"] > scores_1["game-b"], (
        "game-a has better heuristic match and must score higher than game-b"
    )
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd api-service
python -m pytest tests/test_recommendation_service.py::test_scoring_is_deterministic -v
```

Expected: FAIL — scores will differ between the two calls due to `random.uniform`.

- [ ] **Step 3: Remove the random boost from `_score_games`**

In `api-service/src/services/recommendation_service.py`, find lines 353–357:

```python
            # Add randomness factor (0-0.3) to introduce variety
            # This ensures games with similar scores get shuffled
            # Using a larger range to overcome score similarities
            random_boost = random.uniform(0, 0.3)
            score += random_boost
```

Delete those 5 lines entirely.

Note: `import random` must stay. `random.shuffle(games)` at line 295 still uses it (franchise diversity logic), and `random.uniform(-0.08, 0.08)` in `_apply_surprise_boost` is intentional for Surprise Me mode. Only the `random_boost` lines (353–357) are removed.

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd api-service
python -m pytest tests/test_recommendation_service.py::test_scoring_is_deterministic -v
```

Expected: PASS

- [ ] **Step 5: Run the full test suite to confirm no regressions**

```bash
cd api-service
python -m pytest tests/ -v
```

Expected: All existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add api-service/src/services/recommendation_service.py api-service/tests/test_recommendation_service.py
git commit -m "fix: remove random scoring noise to restore deterministic recommendations (PRD #8)"
```

---

## Chunk 2: Fix anonymous staleness protection (Bug 2)

Root cause: `_filter_games` only calls `_get_recently_shown` when `user_id` is present (line 153). Anonymous users (majority of users) see repeated games across sessions.

Fix: Add `_get_recently_shown_for_session(session_id)` that queries signals by `session_id`, and call it when `user_id` is absent but `session_id` is present.

### Task 2: Add session-based staleness protection for anonymous users

**Files:**
- Modify: `api-service/src/services/recommendation_service.py:152-156` and `api-service/src/services/recommendation_service.py:475-506`
- Test: `api-service/tests/test_recommendation_service.py`

- [ ] **Step 1: Write the failing test**

Add this test to `api-service/tests/test_recommendation_service.py`:

```python
@pytest.mark.asyncio
async def test_anonymous_users_get_staleness_protection():
    """
    Anonymous users (no user_id) must have recently-shown games excluded
    when a session_id is provided, to prevent repeat recommendations.
    PRD §5.5: deprioritize games shown in last 7 days.
    """
    from src.services.recommendation_service import RecommendationService
    from unittest.mock import AsyncMock, MagicMock, patch

    service = RecommendationService.__new__(RecommendationService)

    # Simulate: session already showed "game-seen"
    async def fake_get_recently_shown_for_session(session_id):
        return {"game-seen"}

    service._get_recently_shown_for_session = fake_get_recently_shown_for_session
    service._get_recently_shown = AsyncMock(return_value=set())

    games = [
        {"game_id": "game-seen", "stop_friendliness": "anytime", "time_to_fun": "short",
         "energy_level": "low", "play_style": ["action"], "platforms": ["pc"],
         "time_tags": [30], "multiplayer_modes": ["solo"], "subscription_services": []},
        {"game_id": "game-fresh", "stop_friendliness": "anytime", "time_to_fun": "short",
         "energy_level": "low", "play_style": ["action"], "platforms": ["pc"],
         "time_tags": [30], "multiplayer_modes": ["solo"], "subscription_services": []},
    ]

    request = RecommendationRequest(
        time_available=30,
        mood=EnergyMood.WIND_DOWN,
        session_id="anon-session-123",
    )

    filtered, _, _ = await service._filter_games(games, request, user_id=None)
    result_ids = [g["game_id"] for g in filtered]

    assert "game-seen" not in result_ids, (
        "game-seen was recently shown in this session and must be excluded for anonymous users"
    )
    assert "game-fresh" in result_ids, "game-fresh was not recently shown and must still appear"
    # _get_recently_shown (user-based) must NOT have been called — no user_id
    service._get_recently_shown.assert_not_called()
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd api-service
python -m pytest tests/test_recommendation_service.py::test_anonymous_users_get_staleness_protection -v
```

Expected: FAIL — anonymous users currently get no staleness protection.

- [ ] **Step 3: Add `_get_recently_shown_for_session` method**

In `api-service/src/services/recommendation_service.py`, directly after the `_get_recently_shown` method (after line 506), add:

```python
    async def _get_recently_shown_for_session(self, session_id: str) -> set[str]:
        """Get games shown in the current anonymous session (no user account)."""
        try:
            docs = list(
                self.signals_collection
                .where("session_id", "==", session_id)
                .stream()
            )
            return {doc.to_dict().get("game_id") for doc in docs if doc.to_dict().get("game_id")}
        except Exception as e:
            logger.error(f"Error fetching session signals: {e}")
            return set()
```

- [ ] **Step 4: Update `_filter_games` to call the new method for anonymous users**

In `api-service/src/services/recommendation_service.py`, find lines 152–156:

```python
        # Get recently shown games for user (from history)
        if user_id:
            recent = await self._get_recently_shown(user_id)
            excluded.update(recent)
            logger.info(f"User {user_id}: Excluding {len(recent)} games from history: {recent}")
```

Replace with:

```python
        # Get recently shown games to prevent staleness
        if user_id:
            recent = await self._get_recently_shown(user_id)
            excluded.update(recent)
            logger.info(f"User {user_id}: Excluding {len(recent)} recently shown games")
        elif request.session_id:
            recent = await self._get_recently_shown_for_session(request.session_id)
            excluded.update(recent)
            logger.info(f"Session {request.session_id}: Excluding {len(recent)} recently shown games")
```

- [ ] **Step 5: Run the test to confirm it passes**

```bash
cd api-service
python -m pytest tests/test_recommendation_service.py::test_anonymous_users_get_staleness_protection -v
```

Expected: PASS

- [ ] **Step 6: Run the full test suite to confirm no regressions**

```bash
cd api-service
python -m pytest tests/ -v
```

Expected: All existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add api-service/src/services/recommendation_service.py api-service/tests/test_recommendation_service.py
git commit -m "fix: add session-based staleness protection for anonymous users (PRD §5.5)"
```

---

## Chunk 3: Wire FeedbackModal after acceptance (Bug 1)

Root cause: `FeedbackModal` exists at `mobile-app/src/components/FeedbackModal.js` with props `{ visible, game, onSubmit, onClose }`, but is not imported in `ResultsScreen.js`. `handleCelebrationDismiss` navigates directly to 'PlayHome' instead of showing the feedback modal first.

`submitFeedback(gameId, signalType, sessionId, context)` is available from `useRecommendation()` context but is not currently destructured in ResultsScreen.

Fix:
1. Import `FeedbackModal`
2. Add `showFeedback` state
3. Destructure `submitFeedback` from `useRecommendation()`
4. Change `handleCelebrationDismiss` to show the feedback modal instead of navigating
5. Add `handleFeedbackSubmit` (submits signal, then navigates) and `handleFeedbackClose` (navigates without signal)
6. Render `FeedbackModal` in JSX

### Task 3: Wire FeedbackModal into post-acceptance flow

**Files:**
- Modify: `mobile-app/src/screens/ResultsScreen.js`
- Create: `mobile-app/src/components/__tests__/FeedbackModal.test.js`

- [ ] **Step 1: Write the FeedbackModal contract test**

Create `mobile-app/src/components/__tests__/FeedbackModal.test.js`:

```javascript
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import FeedbackModal from '../FeedbackModal';

const mockGame = { game_id: 'game-1', title: 'Test Game', description_short: 'A test game' };

describe('FeedbackModal', () => {
  it('calls onSubmit with "worked" when "This worked for me" is pressed', () => {
    const onSubmit = jest.fn();
    const { getByText } = render(
      <FeedbackModal visible={true} game={mockGame} onSubmit={onSubmit} onClose={jest.fn()} />
    );
    fireEvent.press(getByText('This worked for me'));
    expect(onSubmit).toHaveBeenCalledWith('worked');
  });

  it('calls onSubmit with "not_good_fit" when "Not a good fit" is pressed', () => {
    const onSubmit = jest.fn();
    const { getByText } = render(
      <FeedbackModal visible={true} game={mockGame} onSubmit={onSubmit} onClose={jest.fn()} />
    );
    fireEvent.press(getByText('Not a good fit'));
    expect(onSubmit).toHaveBeenCalledWith('not_good_fit');
  });

  it("calls onClose when \"I'll give feedback later\" is pressed", () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <FeedbackModal visible={true} game={mockGame} onSubmit={jest.fn()} onClose={onClose} />
    );
    fireEvent.press(getByText("I'll give feedback later"));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to confirm it passes**

```bash
cd mobile-app
npx jest src/components/__tests__/FeedbackModal.test.js -v
```

Expected: PASS — the component is already fully implemented. This locks down the API contract *before* wiring it up.

> **TDD note:** This component test is the regression guard. If the wiring in ResultsScreen ever passes the wrong signal type (e.g., `'thumbs_up'` instead of `'worked'`), this test will catch it. Integration verification (that ResultsScreen actually shows FeedbackModal at all) is confirmed via grep in Step 8.

- [ ] **Step 3: Add `FeedbackModal` import**

In `mobile-app/src/screens/ResultsScreen.js`, after line 28 (`import FeatureCallout from '../components/FeatureCallout';`), add:

```javascript
import FeedbackModal from '../components/FeedbackModal';
```

- [ ] **Step 4: Destructure `submitFeedback` from `useRecommendation()`**

In `ResultsScreen.js`, the `useRecommendation()` destructure starts at line 32. Add `submitFeedback` to it:

```javascript
  const {
    recommendations,
    loading,
    error,
    fallbackApplied,
    fallbackMessage,
    reroll,
    acceptRecommendation,
    markAsPlayedAndSwap,
    submitFeedback,   // ADD THIS LINE
    preferences,
  } = useRecommendation();
```

- [ ] **Step 5: Add `showFeedback` state variable**

After the existing state declarations (after line 66: `const [showRerollCallout, setShowRerollCallout] = useState(false);`), add:

```javascript
  const [showFeedback, setShowFeedback] = useState(false);
```

- [ ] **Step 6: Replace `handleCelebrationDismiss` with feedback-aware version**

Find the existing `handleCelebrationDismiss` at line 242:

```javascript
  const handleCelebrationDismiss = () => {
    setShowCelebration(false);
    navigation.navigate('PlayHome');
  };
```

Replace it with:

```javascript
  const handleCelebrationDismiss = () => {
    setShowCelebration(false);
    setShowFeedback(true);
  };

  const handleFeedbackSubmit = async (signalType) => {
    if (selectedGame) {
      try {
        await submitFeedback(selectedGame.game_id, signalType);
      } catch (err) {
        // Non-blocking: feedback failure should not interrupt the user
      }
    }
    setShowFeedback(false);
    navigation.navigate('PlayHome');
  };

  const handleFeedbackClose = () => {
    setShowFeedback(false);
    navigation.navigate('PlayHome');
  };
```

- [ ] **Step 7: Add `FeedbackModal` to JSX**

In `ResultsScreen.js`, after the `CelebrationModal` block (after line 419: `/>`), add:

```javascript
        {/* Post-acceptance Feedback Modal */}
        <FeedbackModal
          visible={showFeedback}
          game={selectedGame}
          onSubmit={handleFeedbackSubmit}
          onClose={handleFeedbackClose}
        />
```

- [ ] **Step 8: Verify the changes look correct**

Run a quick grep to confirm all pieces are in place:

```bash
cd mobile-app
grep -n "FeedbackModal\|showFeedback\|handleFeedbackSubmit\|handleFeedbackClose\|submitFeedback" src/screens/ResultsScreen.js
```

Expected output: lines covering the import, state declaration, three handler functions, and the JSX render — at minimum 6–8 matching lines.

- [ ] **Step 9: Run the full mobile test suite to confirm no regressions**

```bash
cd mobile-app
npx jest 2>&1 | tail -20
```

Expected: All tests pass, including the new FeedbackModal contract test.

- [ ] **Step 10: Commit**

```bash
git add mobile-app/src/screens/ResultsScreen.js mobile-app/src/components/__tests__/FeedbackModal.test.js
git commit -m "fix: wire FeedbackModal after recommendation acceptance (PRD §8.2)"
```

---

## Final Verification

- [ ] `test_scoring_is_deterministic` passes
- [ ] `test_anonymous_users_get_staleness_protection` passes
- [ ] Full Python test suite passes: `cd api-service && python -m pytest tests/ -v`
- [ ] Full mobile test suite passes: `cd mobile-app && npx jest`
- [ ] `ResultsScreen.js` contains: import FeedbackModal, showFeedback state, handleFeedbackSubmit, handleFeedbackClose, FeedbackModal JSX
- [ ] `random.uniform` no longer appears in `recommendation_service.py`
- [ ] `_get_recently_shown_for_session` exists in `recommendation_service.py`
- [ ] The `elif request.session_id:` branch exists in `_filter_games`
