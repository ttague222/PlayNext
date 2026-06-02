# Premium Rebuild (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Premium from "remove a rarely-felt ad" into "Smart History + Advanced Filters + sharper picks" — the value tier the MONETIZATION.md doc originally designed.

**Architecture:** Almost entirely additive feature work + UI gating + copy. RevenueCat (lifetime + monthly + yearly) is already fully wired. Backend extends `RecommendationRequest` with optional premium-only fields, extends `_apply_filters` and `_score_games`, and adds a positive-signal history endpoint. Mobile extends `PREMIUM_FEATURES`, gates new advanced filters behind `hasFeature('advancedFilters')`, adds a Smart History section, rewrites the paywall around value, and threads three contextual soft upsells. Free-tier ads unchanged.

**Tech Stack:** Python 3.14 / FastAPI / firebase-admin / pytest (`asyncio_mode = auto`); React Native + Expo SDK 54 / jest.

**Working dirs:** backend from `C:\Users\ttagu\Projects\PlayNxt\api-service`; mobile from `C:\Users\ttagu\Projects\PlayNxt\mobile-app`. All work on a feature branch; commit per task; do not push.

**Spec:** `docs/superpowers/specs/2026-05-31-premium-rebuild-design.md`

---

## Phase 1 — Backend engine + signals endpoint

### Task 1: Extend `RecommendationRequest` with premium fields

The new advanced-filter and Smart-History flags are optional on the request model so all existing free behavior is unchanged. The fields are wired into the engine in Tasks 2–4.

**Files:**
- Modify: `src/models/recommendation.py` (the `RecommendationRequest` class, around lines 38–90)
- Test: `tests/test_models.py` (extend; matches existing conventions)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_models.py`:

```python
def test_recommendation_request_premium_fields_default_to_none():
    """Premium fields must default to None/False so free behavior is unchanged."""
    from src.models import RecommendationRequest, EnergyMood
    req = RecommendationRequest(time_available=30, energy_mood=EnergyMood.CASUAL)
    assert req.stop_friendliness is None
    assert req.time_to_fun is None
    assert req.on_subscriptions is None
    assert req.exclude_played is False
    assert req.favor_history is False


def test_recommendation_request_premium_fields_accept_values():
    from src.models import RecommendationRequest, EnergyMood, StopFriendliness, TimeToFun
    req = RecommendationRequest(
        time_available=30,
        energy_mood=EnergyMood.CASUAL,
        stop_friendliness=StopFriendliness.ANYTIME,
        time_to_fun=TimeToFun.SHORT,
        on_subscriptions=["game_pass"],
        exclude_played=True,
        favor_history=True,
    )
    assert req.stop_friendliness == StopFriendliness.ANYTIME
    assert req.time_to_fun == TimeToFun.SHORT
    assert req.on_subscriptions == ["game_pass"]
    assert req.exclude_played is True
    assert req.favor_history is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_models.py::test_recommendation_request_premium_fields_default_to_none -v`
Expected: FAIL with `AttributeError` on the new attributes.

- [ ] **Step 3: Add the fields**

In `src/models/recommendation.py`, locate the `RecommendationRequest` class. After the existing optional fields (around the `excluded_game_ids` line), add — also add a `from .game import StopFriendliness, TimeToFun` import at the top of the file if not already present:

```python
    # Premium-only advanced filters (default: not applied)
    stop_friendliness: Optional[StopFriendliness] = Field(
        default=None,
        description="Filter by stop-friendliness (premium)."
    )
    time_to_fun: Optional[TimeToFun] = Field(
        default=None,
        description="Filter by time-to-fun (premium)."
    )
    on_subscriptions: Optional[list[str]] = Field(
        default=None,
        description="Only include games on these subscription services (premium)."
    )
    exclude_played: bool = Field(
        default=False,
        description="Hide games the user has accepted/played (premium)."
    )

    # Premium scoring boost (default: off)
    favor_history: bool = Field(
        default=False,
        description="Bias scoring toward genres/moods the user's positive signals favor (premium)."
    )
```

- [ ] **Step 4: Run both new tests to verify pass**

Run: `python -m pytest tests/test_models.py -v -k "premium_fields"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add api-service/src/models/recommendation.py api-service/tests/test_models.py
git commit -m "feat(premium): extend RecommendationRequest with advanced-filter and favor_history fields"
```

---

### Task 2: `_apply_filters` honors `stop_friendliness` / `time_to_fun` / `on_subscriptions`

Three new filters to the existing engine. All are additive, applied after the existing filters, and short-circuit on `None`.

**Files:**
- Modify: `src/services/recommendation_service.py` (the `_apply_filters` method, around lines 197–275)
- Test: `tests/test_recommendation_service.py` (extend `TestRecommendationFiltering`)

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_recommendation_service.py` inside `class TestRecommendationFiltering` (or at the end of the file as standalone tests):

```python
class TestPremiumFilters:
    """Tests for the premium-only advanced filters."""

    @pytest.fixture
    def service(self, mock_firebase):
        from unittest.mock import MagicMock, patch
        with patch('src.services.recommendation_service.get_collection') as mock_get_collection:
            mock_get_collection.side_effect = lambda name: MagicMock()
            from src.services.recommendation_service import RecommendationService
            return RecommendationService()

    @pytest.fixture
    def games(self):
        return [
            {"game_id": "a", "title": "A", "platforms": ["pc"], "time_tags": [30],
             "energy_level": "low", "play_style": ["action"], "genre_tags": [],
             "multiplayer_modes": ["solo"], "stop_friendliness": "anytime",
             "time_to_fun": "short", "subscription_services": ["game_pass"]},
            {"game_id": "b", "title": "B", "platforms": ["pc"], "time_tags": [30],
             "energy_level": "low", "play_style": ["action"], "genre_tags": [],
             "multiplayer_modes": ["solo"], "stop_friendliness": "commitment",
             "time_to_fun": "long", "subscription_services": []},
            {"game_id": "c", "title": "C", "platforms": ["pc"], "time_tags": [30],
             "energy_level": "low", "play_style": ["action"], "genre_tags": [],
             "multiplayer_modes": ["solo"], "stop_friendliness": "checkpoints",
             "time_to_fun": "medium", "subscription_services": ["ps_plus"]},
        ]

    def test_stop_friendliness_filter(self, service, games):
        from src.models import RecommendationRequest, EnergyMood, StopFriendliness
        req = RecommendationRequest(
            time_available=30, energy_mood=EnergyMood.CASUAL,
            stop_friendliness=StopFriendliness.ANYTIME,
        )
        out = service._apply_filters(games, req)
        assert [g["game_id"] for g in out] == ["a"]

    def test_time_to_fun_filter(self, service, games):
        from src.models import RecommendationRequest, EnergyMood, TimeToFun
        req = RecommendationRequest(
            time_available=30, energy_mood=EnergyMood.CASUAL,
            time_to_fun=TimeToFun.SHORT,
        )
        out = service._apply_filters(games, req)
        assert [g["game_id"] for g in out] == ["a"]

    def test_on_subscriptions_filter(self, service, games):
        from src.models import RecommendationRequest, EnergyMood
        req = RecommendationRequest(
            time_available=30, energy_mood=EnergyMood.CASUAL,
            on_subscriptions=["game_pass"],
        )
        out = service._apply_filters(games, req)
        assert [g["game_id"] for g in out] == ["a"]

    def test_no_premium_filters_no_change(self, service, games):
        """When all premium filters are None/False, every game survives."""
        from src.models import RecommendationRequest, EnergyMood
        req = RecommendationRequest(time_available=30, energy_mood=EnergyMood.CASUAL)
        out = service._apply_filters(games, req)
        assert len(out) == 3
```

- [ ] **Step 2: Run the new tests to verify failure**

Run: `python -m pytest tests/test_recommendation_service.py::TestPremiumFilters -v`
Expected: at least the `stop_friendliness`, `time_to_fun`, `on_subscriptions` tests FAIL because the engine doesn't yet apply those filters.

- [ ] **Step 3: Add the three filters to `_apply_filters`**

In `src/services/recommendation_service.py`, find `_apply_filters`. Right before the closing `return filtered` line at the end of the method, insert:

```python
        # Premium filter: stop_friendliness (exact value)
        if request.stop_friendliness:
            filtered = [
                g for g in filtered
                if g.get("stop_friendliness") == request.stop_friendliness.value
            ]

        # Premium filter: time_to_fun (exact value)
        if request.time_to_fun:
            filtered = [
                g for g in filtered
                if g.get("time_to_fun") == request.time_to_fun.value
            ]

        # Premium filter: on_subscriptions (game must be on at least one)
        if request.on_subscriptions:
            wanted = set(request.on_subscriptions)
            filtered = [
                g for g in filtered
                if wanted.intersection(set(g.get("subscription_services") or []))
            ]
```

- [ ] **Step 4: Run tests to verify pass**

Run: `python -m pytest tests/test_recommendation_service.py::TestPremiumFilters -v`
Expected: 4 PASS.

- [ ] **Step 5: Regression check**

Run: `python -m pytest tests/test_recommendation_service.py -q`
Expected: all tests PASS — existing engine tests unaffected because none set these new fields.

- [ ] **Step 6: Commit**

```bash
git add api-service/src/services/recommendation_service.py api-service/tests/test_recommendation_service.py
git commit -m "feat(premium): _apply_filters honors stop_friendliness, time_to_fun, on_subscriptions"
```

---

### Task 3: `exclude_played` filter + extended history fetch

The existing `_get_user_game_history` returns all signals' game_ids. For "hide games I've played" we want the same behavior — any signal counts as interaction — so no method change is needed; we just consume the existing result when `exclude_played=True`.

**Files:**
- Modify: `src/services/recommendation_service.py` (the `_apply_filters` method)
- Modify: `src/services/recommendation_service.py` (the `get_recommendations` entry point — pass user_id-derived history down)
- Test: `tests/test_recommendation_service.py`

- [ ] **Step 1: Write the failing test**

Add this method to `class TestPremiumFilters` in `tests/test_recommendation_service.py`:

```python
    def test_exclude_played_removes_user_history(self, service, games):
        """exclude_played + user_history hides games the user has interacted with."""
        from src.models import RecommendationRequest, EnergyMood
        req = RecommendationRequest(
            time_available=30, energy_mood=EnergyMood.CASUAL,
            exclude_played=True,
        )
        # Pass user_history through the new keyword arg.
        out = service._apply_filters(games, req, user_history={"a", "c"})
        assert [g["game_id"] for g in out] == ["b"]

    def test_exclude_played_off_keeps_all(self, service, games):
        from src.models import RecommendationRequest, EnergyMood
        req = RecommendationRequest(time_available=30, energy_mood=EnergyMood.CASUAL)
        out = service._apply_filters(games, req, user_history={"a", "c"})
        assert len(out) == 3
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_recommendation_service.py::TestPremiumFilters::test_exclude_played_removes_user_history -v`
Expected: FAIL — `_apply_filters` does not accept `user_history`.

- [ ] **Step 3: Extend `_apply_filters` signature + apply the filter**

In `src/services/recommendation_service.py`, change the `_apply_filters` signature to accept a `user_history` parameter (defaulting to `None`):

```python
    def _apply_filters(
        self,
        games: list[dict],
        request: RecommendationRequest,
        strict: bool = True,
        user_history: Optional[set[str]] = None,
    ) -> list[dict]:
```

After the three filters added in Task 2 (and before `return filtered`), add:

```python
        # Premium filter: exclude games the user has interacted with.
        if request.exclude_played and user_history:
            filtered = [g for g in filtered if g.get("game_id") not in user_history]
```

- [ ] **Step 4: Thread `user_history` from `get_recommendations` and `_filter_games`**

Find `_filter_games` (calls `_apply_filters`). Update its signature and its `_apply_filters` calls to take and pass `user_history`:

```python
    async def _filter_games(
        self,
        games: list[dict],
        request: RecommendationRequest,
        user_history: Optional[set[str]] = None,
    ) -> tuple[list[dict], bool, Optional[str]]:
```

Update every `self._apply_filters(games, ...)` call inside `_filter_games` to pass `user_history=user_history`.

Then in `get_recommendations` (the public entry point), fetch the user's history once when needed and pass it into `_filter_games`:

```python
        user_history: Optional[set[str]] = None
        if request.exclude_played and user_id:
            user_history = await self._get_user_game_history(user_id)

        filtered, fallback_applied, fallback_msg = await self._filter_games(
            games, request, user_history=user_history,
        )
```

- [ ] **Step 5: Run tests to verify pass**

Run: `python -m pytest tests/test_recommendation_service.py::TestPremiumFilters -v`
Expected: 6 PASS.

- [ ] **Step 6: Regression check**

Run: `python -m pytest tests/test_recommendation_service.py -q`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add api-service/src/services/recommendation_service.py api-service/tests/test_recommendation_service.py
git commit -m "feat(premium): exclude_played filter wired through _apply_filters and get_recommendations"
```

---

### Task 4: `favor_history` taste-profile scoring boost

Pure function `build_taste_profile(games: list[dict]) -> dict` computes a frequency map of genres + moods from the user's positive-signal games. `_score_games` accepts an optional `taste_profile` and adds a bounded boost. `get_recommendations` builds the profile when `favor_history=True` and a user is signed in.

**Files:**
- Modify: `src/services/recommendation_service.py`
- Test: `tests/test_recommendation_service.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_recommendation_service.py`:

```python
class TestTasteProfile:
    def test_build_taste_profile_counts_genre_and_mood_tags(self):
        from src.services.recommendation_service import build_taste_profile
        games = [
            {"genre_tags": ["indie", "puzzle"], "mood_tags": ["cozy"]},
            {"genre_tags": ["indie"], "mood_tags": ["cozy", "relaxing"]},
        ]
        profile = build_taste_profile(games)
        assert profile["genres"] == {"indie": 2, "puzzle": 1}
        assert profile["moods"] == {"cozy": 2, "relaxing": 1}

    def test_build_taste_profile_empty(self):
        from src.services.recommendation_service import build_taste_profile
        assert build_taste_profile([]) == {"genres": {}, "moods": {}}


class TestFavorHistoryScoring:
    @pytest.fixture
    def service(self, mock_firebase):
        from unittest.mock import MagicMock, patch
        with patch('src.services.recommendation_service.get_collection') as mock_get_collection:
            mock_get_collection.side_effect = lambda name: MagicMock()
            from src.services.recommendation_service import RecommendationService
            return RecommendationService()

    def test_favor_history_boosts_matching_games(self, service):
        """Games whose tags match the taste profile score higher than those that don't."""
        from src.models import RecommendationRequest, EnergyMood
        from unittest.mock import patch

        cozy = {"game_id": "cozy", "title": "Cozy", "platforms": ["pc"], "time_tags": [30],
                "energy_level": "low", "play_style": ["action"], "genre_tags": ["cozy"],
                "mood_tags": ["relaxing"], "stop_friendliness": "anytime",
                "time_to_fun": "short", "multiplayer_modes": ["solo"],
                "subscription_services": []}
        action = {"game_id": "action", "title": "Action", "platforms": ["pc"], "time_tags": [30],
                  "energy_level": "low", "play_style": ["action"], "genre_tags": ["action"],
                  "mood_tags": ["intense"], "stop_friendliness": "anytime",
                  "time_to_fun": "short", "multiplayer_modes": ["solo"],
                  "subscription_services": []}

        req = RecommendationRequest(
            time_available=30, energy_mood=EnergyMood.CASUAL, favor_history=True,
        )
        profile = {"genres": {"cozy": 5}, "moods": {"relaxing": 3}}

        with patch("src.services.recommendation_service.random.uniform", return_value=0.0):
            scored = service._score_games(
                [cozy, action], req, taste_profile=profile,
            )

        cozy_g = next(g for g in scored if g["game_id"] == "cozy")
        action_g = next(g for g in scored if g["game_id"] == "action")
        assert cozy_g["score"] > action_g["score"]

    def test_no_profile_means_no_boost(self, service):
        """Without a profile, scoring is identical to the baseline path."""
        from src.models import RecommendationRequest, EnergyMood
        from unittest.mock import patch

        g = {"game_id": "x", "title": "X", "platforms": ["pc"], "time_tags": [30],
             "energy_level": "low", "play_style": ["action"], "genre_tags": ["indie"],
             "mood_tags": ["cozy"], "stop_friendliness": "anytime",
             "time_to_fun": "short", "multiplayer_modes": ["solo"],
             "subscription_services": []}
        req = RecommendationRequest(time_available=30, energy_mood=EnergyMood.CASUAL)

        with patch("src.services.recommendation_service.random.uniform", return_value=0.0):
            with_profile = service._score_games([g], req, taste_profile=None)
            req2 = RecommendationRequest(
                time_available=30, energy_mood=EnergyMood.CASUAL, favor_history=True,
            )
            still_no_profile = service._score_games([g], req2, taste_profile=None)

        assert with_profile[0]["score"] == still_no_profile[0]["score"]
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_recommendation_service.py::TestTasteProfile tests/test_recommendation_service.py::TestFavorHistoryScoring -v`
Expected: FAIL — `build_taste_profile` not defined and `_score_games` doesn't accept `taste_profile`.

- [ ] **Step 3: Add `build_taste_profile` and the scoring branch**

In `src/services/recommendation_service.py`, near the top of the file (after the existing module-level constants like `MOOD_TO_ENERGY`), add:

```python
def build_taste_profile(games: list[dict]) -> dict:
    """Frequency map of genre_tags and mood_tags across a list of game dicts.

    Pure function so it can be unit-tested without Firestore.
    """
    genres: dict[str, int] = {}
    moods: dict[str, int] = {}
    for g in games or []:
        for t in g.get("genre_tags") or []:
            genres[t] = genres.get(t, 0) + 1
        for t in g.get("mood_tags") or []:
            moods[t] = moods.get(t, 0) + 1
    return {"genres": genres, "moods": moods}
```

In `_score_games`, change the signature and add the scoring branch:

```python
    def _score_games(
        self,
        games: list[dict],
        request: RecommendationRequest,
        taste_profile: Optional[dict] = None,
    ) -> list[dict]:
```

Then, inside the `for game in games:` loop, **after** the existing genre-match boost block and **before** the platform-match boost, add:

```python
            # Premium: favor games matching the user's taste profile (capped).
            if taste_profile and request.favor_history:
                profile_genres = taste_profile.get("genres", {})
                profile_moods = taste_profile.get("moods", {})
                matches = (
                    sum(1 for t in (game.get("genre_tags") or []) if t in profile_genres)
                    + sum(1 for t in (game.get("mood_tags") or []) if t in profile_moods)
                )
                if matches:
                    score += min(matches * 0.05, 0.15)
```

- [ ] **Step 4: Wire profile-building into `get_recommendations`**

In `get_recommendations`, after the user-history fetch added in Task 3, add a parallel "build a taste profile when premium asks for it" block — fetching positive-signal game ids, then their game docs:

```python
        taste_profile: Optional[dict] = None
        if request.favor_history and user_id:
            try:
                from ..models import SignalType
                positive_signal_types = [SignalType.WORKED, SignalType.PLAYED_LOVED, SignalType.ACCEPTED]
                positive_signals = await get_signal_service().get_user_signals(
                    user_id=user_id, signal_types=positive_signal_types, limit=50,
                )
                positive_game_ids = list({s.game_id for s in positive_signals})
                positive_games: list[dict] = []
                for gid in positive_game_ids[:50]:
                    doc = self.games_collection.document(gid).get()
                    if doc.exists:
                        positive_games.append(doc.to_dict())
                taste_profile = build_taste_profile(positive_games)
            except Exception as e:
                logger.warning(f"taste profile build failed: {e}")
                taste_profile = None
```

Then update the existing `_score_games` call inside `get_recommendations` to pass `taste_profile`:

```python
        scored = self._score_games(filtered, request, taste_profile=taste_profile)
```

(Match the exact existing call site — if there are multiple call sites, update them all to pass `taste_profile=taste_profile`.)

Make sure `from ..services import get_signal_service` is imported at the top (it is, via the package init — verify with `python -c "from src.services.recommendation_service import build_taste_profile"`).

- [ ] **Step 5: Run tests to verify pass**

Run: `python -m pytest tests/test_recommendation_service.py::TestTasteProfile tests/test_recommendation_service.py::TestFavorHistoryScoring -v`
Expected: 4 PASS.

- [ ] **Step 6: Regression check**

Run: `python -m pytest tests/test_recommendation_service.py -q`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add api-service/src/services/recommendation_service.py api-service/tests/test_recommendation_service.py
git commit -m "feat(premium): favor_history taste-profile scoring boost"
```

---

### Task 5: `GET /signals/worked` endpoint

Returns positive-signal history (worked / played_loved / accepted) so the mobile Smart History screen has its data source. Auth-required (matches existing `/signals/history`).

**Files:**
- Modify: `src/services/signal_service.py` (add `get_positive_signals`)
- Modify: `src/api/routes_signals.py` (add the route)
- Test: `tests/test_signal_service.py` (extend)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_signal_service.py`:

```python
class TestPositiveSignals:
    @pytest.mark.asyncio
    async def test_get_positive_signals_filters_to_positive_types(self, service, mock_user):
        """Should only return signals of the positive types."""
        from src.models import SignalType
        from unittest.mock import AsyncMock

        # Mock get_user_signals to capture what signal_types it was called with.
        service.get_user_signals = AsyncMock(return_value=[])
        await service.get_positive_signals(user_id=mock_user["uid"], limit=20)

        # Inspect the most-recent call's keyword arguments.
        call_kwargs = service.get_user_signals.call_args.kwargs
        assert call_kwargs["user_id"] == mock_user["uid"]
        assert call_kwargs["limit"] == 20
        assert set(call_kwargs["signal_types"]) == {
            SignalType.WORKED, SignalType.PLAYED_LOVED, SignalType.ACCEPTED,
        }
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_signal_service.py::TestPositiveSignals -v`
Expected: FAIL — `get_positive_signals` not defined.

- [ ] **Step 3: Add the service method**

In `src/services/signal_service.py`, add this method to the `SignalService` class (next to `get_user_signals`):

```python
    async def get_positive_signals(self, user_id: str, limit: int = 50):
        """Return only positive-signal history (worked / played_loved / accepted)."""
        from ..models import SignalType
        return await self.get_user_signals(
            user_id=user_id,
            signal_types=[SignalType.WORKED, SignalType.PLAYED_LOVED, SignalType.ACCEPTED],
            limit=limit,
        )
```

- [ ] **Step 4: Add the route**

In `src/api/routes_signals.py`, after the `get_signal_history` route (the one at `GET /history`), add:

```python
@router.get("/worked", response_model=list[UserSignal])
async def get_positive_signal_history(
    user: dict = Depends(require_authenticated_user),
    limit: int = 50,
):
    """Return only positive-signal history (worked / played_loved / accepted).

    Used by the premium Smart History screen.
    """
    service = get_signal_service()
    return await service.get_positive_signals(user_id=user["uid"], limit=limit)
```

- [ ] **Step 5: Verify**

Run: `python -m pytest tests/test_signal_service.py::TestPositiveSignals -v`
Expected: PASS.

Run: `python -m pytest -q`
Expected: full suite still green.

- [ ] **Step 6: Commit**

```bash
git add api-service/src/services/signal_service.py api-service/src/api/routes_signals.py api-service/tests/test_signal_service.py
git commit -m "feat(premium): GET /signals/worked + signal_service.get_positive_signals"
```

---

## Phase 2 — Mobile premium gating + Smart History

### Task 6: Extend `PREMIUM_FEATURES` + add API client methods

Flips on the two new premium gates and adds the two API client methods the new screens need. Tiny, no UI changes.

**Files:**
- Modify: `mobile-app/src/context/PremiumContext.js`
- Modify: `mobile-app/src/services/api.js`

- [ ] **Step 1: Extend PREMIUM_FEATURES**

In `mobile-app/src/context/PremiumContext.js`, replace:

```js
const PREMIUM_FEATURES = {
  adFree: true,
};
```

with:

```js
const PREMIUM_FEATURES = {
  adFree: true,
  smartHistory: true,
  advancedFilters: true,
};
```

- [ ] **Step 2: Add the API methods**

In `mobile-app/src/services/api.js`, inside the `api` object, in the "Signals & Feedback" section (near `getSignalHistory`), add:

```js
  /**
   * Get positive-signal history (worked / played_loved / accepted) — Smart History
   */
  getPositiveSignals: async (limit = 50) => {
    const response = await apiClient.get('/signals/worked', { params: { limit } });
    return response.data;
  },
```

- [ ] **Step 3: Commit**

```bash
git add mobile-app/src/context/PremiumContext.js mobile-app/src/services/api.js
git commit -m "feat(premium): expose smartHistory + advancedFilters feature gates + Smart History API method"
```

---

### Task 7: Smart History section in `HistoryScreen.js`

Renders a "What's worked for you" section gated by `hasFeature('smartHistory')`. For free users: a teaser card that opens the paywall. For anonymous premium users: a "sign in to unlock" prompt. For signed-in premium users: the list, with a "Find something like this" action per row.

**Files:**
- Modify: `mobile-app/src/screens/HistoryScreen.js`
- Modify: `mobile-app/src/context/RecommendationContext.js` (add a `seedFromGame` helper if not present)

- [ ] **Step 1: Add a `seedFromGame` helper to RecommendationContext**

In `mobile-app/src/context/RecommendationContext.js`, inside the provider's value, add (and export via the existing context):

```js
  /**
   * Seed a new recommendation session from an existing game.
   * Pre-fills the genre and mood preferences from that game's tags
   * and resets the rest. Caller is responsible for navigating.
   */
  const seedFromGame = useCallback((game) => {
    resetPreferences();
    if (game?.genre_tags?.length) {
      updatePreference('genres', game.genre_tags.slice(0, 3));
    }
  }, [resetPreferences, updatePreference]);
```

Add `seedFromGame` to the value object exported by the provider.

- [ ] **Step 2: Render the Smart History section in HistoryScreen**

In `mobile-app/src/screens/HistoryScreen.js`, near the top imports:

```js
import { usePremium } from '../context/PremiumContext';
import { useAuth } from '../context/AuthContext';
import { useRecommendation } from '../context/RecommendationContext';
import api from '../services/api';
import { useEffect, useState } from 'react';
```

Inside the component, add state + a fetch effect:

```js
  const { hasFeature } = usePremium();
  const { user, isAnonymous } = useAuth();
  const { seedFromGame } = useRecommendation();
  const [positiveSignals, setPositiveSignals] = useState([]);
  const [loadingSignals, setLoadingSignals] = useState(false);

  useEffect(() => {
    if (!hasFeature('smartHistory') || isAnonymous || !user) return;
    setLoadingSignals(true);
    api.getPositiveSignals(20)
      .then((data) => setPositiveSignals(data || []))
      .catch(() => setPositiveSignals([]))
      .finally(() => setLoadingSignals(false));
  }, [hasFeature, isAnonymous, user]);
```

Insert a Smart History section in the existing render flow, between the "Collections" and "Recently Added" sections. Three states:
- Not premium → a single teaser card that navigates to `PremiumScreen` on tap.
- Premium but anonymous → a "Sign in to see what's worked for you" card that navigates to `SignIn`.
- Premium + signed in → the actual list (FlatList or `.map`) of `positiveSignals`, each row showing `game_title`, a context line like `"Worked for a {context.time_selected}-min {context.mood_selected} session"`, and a small "Find something like this" button that calls `seedFromGame({genre_tags: ...})` (genre_tags come from the signal context or, if absent, just leave a fallback "Try this again" path that navigates to `PlayHome`).

For the "Find something like this" button: when tapped, call `seedFromGame(...)` and then `navigation.navigate('Main', { screen: 'Play', params: { screen: 'OptionalFilters' } })` to drop the user mid-flow. (Adjust to the project's navigator structure if needed — the goal is "send them to the rec flow with the seeded prefs.")

Provide concrete copy:
- Teaser: "Premium: see what's worked for you and reuse it."
- Anonymous: "Sign in to unlock your history across devices."
- Header: "What's worked for you".

- [ ] **Step 3: Manual verification note**

This task touches a screen we can't unit-test easily. Manually verify in `npx expo start`:
- As a free user, the teaser card appears and tapping it goes to PremiumScreen.
- Toggle `isPremium` (or simulate via the RevenueCat dev menu) — the section behavior changes appropriately.

- [ ] **Step 4: Commit**

```bash
git add mobile-app/src/context/RecommendationContext.js mobile-app/src/screens/HistoryScreen.js
git commit -m "feat(premium): Smart History section in HistoryScreen with seed-from-game action"
```

---

## Phase 3 — Advanced Filters UI

### Task 8: Premium-gated advanced filters in `OptionalFiltersScreen.js`

Adds three filter rows (Stop-friendliness, Time-to-fun, On my subscriptions, Hide games I've played). Free users see them with a lock icon; tapping a locked filter triggers the soft upsell (Task 11). Premium users get real selection.

**Files:**
- Modify: `mobile-app/src/screens/OptionalFiltersScreen.js`
- Modify: `mobile-app/src/context/RecommendationContext.js` (extend the preferences object + the request payload)

- [ ] **Step 1: Extend preferences + request payload**

In `mobile-app/src/context/RecommendationContext.js`, find the initial `preferences` state and the place where the request body is built (search for `time_available` or `energy_mood` to find it). Add the new optional preference keys with default values:

```js
const DEFAULT_PREFERENCES = {
  // ... existing keys ...
  stopFriendliness: null,    // 'anytime' | 'checkpoints' | 'commitment'
  timeToFun: null,           // 'short' | 'medium' | 'long'
  onSubscriptions: [],       // string[]
  excludePlayed: false,
  favorHistory: false,
};
```

Where the API request body is constructed (the existing call to `api.getRecommendations(...)`), thread the new fields when set. Use snake_case for the backend payload:

```js
const requestBody = {
  time_available: preferences.timeAvailable,
  energy_mood: preferences.energyMood,
  // ... existing fields ...
  ...(preferences.stopFriendliness && { stop_friendliness: preferences.stopFriendliness }),
  ...(preferences.timeToFun && { time_to_fun: preferences.timeToFun }),
  ...(preferences.onSubscriptions?.length && { on_subscriptions: preferences.onSubscriptions }),
  ...(preferences.excludePlayed && { exclude_played: true }),
  ...(preferences.favorHistory && { favor_history: true }),
};
```

- [ ] **Step 2: Add the filter rows to OptionalFiltersScreen**

In `mobile-app/src/screens/OptionalFiltersScreen.js`, near the existing filter sections, add a new "Advanced (Premium)" section. Use the existing `<TouchableOpacity>` selection pattern. For each row, render a lock icon when `!hasFeature('advancedFilters')` and intercept the tap:

```jsx
const { hasFeature } = usePremium();
const isPremium = hasFeature('advancedFilters');

const handleLockedTap = () => {
  navigation.navigate('Premium', { source: 'advanced_filters' });
};

// ...

<View style={styles.section}>
  <Text style={styles.sectionTitle}>Advanced {isPremium ? '' : '🔒 Premium'}</Text>

  {/* Stop-friendliness */}
  <Text style={styles.label}>Stop-friendliness</Text>
  <View style={styles.row}>
    {['anytime', 'checkpoints', 'commitment'].map((v) => (
      <TouchableOpacity
        key={v}
        style={[styles.chip, preferences.stopFriendliness === v && styles.chipActive]}
        onPress={() => isPremium ? updatePreference('stopFriendliness', preferences.stopFriendliness === v ? null : v) : handleLockedTap()}
      >
        <Text>{v}</Text>
      </TouchableOpacity>
    ))}
  </View>

  {/* Time-to-fun */}
  <Text style={styles.label}>Time-to-fun</Text>
  <View style={styles.row}>
    {['short', 'medium', 'long'].map((v) => (
      <TouchableOpacity
        key={v}
        style={[styles.chip, preferences.timeToFun === v && styles.chipActive]}
        onPress={() => isPremium ? updatePreference('timeToFun', preferences.timeToFun === v ? null : v) : handleLockedTap()}
      >
        <Text>{v}</Text>
      </TouchableOpacity>
    ))}
  </View>

  {/* On subscriptions (multi-select) */}
  <Text style={styles.label}>Only on my subscriptions</Text>
  <View style={styles.row}>
    {['game_pass', 'ps_plus', 'ea_play', 'nintendo_switch_online'].map((v) => (
      <TouchableOpacity
        key={v}
        style={[styles.chip, preferences.onSubscriptions?.includes(v) && styles.chipActive]}
        onPress={() => {
          if (!isPremium) return handleLockedTap();
          const next = preferences.onSubscriptions?.includes(v)
            ? preferences.onSubscriptions.filter((x) => x !== v)
            : [...(preferences.onSubscriptions || []), v];
          updatePreference('onSubscriptions', next);
        }}
      >
        <Text>{v.replace(/_/g, ' ')}</Text>
      </TouchableOpacity>
    ))}
  </View>

  {/* Hide games I've played */}
  <TouchableOpacity
    style={styles.row}
    onPress={() => isPremium ? updatePreference('excludePlayed', !preferences.excludePlayed) : handleLockedTap()}
  >
    <Text>Hide games I've played</Text>
    <Switch value={preferences.excludePlayed} disabled={!isPremium} />
  </TouchableOpacity>

  {/* Lean on what's worked (premium scoring boost) */}
  <TouchableOpacity
    style={styles.row}
    onPress={() => isPremium ? updatePreference('favorHistory', !preferences.favorHistory) : handleLockedTap()}
  >
    <Text>Lean on what's worked</Text>
    <Switch value={preferences.favorHistory} disabled={!isPremium} />
  </TouchableOpacity>
</View>
```

(Adjust styles to match the existing screen's visual style; the structure above is the contract — match the surrounding section pattern for visuals.)

- [ ] **Step 3: Manual verification note**

Run `npx expo start`. Confirm: free users see a 🔒 Premium label, tapping a row goes to PremiumScreen; flip `isPremium=true` and confirm selections work and persist through to the recommendation request (you can verify by watching the API logs on the backend).

- [ ] **Step 4: Commit**

```bash
git add mobile-app/src/screens/OptionalFiltersScreen.js mobile-app/src/context/RecommendationContext.js
git commit -m "feat(premium): advanced filters UI in OptionalFiltersScreen (locked for free users)"
```

---

## Phase 4 — Paywall + soft upsells + auth gate

### Task 9: Rewrite `PremiumScreen.js` around value

Replace the existing "Premium = ad-free" framing with the value tier. Lead with Smart History + Advanced Filters; ad-free is a secondary bullet. Lifetime one-time is the hero card; monthly/annual are secondary.

**Files:**
- Modify: `mobile-app/src/screens/PremiumScreen.js`

- [ ] **Step 1: Update the feature list copy**

Replace the existing three-bullet value props in `PremiumScreen.js` with:

```js
const PREMIUM_FEATURES_DISPLAY = [
  {
    icon: 'time-outline',
    title: 'Smart History',
    body: "See what's worked for you, with the context it worked in. Reuse a good fit with one tap.",
  },
  {
    icon: 'options-outline',
    title: 'Advanced Filters',
    body: 'Filter by stop-friendliness, time-to-fun, your subscriptions, and hide what you\'ve played.',
  },
  {
    icon: 'sparkles-outline',
    title: 'Sharper Picks',
    body: 'When enabled, recommendations lean on what\'s worked for you in the past.',
  },
  {
    icon: 'sync-outline',
    title: 'Cross-Device Sync',
    body: 'Sign in once — your history and saved games follow you everywhere.',
  },
  {
    icon: 'remove-circle-outline',
    title: 'No Ads',
    body: 'Skip the rewarded ad on rerolls. Pure flow.',
  },
];
```

Render them with the existing styled list (the file uses `Ionicons` already). Keep the hero card structure intact, but change the headline copy to lead with value:

```js
<Text style={styles.heroTitle}>Sharper picks. Yours forever.</Text>
<Text style={styles.heroSubtitle}>
  Save what works. Filter exactly. Recommendations that learn from you.
</Text>
```

- [ ] **Step 2: Make lifetime the hero, subs the alternative**

In the package-selection UI, find the part that renders monthly/annual/lifetime cards. Promote lifetime to a larger primary card with a "Best Value — yours forever" badge; render monthly/annual as smaller secondary cards below. Use existing helpers (`getPackageByType('lifetime')`, etc.) — the data is already there.

- [ ] **Step 3: Manual verification**

Run `npx expo start`. Open the Premium screen. Confirm copy + hierarchy match the new structure.

- [ ] **Step 4: Commit**

```bash
git add mobile-app/src/screens/PremiumScreen.js
git commit -m "feat(premium): paywall rewrites around Smart History + Advanced Filters, lifetime as hero"
```

---

### Task 10: Three soft-upsell trigger points

Per the spec: locked-filter tap (already wired in Task 8), opening Smart History when not premium (already wired in Task 7), and a gentle prompt after a "this worked for me" signal. This task wires the third one.

**Files:**
- Modify: `mobile-app/src/utils/pushPrompt.js` (or a new `mobile-app/src/utils/upsellPrompt.js` to keep concerns separate)
- Create: `mobile-app/src/utils/upsellPrompt.js`
- Create: `mobile-app/src/utils/__tests__/upsellPrompt.test.js`
- Modify: wherever the "worked" signal is submitted (search for `SignalType.WORKED` or `'worked'` in mobile)

- [ ] **Step 1: Write the failing test for the gating helper**

Create `mobile-app/src/utils/__tests__/upsellPrompt.test.js`:

```js
import { shouldShowWorkedUpsell, COOLDOWN_DAYS } from '../upsellPrompt';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe('shouldShowWorkedUpsell', () => {
  it('shows when not premium and never shown', () => {
    expect(shouldShowWorkedUpsell({ isPremium: false, lastShownAt: null, now: Date.now() })).toBe(true);
  });
  it('does not show for premium users', () => {
    expect(shouldShowWorkedUpsell({ isPremium: true, lastShownAt: null, now: Date.now() })).toBe(false);
  });
  it('respects the cooldown', () => {
    const now = Date.now();
    expect(shouldShowWorkedUpsell({ isPremium: false, lastShownAt: now - (COOLDOWN_DAYS - 1) * ONE_DAY_MS, now })).toBe(false);
    expect(shouldShowWorkedUpsell({ isPremium: false, lastShownAt: now - (COOLDOWN_DAYS + 1) * ONE_DAY_MS, now })).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (from `mobile-app`): `npx jest src/utils/__tests__/upsellPrompt.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `mobile-app/src/utils/upsellPrompt.js`:

```js
export const UPSELL_LAST_SHOWN_KEY = '@playnxt_worked_upsell_last_shown';
export const COOLDOWN_DAYS = 14;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Gentle upsell after a "this worked for me" signal:
 * - Not shown to premium users.
 * - Shown at most once per COOLDOWN_DAYS.
 */
export function shouldShowWorkedUpsell({ isPremium, lastShownAt, now }) {
  if (isPremium) return false;
  if (!lastShownAt) return true;
  return now - lastShownAt >= COOLDOWN_DAYS * ONE_DAY_MS;
}
```

- [ ] **Step 4: Verify the test passes**

Run: `npx jest src/utils/__tests__/upsellPrompt.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire the prompt where "worked" is submitted**

Find where the user picks "This worked for me" in the mobile app — likely in `AlreadyPlayedModal.js` or in a feedback handler in `ResultsScreen.js`. Search:
`grep -rn "SignalType\.WORKED\|'worked'" src/`

At the point right after the `worked` signal is successfully submitted, call:

```js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { shouldShowWorkedUpsell, UPSELL_LAST_SHOWN_KEY } from '../utils/upsellPrompt';
import { useNavigation } from '@react-navigation/native';

async function maybeShowWorkedUpsell(isPremium, navigation) {
  try {
    const last = await AsyncStorage.getItem(UPSELL_LAST_SHOWN_KEY);
    const lastShownAt = last ? Number(last) : null;
    if (!shouldShowWorkedUpsell({ isPremium, lastShownAt, now: Date.now() })) return;
    await AsyncStorage.setItem(UPSELL_LAST_SHOWN_KEY, String(Date.now()));
    Alert.alert(
      'Want sharper picks?',
      "Save what works and let recommendations learn from your history. Tap below to see how.",
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'See how', onPress: () => navigation.navigate('Premium', { source: 'worked_signal' }) },
      ],
    );
  } catch {
    // Non-blocking.
  }
}
```

Call `maybeShowWorkedUpsell(isPremium, navigation)` right after the worked submission succeeds.

- [ ] **Step 6: Commit**

```bash
git add mobile-app/src/utils/upsellPrompt.js "mobile-app/src/utils/__tests__/upsellPrompt.test.js" mobile-app/src/components/AlreadyPlayedModal.js mobile-app/src/screens/ResultsScreen.js
git commit -m "feat(premium): gentle upsell after 'worked' signal (cooldown-gated)"
```

(Stage only the files you actually modified.)

---

### Task 11: Auth gate for Smart History

The Smart History fetch in Task 7 already short-circuits when `isAnonymous`. This task makes the "Sign in to unlock your history" card actually navigate, and ensures purchases by anonymous users still work (RevenueCat restores on login).

**Files:**
- Modify: `mobile-app/src/screens/HistoryScreen.js`

- [ ] **Step 1: Confirm the anonymous branch navigates**

In the Smart History section added in Task 7, ensure the "Sign in to unlock..." card has:

```jsx
<TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
  {/* ... */}
</TouchableOpacity>
```

If not, add it.

- [ ] **Step 2: Manual verification**

Verify the flow on a device: as an anonymous premium user (force-set `isPremium=true` in dev), the card appears and tapping it opens the sign-in modal. After sign-in, the section populates.

- [ ] **Step 3: Commit (only if changes made)**

```bash
git add mobile-app/src/screens/HistoryScreen.js
git commit -m "feat(premium): Smart History sign-in card navigates to SignIn"
```

---

## Phase 5 — Final verification + merge

### Task 12: Full regression check + merge

- [ ] **Step 1: Run the backend suite**

Run (from `api-service/`): `python -m pytest -q`
Expected: all PASS, including all new TestPremiumFilters / TestTasteProfile / TestFavorHistoryScoring / TestPositiveSignals.

- [ ] **Step 2: Run the mobile jest suite**

Run (from `mobile-app/`): `npx jest`
Expected: all PASS (pushPrompt + new upsellPrompt tests).

- [ ] **Step 3: Manual smoke test (Expo dev)**

`npx expo start`. As a free user:
- Open Library → see Smart History teaser → tap → PremiumScreen opens.
- Open Filters → see Advanced section with 🔒 → tap a locked row → PremiumScreen opens with `source=advanced_filters`.
- Accept a recommendation, then submit "This worked for me" → see the cooldown-gated upsell.

Flip `isPremium=true` (dev menu or `ENABLE_REVENUECAT=false` + fake) and verify:
- Smart History section populates (after sign-in).
- Advanced filters become tappable and pass through to the backend (watch API logs).
- favor_history toggle produces visibly different recommendations vs. off.

- [ ] **Step 4: Merge to main**

```bash
git checkout main
git merge --ff-only premium-rebuild
git branch -d premium-rebuild
```

(Push only if explicitly requested.)

---

## Notes on commits & deployment
- All commit steps assume the user has approved committing on a feature branch (no push). The standing rule is to branch off main, never commit to main directly.
- Backend changes are additive — existing free behavior is unchanged because all new request fields default to None/False, all new `_apply_filters` filters short-circuit on falsy values, and `_score_games` ignores `taste_profile=None`.
- No Firestore schema changes. No new collections. No new credentials.
- The premium purchase plumbing is already wired (RevenueCat lifetime + subs). This work only adds the *value* gated behind that purchase.
