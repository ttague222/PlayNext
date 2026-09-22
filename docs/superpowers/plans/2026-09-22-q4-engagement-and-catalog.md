# PlayNxt 1.4.0 Q4 Engagement & Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 1.4.0 bundle — post-update changelog modal, Coming Soon section with an unreleased-games recommendation exclusion, lightweight thumbs ratings, and the fall 2026 catalog batch — plus an independent monthly new-release candidate pipeline.

**Architecture:** Backend work extends the existing FastAPI service (Pydantic model field, pure-function helpers, thin routes over services, Firestore via `get_collection`). Mobile work follows the app's screen/service/context conventions (all API calls in `services/api.js`, styles at file bottom, arrow-function screens). The candidate pipeline is a standalone script + GitHub Actions workflow modeled on `subscription-refresh.yml` that opens a PR — it never writes to Firestore.

**Tech Stack:** Python 3.11 / FastAPI / Firestore / pytest · React Native / Expo / jest · GitHub Actions · RAWG API

**Spec:** `docs/superpowers/specs/2026-09-22-q4-engagement-and-catalog-design.md`

**Conventions reminders (from `PlayNxt/CLAUDE.md`):**
- Route handlers are thin; business logic in `src/services/`; explicit `response_model=` on every endpoint; `logger`, never `print()`.
- Screens: arrow-function consts, `useNavigation()`, styles at bottom, API calls only through `services/api.js`.
- Run backend tests from `api-service/`: `python -m pytest tests/ -v` (190 passing before this plan). Mobile: `cd mobile-app && npx jest` (176 passing).
- Working branch: create `feature/1-4-0-engagement` off `main` before Task 1 (the repo may be on another branch; do not build on `android-r8-release-builds`).

---

## Part A — Backend (api-service)

### Task 1: `release_date` field + `is_released` helper

The catalog gains an optional ISO `release_date` ("YYYY-MM-DD" string — lexicographic order == chronological order, Firestore-queryable). A pure helper decides released vs upcoming.

**Files:**
- Modify: `api-service/src/models/game.py` (GameBase, GameSummary)
- Modify: `api-service/src/services/game_service.py` (module-level helper)
- Test: `api-service/tests/test_games.py`

- [ ] **Step 1: Write the failing tests**

Append to `api-service/tests/test_games.py`:

```python
from datetime import date

from src.services.game_service import is_released


class TestIsReleased:
    def test_no_release_date_counts_as_released(self):
        assert is_released(None, today=date(2026, 9, 22)) is True
        assert is_released("", today=date(2026, 9, 22)) is True

    def test_past_date_is_released(self):
        assert is_released("2026-09-01", today=date(2026, 9, 22)) is True

    def test_release_day_is_released(self):
        assert is_released("2026-09-22", today=date(2026, 9, 22)) is True

    def test_future_date_is_not_released(self):
        assert is_released("2026-10-15", today=date(2026, 9, 22)) is False

    def test_malformed_date_counts_as_released(self):
        # Bad data must never hide a game from the engine.
        assert is_released("soon", today=date(2026, 9, 22)) is True


def test_game_summary_accepts_release_date():
    from src.models import GameSummary
    s = GameSummary(
        game_id="g1", title="T", platforms=["pc"], description_short="d",
        time_to_fun="short", stop_friendliness="anytime",
        release_date="2026-11-05",
    )
    assert s.release_date == "2026-11-05"


def test_game_summary_release_date_optional():
    from src.models import GameSummary
    s = GameSummary(
        game_id="g1", title="T", platforms=["pc"], description_short="d",
        time_to_fun="short", stop_friendliness="anytime",
    )
    assert s.release_date is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `api-service/`): `python -m pytest tests/test_games.py -v`
Expected: FAIL — `ImportError: cannot import name 'is_released'`.

- [ ] **Step 3: Implement**

In `api-service/src/models/game.py`, add to `GameBase` (after the `fun_fact` field):

```python
    release_date: Optional[str] = Field(
        default=None,
        description="ISO release date (YYYY-MM-DD). Future date = upcoming, excluded from recommendations.",
    )
```

Add the same field to `GameSummary` (after `stop_friendliness`):

```python
    release_date: Optional[str] = None
```

In `api-service/src/services/game_service.py`, add after the `logger` line (module level — imports of `date` come from extending the existing `datetime` import line):

```python
def is_released(release_date, today=None):
    """True unless release_date is a valid future ISO date.

    Missing/malformed dates count as released — bad data must never hide
    a game from the engine (PRD §5.6: results must never be empty).
    """
    if not release_date:
        return True
    today = today or datetime.now(timezone.utc).date()
    try:
        parsed = datetime.strptime(release_date, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return True
    return parsed <= today
```

(`datetime`, `timezone` are already imported at the top of the file.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_games.py tests/test_models.py -v`
Expected: PASS (including pre-existing tests).

- [ ] **Step 5: Commit**

```bash
git add src/models/game.py src/services/game_service.py tests/test_games.py
git commit -m "feat: add release_date field and is_released helper"
```

---

### Task 2: Engine never recommends unreleased games

**Files:**
- Modify: `api-service/src/services/recommendation_service.py` (`_filter_games`, around line 382 "Remove excluded games")
- Test: `api-service/tests/test_recommendation_service.py`

- [ ] **Step 1: Write the failing test**

Append to `api-service/tests/test_recommendation_service.py` (this file's existing tests build a service instance — mirror how its `service` fixture is constructed; the filter test calls `_filter_games` directly):

```python
class TestUnreleasedExclusion:
    """Games with a future release_date must never be recommended (spec: Coming Soon)."""

    @pytest.mark.asyncio
    async def test_filter_games_drops_unreleased(self, service, sample_games):
        from src.models import RecommendationRequest
        games = [dict(g) for g in sample_games]
        games[0]["release_date"] = "2099-01-01"   # far future — always upcoming
        games[1]["release_date"] = "2020-01-01"   # long released
        # games[2] has no release_date — treated as released
        request = RecommendationRequest(available_time=30, mood="casual")
        filtered, _, _ = await service._filter_games(games, request, user_id=None)
        ids = {g["game_id"] for g in filtered}
        assert games[0]["game_id"] not in ids
        assert games[1]["game_id"] in ids
        assert games[2]["game_id"] in ids
```

Note: match the `RecommendationRequest` constructor arguments used by this file's existing tests (field names for time/mood may differ — copy from a neighboring test, e.g. `test_score_games_stop_friendliness`). If existing tests build requests differently, use their exact shape.

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_recommendation_service.py::TestUnreleasedExclusion -v`
Expected: FAIL — unreleased game present in filtered results.

- [ ] **Step 3: Implement**

In `api-service/src/services/recommendation_service.py`:

Add to the imports near the top of the file (with the other service imports):

```python
from .game_service import is_released
```

In `_filter_games`, immediately BEFORE the `# Remove excluded games` block (line ~382), add:

```python
        # Unreleased games (future release_date) are catalog-visible for the
        # Coming Soon section but must never be recommended — the engine only
        # suggests games the user can play tonight.
        games = [g for g in games if is_released(g.get("release_date"))]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_recommendation_service.py tests/test_recommendations.py -v`
Expected: PASS (new test plus all pre-existing engine tests — the fallback hierarchy must still find games).

- [ ] **Step 5: Commit**

```bash
git add src/services/recommendation_service.py tests/test_recommendation_service.py
git commit -m "feat: exclude unreleased games from the recommendation pool"
```

---

### Task 3: `/games/upcoming` endpoint + recent-games released filter

**Files:**
- Modify: `api-service/src/services/game_service.py` (new `list_upcoming_games`, filter in `list_recent_games`)
- Modify: `api-service/src/api/routes_games.py` (new route — MUST be declared before the `/{game_id}` catch-all)
- Test: `api-service/tests/test_games.py`

- [ ] **Step 1: Write the failing tests**

Append to `api-service/tests/test_games.py`:

```python
def test_upcoming_endpoint_exists(client):
    response = client.get("/api/games/upcoming")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_upcoming_returns_only_future_sorted(client, sample_games):
    # conftest's mock collection returns all seeded docs for any query, so the
    # service's Python-side filter is what this test exercises.
    sample_games[0]["release_date"] = "2099-12-01"
    sample_games[1]["release_date"] = "2099-01-15"
    # sample_games[2]: no release_date -> released -> excluded from upcoming
    response = client.get("/api/games/upcoming")
    assert response.status_code == 200
    data = response.json()
    ids = [g["game_id"] for g in data]
    assert ids == [sample_games[1]["game_id"], sample_games[0]["game_id"]]  # soonest first
    assert all(g["release_date"] for g in data)


def test_recent_excludes_unreleased(client, sample_games):
    from datetime import datetime, timezone
    for g in sample_games:
        g["created_at"] = datetime.now(timezone.utc)
    sample_games[0]["release_date"] = "2099-12-01"
    response = client.get("/api/games/recent")
    assert response.status_code == 200
    ids = [g["game_id"] for g in response.json()]
    assert sample_games[0]["game_id"] not in ids
```

Note: the `client` fixture builds its mock collection from `sample_games` at fixture-creation time. Mutating `sample_games` entries works because `_make_game_doc` wraps them with `dict(data)` at doc-build time — if the mutation happens too late, restructure the test to use its own client via the same pattern conftest uses (copy the `client` fixture body into a local fixture that takes pre-mutated games). Verify against actual fixture behavior in Step 2 and adjust; the assertion logic stays the same.

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_games.py -v`
Expected: `test_upcoming_endpoint_exists` FAILS with 404 (route doesn't exist; the path currently falls through to `/{game_id}` and returns "Game not found").

- [ ] **Step 3: Implement the service methods**

In `api-service/src/services/game_service.py`, add to the `GameService` class after `list_recent_games`:

```python
    async def list_upcoming_games(self, limit: int = 10) -> list[GameSummary]:
        """List unreleased games (future release_date), soonest first.

        Firestore narrows to release_date > today; the Python-side filter is
        the source of truth (and what unit tests exercise).
        """
        try:
            today = datetime.now(timezone.utc).date()
            today_str = today.isoformat()
            query = (
                self.collection
                .where("release_date", ">", today_str)
                .order_by("release_date")
                .limit(limit * 2)  # headroom; Python filter trims
            )
            rows = []
            for doc in query.stream():
                data = doc.to_dict()
                rd = data.get("release_date")
                if is_released(rd, today=today):
                    continue
                rows.append((rd, doc.id, data))
            rows.sort(key=lambda r: r[0])
            return [
                GameSummary(
                    game_id=doc_id,
                    title=data.get("title", ""),
                    platforms=[Platform(p) for p in data.get("platforms", [])],
                    description_short=data.get("description_short", ""),
                    time_to_fun=data.get("time_to_fun", "medium"),
                    stop_friendliness=data.get("stop_friendliness", "checkpoints"),
                    release_date=data.get("release_date"),
                )
                for _, doc_id, data in rows[:limit]
            ]
        except Exception as e:
            logger.error(f"Error listing upcoming games: {e}")
            return []
```

In `list_recent_games`, inside the `for doc in query.stream():` loop, add right after `data = doc.to_dict()`:

```python
                if not is_released(data.get("release_date")):
                    continue  # upcoming games belong to /games/upcoming, not What's New
```

Also add `release_date=data.get("release_date"),` to the `GameSummary(...)` constructions in BOTH `list_recent_games` and `list_games`.

- [ ] **Step 4: Implement the route**

In `api-service/src/api/routes_games.py`, add AFTER `list_recent_games` and BEFORE `get_game` (`/{game_id}` is a catch-all; static paths must precede it):

```python
@router.get("/upcoming", response_model=list[GameSummary])
async def list_upcoming_games(
    limit: int = Query(default=10, ge=1, le=25),
):
    """List unreleased games, soonest first (for the Coming Soon section)."""
    service = get_game_service()
    return await service.list_upcoming_games(limit=limit)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/test_games.py -v`
Expected: PASS. If the mutation-timing note from Step 1 bites, fix the test per that note, re-run.

- [ ] **Step 6: Note the Firestore index**

The production query (`where release_date > X` + `order_by release_date`) uses a single-field index Firestore maintains automatically — no `firestore.indexes.json` change needed. If the deployed endpoint ever errors with a `FAILED_PRECONDITION` index message, add the index the error's link prescribes.

- [ ] **Step 7: Commit**

```bash
git add src/services/game_service.py src/api/routes_games.py tests/test_games.py
git commit -m "feat: /games/upcoming endpoint; recent list excludes unreleased"
```

---

### Task 4: `rated_up` / `rated_down` signal types feed the engine

**Files:**
- Modify: `api-service/src/models/user.py` (SignalType)
- Modify: `api-service/src/services/recommendation_service.py` (constants, lines 81–84)
- Test: `api-service/tests/test_recommendation_service.py`

- [ ] **Step 1: Write the failing tests**

Append to `api-service/tests/test_recommendation_service.py`:

```python
class TestRatingSignalsInEngine:
    def test_rated_down_is_a_rejected_signal(self):
        from src.services.recommendation_service import REJECTED_SIGNAL_TYPES
        assert "rated_down" in REJECTED_SIGNAL_TYPES

    def test_rated_up_is_a_positive_signal(self):
        from src.services.recommendation_service import POSITIVE_SIGNAL_TYPES
        assert "rated_up" in POSITIVE_SIGNAL_TYPES

    def test_signal_type_enum_has_rating_values(self):
        from src.models import SignalType
        assert SignalType.RATED_UP.value == "rated_up"
        assert SignalType.RATED_DOWN.value == "rated_down"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_recommendation_service.py::TestRatingSignalsInEngine -v`
Expected: FAIL (missing constant membership / enum attribute).

- [ ] **Step 3: Implement**

`api-service/src/models/user.py` — add to `SignalType` after `ALREADY_PLAYED`:

```python
    RATED_UP = "rated_up"        # GameDetail thumbs up — feeds taste profile
    RATED_DOWN = "rated_down"    # GameDetail thumbs down — excluded like not_good_fit
```

`api-service/src/services/recommendation_service.py` lines 81–84 — extend both sets:

```python
REJECTED_SIGNAL_TYPES = {"not_good_fit", "played_didnt_stick", "rated_down"}
# Positive signals feed the free-tier taste nudge (same set the premium
# favor_history profile uses).
POSITIVE_SIGNAL_TYPES = {"worked", "played_loved", "accepted", "rated_up"}
```

(No other engine change: `_get_user_signal_data` builds exclusions and taste profiles from these sets, so ratings flow through automatically.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_recommendation_service.py tests/test_signal_service.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/models/user.py src/services/recommendation_service.py tests/test_recommendation_service.py
git commit -m "feat: rated_up/rated_down signal types feed engine exclusion and taste"
```

---

### Task 5: Rating summary logic + signal service methods

**Files:**
- Modify: `api-service/src/models/user.py` (RatingSummary, RatingUpdate models)
- Modify: `api-service/src/models/__init__.py` (export both)
- Modify: `api-service/src/services/signal_service.py` (pure `build_rating_summary` + `set_game_rating` / `get_game_rating`)
- Test: `api-service/tests/test_signal_service.py`

- [ ] **Step 1: Write the failing tests**

Append to `api-service/tests/test_signal_service.py`:

```python
from src.services.signal_service import build_rating_summary, RATING_DISPLAY_THRESHOLD


class TestBuildRatingSummary:
    def test_below_threshold_hides_percent(self):
        s = build_rating_summary({"rated_up": 3, "rated_down": 1}, user_rating="up")
        assert s["up"] == 3 and s["down"] == 1 and s["total"] == 4
        assert s["percent_liked"] is None            # cold-start protection
        assert s["user_rating"] == "up"

    def test_at_threshold_shows_percent(self):
        s = build_rating_summary({"rated_up": 9, "rated_down": 1}, user_rating=None)
        assert s["total"] == RATING_DISPLAY_THRESHOLD
        assert s["percent_liked"] == 90

    def test_no_ratings(self):
        s = build_rating_summary({}, user_rating=None)
        assert s == {"up": 0, "down": 0, "total": 0, "percent_liked": None, "user_rating": None}

    def test_ignores_other_signal_types(self):
        s = build_rating_summary({"rated_up": 2, "worked": 50, "accepted": 7}, user_rating=None)
        assert s["total"] == 2

    def test_percent_rounds_to_int(self):
        s = build_rating_summary({"rated_up": 7, "rated_down": 4}, user_rating="down")
        assert s["percent_liked"] == 64  # 7/11 = 63.6 -> round
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_signal_service.py -v`
Expected: FAIL — `ImportError: cannot import name 'build_rating_summary'`.

- [ ] **Step 3: Implement the pure function and constants**

In `api-service/src/services/signal_service.py`, add at module level (after the `logger` line):

```python
# Lightweight ratings (spec 2026-09-22). Aggregate sentiment renders only at
# or above this many ratings — nobody ever sees "1 person liked this".
RATING_DISPLAY_THRESHOLD = 10
RATING_SIGNAL_VALUES = ("rated_up", "rated_down")
# Ratings come from GameDetail, outside any recommendation session.
RATING_SESSION_ID = "game_detail_rating"


def build_rating_summary(counts: dict, user_rating) -> dict:
    """Compose the rating response from raw signal counts.

    Pure function so it can be unit-tested without Firestore.
    """
    up = counts.get("rated_up", 0)
    down = counts.get("rated_down", 0)
    total = up + down
    percent = round(up * 100 / total) if total >= RATING_DISPLAY_THRESHOLD else None
    return {
        "up": up,
        "down": down,
        "total": total,
        "percent_liked": percent,
        "user_rating": user_rating,
    }
```

- [ ] **Step 4: Add the I/O methods**

In the `SignalService` class, add after `get_game_signals`:

```python
    async def set_game_rating(
        self,
        user_id: str,
        game_id: str,
        rating: Optional[str],
        game_title: Optional[str] = None,
    ) -> Optional[UserSignal]:
        """Set, change, or clear (rating=None) a user's thumbs rating.

        One rating per user per game: any existing rated_* signals for this
        pair are deleted before the new one is written.
        """
        try:
            existing = (
                self.signals_collection
                .where("user_id", "==", user_id)
                .where("game_id", "==", game_id)
                .stream()
            )
            for doc in existing:
                if doc.to_dict().get("signal_type") in RATING_SIGNAL_VALUES:
                    doc.reference.delete()

            if rating is None:
                logger.info(f"Cleared rating for game {game_id} by user {user_id}")
                return None

            signal = UserSignalCreate(
                game_id=game_id,
                signal_type=SignalType.RATED_UP if rating == "up" else SignalType.RATED_DOWN,
            )
            return await self.record_signal(
                signal=signal,
                session_id=RATING_SESSION_ID,
                user_id=user_id,
                game_title=game_title,
            )
        except Exception as e:
            logger.error(f"Error setting rating for game {game_id}: {e}")
            raise

    async def get_game_rating(self, game_id: str, user_id: Optional[str]) -> dict:
        """Aggregate thumbs counts for a game plus the caller's own rating."""
        counts = await self.get_game_signals(
            game_id,
            signal_types=[SignalType.RATED_UP, SignalType.RATED_DOWN],
        )
        user_rating = None
        if user_id:
            own = await self.get_user_signals(user_id, game_id=game_id, limit=10)
            for s in own:
                if s.signal_type == SignalType.RATED_UP:
                    user_rating = "up"
                    break
                if s.signal_type == SignalType.RATED_DOWN:
                    user_rating = "down"
                    break
        return build_rating_summary(counts, user_rating)
```

- [ ] **Step 5: Add the response/request models**

In `api-service/src/models/user.py`, add after `FeedbackRequest`:

```python
class RatingUpdate(BaseModel):
    """Request body for setting a game rating. rating=None clears it."""
    rating: Optional[str] = Field(default=None, pattern="^(up|down)$")
    game_title: Optional[str] = None


class RatingSummary(BaseModel):
    """Aggregate thumbs rating for a game plus the caller's own rating."""
    up: int
    down: int
    total: int
    percent_liked: Optional[int] = None  # None below RATING_DISPLAY_THRESHOLD
    user_rating: Optional[str] = None    # "up" | "down" | None
```

In `api-service/src/models/__init__.py`, add `RatingUpdate` and `RatingSummary` to both the import from `.user` and `__all__` (alongside `FeedbackRequest`).

- [ ] **Step 6: Run tests to verify they pass**

Run: `python -m pytest tests/test_signal_service.py tests/test_models.py -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/models/user.py src/models/__init__.py src/services/signal_service.py tests/test_signal_service.py
git commit -m "feat: rating summary logic and set/get rating in signal service"
```

---

### Task 6: Rating routes

**Files:**
- Modify: `api-service/src/api/routes_signals.py`
- Test: `api-service/tests/test_signals_rating_api.py` (new)

- [ ] **Step 1: Write the failing tests**

Create `api-service/tests/test_signals_rating_api.py`:

```python
"""Tests for the game rating endpoints (thumbs up/down, spec 2026-09-22)."""


def test_get_rating_returns_summary_shape(client):
    response = client.get("/api/signals/game/game-001/rating")
    assert response.status_code == 200
    data = response.json()
    assert set(data.keys()) == {"up", "down", "total", "percent_liked", "user_rating"}
    assert data["total"] == data["up"] + data["down"]


def test_put_rating_requires_auth(client):
    # No Authorization header -> the require_authenticated_user dependency rejects.
    response = client.put("/api/signals/game/game-001/rating", json={"rating": "up"})
    assert response.status_code in (401, 403)


def test_put_rating_rejects_bad_value(client):
    response = client.put("/api/signals/game/game-001/rating", json={"rating": "sideways"})
    # Pydantic pattern validation fires before auth in body parsing -> 422,
    # or auth fires first -> 401/403. Either proves the bad value can't land.
    assert response.status_code in (401, 403, 422)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_signals_rating_api.py -v`
Expected: FAIL — GET returns 404/405 (route missing).

- [ ] **Step 3: Implement**

In `api-service/src/api/routes_signals.py`:

Extend the models import at the top to include `RatingSummary, RatingUpdate`.

Add the routes (place near `get_game_signals`' existing `/game/{game_id}` route; the more-specific `/game/{game_id}/rating` path is distinct, order doesn't matter):

```python
@router.get("/game/{game_id}/rating", response_model=RatingSummary)
async def get_game_rating(
    game_id: str,
    user_id: Optional[str] = Depends(get_user_id),
):
    """Aggregate thumbs rating for a game, plus the caller's own rating.

    percent_liked is null until the game has enough ratings to be meaningful.
    """
    try:
        service = get_signal_service()
        return await service.get_game_rating(game_id, user_id)
    except Exception as e:
        logger.error(f"Error fetching rating for game {game_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch rating")


@router.put("/game/{game_id}/rating", response_model=RatingSummary)
async def set_game_rating(
    game_id: str,
    update: RatingUpdate,
    user: dict = Depends(require_authenticated_user),
):
    """Set, change, or clear the caller's thumbs rating for a game."""
    try:
        service = get_signal_service()
        await service.set_game_rating(
            user_id=user["uid"],
            game_id=game_id,
            rating=update.rating,
            game_title=update.game_title,
        )
        return await service.get_game_rating(game_id, user["uid"])
    except Exception as e:
        logger.error(f"Error setting rating for game {game_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to set rating")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_signals_rating_api.py tests/ -v`
Expected: New tests PASS; full suite green (190 pre-existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/api/routes_signals.py tests/test_signals_rating_api.py
git commit -m "feat: GET/PUT /signals/game/{id}/rating endpoints"
```

---

### Task 7: Weekly digest mentions coming-soon games

The spec's "monthly re-engagement push" rides the existing weekly digest (Cloud Scheduler already triggers `/notifications/send-weekly`): the digest copy now includes upcoming titles whenever any exist. No new scheduler job — YAGNI.

**Files:**
- Modify: `api-service/src/services/notification_service.py` (`build_digest_message`, `run_weekly_send`)
- Test: `api-service/tests/test_notification_service.py`

- [ ] **Step 1: Write the failing tests**

Append to `api-service/tests/test_notification_service.py`:

```python
from src.services.notification_service import build_digest_message


class TestDigestUpcoming:
    def test_upcoming_appended_to_body(self):
        msg = build_digest_message(
            [{"title": "Game A"}, {"title": "Game B"}],
            upcoming_games=[{"title": "Future 1"}, {"title": "Future 2"}, {"title": "Future 3"}],
        )
        assert "3 more coming soon" in msg["body"]

    def test_no_upcoming_keeps_old_copy(self):
        msg = build_digest_message([{"title": "Game A"}], upcoming_games=[])
        assert "coming soon" not in msg["body"]

    def test_upcoming_alone_still_sends(self):
        # New-release week with nothing added but games announced: still a digest.
        msg = build_digest_message([], upcoming_games=[{"title": "Future 1"}])
        assert msg is not None
        assert "coming soon" in msg["body"].lower() or "coming soon" in msg["title"].lower()

    def test_nothing_at_all_returns_none(self):
        assert build_digest_message([], upcoming_games=[]) is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_notification_service.py -v`
Expected: FAIL — `build_digest_message() got an unexpected keyword argument 'upcoming_games'`.

- [ ] **Step 3: Implement**

Replace `build_digest_message` in `api-service/src/services/notification_service.py`:

```python
def build_digest_message(recent_games: list[dict], upcoming_games: Optional[list[dict]] = None) -> Optional[dict]:
    """Return {title, body} for the weekly 'what's new' digest, or None if empty.

    Mentions coming-soon games when any exist (spec 2026-09-22): re-engagement
    rides the existing weekly send, no separate monthly job.
    """
    upcoming_games = upcoming_games or []
    n = len(recent_games)
    m = len(upcoming_games)
    if n == 0 and m == 0:
        return None

    if n == 0:
        # Announced-only week: lead with what's coming.
        titles = [g.get("title", "") for g in upcoming_games[:2] if g.get("title")]
        sample = ", ".join(titles)
        plural = "s" if m != 1 else ""
        return {
            "title": f"\U0001F52E {m} game{plural} coming soon",
            "body": f"Including {sample}. Get your backlog ready.",
        }

    titles = [g.get("title", "") for g in recent_games[:3] if g.get("title")]
    sample = ", ".join(titles)
    body = f"Including {sample} and more." if n > len(titles) else f"Including {sample}."
    if m > 0:
        body += f" Plus {m} more coming soon."
    plural = "s" if n != 1 else ""
    return {"title": f"\U0001F3AE {n} new game{plural} this week", "body": body}
```

In `run_weekly_send`, replace the first three lines of the body with:

```python
        from . import get_game_service
        recent = await get_game_service().list_recent_games(days=7, limit=20)
        upcoming = await get_game_service().list_upcoming_games(limit=5)
        recent_dicts = [{"title": g.title} for g in recent]
        upcoming_dicts = [{"title": g.title} for g in upcoming]
        has_new = len(recent_dicts) > 0 or len(upcoming_dicts) > 0
        digest_msg = build_digest_message(recent_dicts, upcoming_games=upcoming_dicts)
```

(The rest of `run_weekly_send` is unchanged; `select_recipients(devices, now, has_new)` now counts an announced-only week as "new".)

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_notification_service.py tests/test_followup_notifications.py tests/test_notifications_api.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/notification_service.py tests/test_notification_service.py
git commit -m "feat: weekly digest mentions coming-soon games"
```

---

## Part B — Mobile (mobile-app)

Run mobile tests from `mobile-app/`: `npx jest`.

### Task 8: Changelog content + version-gate service

**Files:**
- Create: `mobile-app/src/config/changelog.js`
- Create: `mobile-app/src/services/changelogService.js`
- Test: `mobile-app/src/services/__tests__/changelogService.test.js`

- [ ] **Step 1: Write the failing tests**

Create `mobile-app/src/services/__tests__/changelogService.test.js`:

```javascript
/**
 * changelogService — decides whether the post-update changelog modal shows.
 * Rules (spec 2026-09-22): fresh installs never see it; it shows once per
 * version, only when a changelog entry exists for the running version.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  shouldShowChangelog,
  markChangelogSeen,
  LAST_SEEN_VERSION_KEY,
} from '../changelogService';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const ENTRIES = { '1.4.0': { title: 'Test', features: [] } };

beforeEach(() => AsyncStorage.clear());

describe('shouldShowChangelog', () => {
  it('fresh install: records version, shows nothing', async () => {
    const show = await shouldShowChangelog('1.4.0', ENTRIES);
    expect(show).toBe(false);
    expect(await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY)).toBe('1.4.0');
  });

  it('upgrade with an entry: shows', async () => {
    await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, '1.3.0');
    expect(await shouldShowChangelog('1.4.0', ENTRIES)).toBe(true);
  });

  it('same version: does not show', async () => {
    await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, '1.4.0');
    expect(await shouldShowChangelog('1.4.0', ENTRIES)).toBe(false);
  });

  it('upgrade without an entry: records version, does not show', async () => {
    await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, '1.3.0');
    expect(await shouldShowChangelog('1.5.0', ENTRIES)).toBe(false);
    expect(await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY)).toBe('1.5.0');
  });

  it('storage failure: does not show, does not throw', async () => {
    const spy = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('boom'));
    expect(await shouldShowChangelog('1.4.0', ENTRIES)).toBe(false);
    spy.mockRestore();
  });
});

describe('markChangelogSeen', () => {
  it('records the version', async () => {
    await markChangelogSeen('1.4.0');
    expect(await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY)).toBe('1.4.0');
  });
});
```

(If `jest.setup.js` already mocks async-storage globally, drop the inline `jest.mock` — check the file first.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/services/__tests__/changelogService.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the content file**

Create `mobile-app/src/config/changelog.js`:

```javascript
/**
 * In-app changelog, one entry per release (spec 2026-09-22).
 * Shown once by ChangelogModal on first launch after an update.
 * cta.screen values are navigation route names; params optional.
 */
export const CHANGELOG = {
  '1.4.0': {
    title: "What's new in PlayNxt",
    features: [
      {
        icon: 'logo-steam',
        headline: 'Steam library sync',
        body: 'Connect Steam and picks skip games you already played.',
        cta: { label: 'Connect Steam', screen: 'ConnectSteam' },
      },
      {
        icon: 'albums-outline',
        headline: 'Backlog Mode',
        body: 'Premium: get picks from games you own but never touched.',
        cta: { label: 'Try Backlog Mode', screen: 'Premium' },
      },
      {
        icon: 'calendar-outline',
        headline: 'Coming Soon + ratings',
        body: "See what's launching next, and rate games you've played.",
        cta: { label: "See What's New", screen: 'WhatsNew' },
      },
    ],
  },
};
```

(Before committing, verify the three route names against `src/navigation/AppNavigator.js` — `WhatsNew` exists; confirm the exact registered names for the Steam-connect and premium screens and correct the `screen` values if they differ.)

- [ ] **Step 4: Implement the service**

Create `mobile-app/src/services/changelogService.js`:

```javascript
/**
 * Decides whether the post-update changelog modal shows (spec 2026-09-22).
 * Compares the stored last-seen app version to the running version.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CHANGELOG } from '../config/changelog';

export const LAST_SEEN_VERSION_KEY = '@playnxt_last_seen_version';

export const markChangelogSeen = async (version) => {
  try {
    await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, version);
  } catch {
    // Non-fatal: worst case the modal shows again next launch.
  }
};

/**
 * @param {string} currentVersion - running app version (Constants.expoConfig.version)
 * @param {object} [entries] - changelog map (injectable for tests; defaults to CHANGELOG)
 * @returns {Promise<boolean>} whether to show the modal for currentVersion
 */
export const shouldShowChangelog = async (currentVersion, entries = CHANGELOG) => {
  if (!currentVersion) return false;
  try {
    const lastSeen = await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY);
    if (!lastSeen) {
      // Fresh install: nothing is "new" — record and stay quiet.
      await markChangelogSeen(currentVersion);
      return false;
    }
    if (lastSeen === currentVersion) return false;
    if (!entries[currentVersion]) {
      // Updated, but nothing to announce for this version.
      await markChangelogSeen(currentVersion);
      return false;
    }
    return true;
  } catch {
    return false;
  }
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/services/__tests__/changelogService.test.js`
Expected: PASS (all 6).

- [ ] **Step 6: Commit**

```bash
git add src/config/changelog.js src/services/changelogService.js src/services/__tests__/changelogService.test.js
git commit -m "feat: changelog content and version-gate service"
```

---

### Task 9: ChangelogModal component + App.js wiring

**Files:**
- Create: `mobile-app/src/components/ChangelogModal.js`
- Modify: `mobile-app/App.js`

- [ ] **Step 1: Implement the component**

Create `mobile-app/src/components/ChangelogModal.js` (style-matched to the app's dark gradient + `#f857a6` accent; see FollowUpModal for the Modal pattern):

```javascript
/**
 * ChangelogModal
 *
 * One-time "what's new in this update" modal, shown on first launch after an
 * app update when a changelog entry exists (spec 2026-09-22). Feature rows
 * with optional CTA deep links; dismiss records the version as seen.
 */
import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const ChangelogModal = ({ visible, entry, onFeaturePress, onDismiss }) => {
  if (!entry) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.card}>
          <Text style={styles.title}>{entry.title}</Text>
          <ScrollView style={styles.features} showsVerticalScrollIndicator={false}>
            {entry.features.map((f) => (
              <View key={f.headline} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Ionicons name={f.icon} size={22} color="#f857a6" />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureHeadline}>{f.headline}</Text>
                  <Text style={styles.featureBody}>{f.body}</Text>
                  {f.cta ? (
                    <TouchableOpacity
                      onPress={() => onFeaturePress(f.cta)}
                      accessibilityRole="button"
                      accessibilityLabel={f.cta.label}
                    >
                      <Text style={styles.ctaText}>{f.cta.label} →</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss} accessibilityRole="button">
            <Text style={styles.dismissText}>Got it</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(248, 87, 166, 0.3)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 20,
  },
  features: {
    flexGrow: 0,
  },
  featureRow: {
    flexDirection: 'row',
    marginBottom: 18,
    gap: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(248, 87, 166, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureHeadline: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 3,
  },
  featureBody: {
    fontSize: 14,
    color: '#b0b0b0',
    lineHeight: 20,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f857a6',
    marginTop: 6,
  },
  dismissButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default ChangelogModal;
```

- [ ] **Step 2: Wire into App.js**

In `mobile-app/App.js`:

Add imports (with the existing imports):

```javascript
import Constants from 'expo-constants';
import ChangelogModal from './src/components/ChangelogModal';
import { shouldShowChangelog, markChangelogSeen } from './src/services/changelogService';
import { CHANGELOG } from './src/config/changelog';
```

Add state next to the existing `useState` calls:

```javascript
  const [changelogEntry, setChangelogEntry] = useState(null);
```

Extend the existing `checkFirstLaunch` effect — after `setShowWelcome(!seen);` add:

```javascript
      if (seen) {
        const version = Constants.expoConfig?.version;
        if (await shouldShowChangelog(version)) {
          setChangelogEntry({ version, ...CHANGELOG[version] });
          logEvent('changelog_shown', { version });
        }
      }
```

Add handlers after `handleFollowUp`:

```javascript
  const dismissChangelog = async () => {
    if (changelogEntry) {
      logEvent('changelog_dismissed', { version: changelogEntry.version });
      await markChangelogSeen(changelogEntry.version);
    }
    setChangelogEntry(null);
  };

  const handleChangelogCta = async (cta) => {
    if (changelogEntry) {
      logEvent('changelog_cta_tapped', { version: changelogEntry.version, screen: cta.screen });
      await markChangelogSeen(changelogEntry.version);
    }
    setChangelogEntry(null);
    if (navigationRef.isReady()) {
      navigationRef.navigate(cta.screen, cta.params);
    }
  };
```

Render next to `<FollowUpModal ... />` (inside `SafeAreaProvider`):

```javascript
        <ChangelogModal
          visible={!!changelogEntry}
          entry={changelogEntry}
          onFeaturePress={handleChangelogCta}
          onDismiss={dismissChangelog}
        />
```

- [ ] **Step 3: Run the mobile test suite**

Run: `npx jest`
Expected: PASS (no regressions; App.js has no direct test file).

- [ ] **Step 4: Commit**

```bash
git add src/components/ChangelogModal.js App.js
git commit -m "feat: post-update changelog modal with CTA deep links"
```

---

### Task 10: API client methods

**Files:**
- Modify: `mobile-app/src/services/api.js`

- [ ] **Step 1: Implement**

In `mobile-app/src/services/api.js`, add after `getRecentGames` (line ~139):

```javascript
  /**
   * Get unreleased games, soonest first (Coming Soon section)
   */
  getUpcomingGames: async (limit = 10) => {
    const response = await apiClient.get('/games/upcoming', { params: { limit } });
    return response.data;
  },
```

Add in the Signals section, after `getGameSignals`:

```javascript
  /**
   * Get aggregate thumbs rating for a game (plus this user's own rating)
   */
  getGameRating: async (gameId) => {
    const response = await apiClient.get(`/signals/game/${gameId}/rating`);
    return response.data;
  },

  /**
   * Set, change, or clear (rating=null) this user's thumbs rating
   * @param {string} gameId
   * @param {"up"|"down"|null} rating
   * @param {string} [gameTitle]
   */
  setGameRating: async (gameId, rating, gameTitle = null) => {
    const response = await apiClient.put(`/signals/game/${gameId}/rating`, {
      rating,
      game_title: gameTitle,
    });
    return response.data;
  },
```

- [ ] **Step 2: Run mobile tests**

Run: `npx jest`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/services/api.js
git commit -m "feat: api client methods for upcoming games and ratings"
```

---

### Task 11: Coming Soon section on WhatsNewScreen

**Files:**
- Modify: `mobile-app/src/screens/WhatsNewScreen.js`

- [ ] **Step 1: Implement**

In `mobile-app/src/screens/WhatsNewScreen.js`:

Add state and fetch upcoming in parallel — replace the existing effect body:

```javascript
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [recent, coming] = await Promise.all([
          api.getRecentGames(7, 20),
          api.getUpcomingGames(10).catch(() => []),  // section is optional; never block the list
        ]);
        setGames(recent || []);
        setUpcoming(coming || []);
      } catch (e) {
        setError('Could not load new games. Please try again later.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);
```

Add a date formatter above the component (module level):

```javascript
const formatReleaseDate = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
```

Convert the screen body so the recent list and the Coming Soon section render in ONE `FlatList` (avoids nesting a list in a ScrollView): use the upcoming section as `ListFooterComponent`:

```javascript
        <FlatList
          data={games}
          keyExtractor={(item) => item.game_id}
          renderItem={renderItem}
          ListEmptyComponent={/* keep the screen's existing empty state */}
          ListFooterComponent={
            upcoming.length > 0 ? (
              <View style={styles.upcomingSection}>
                <Text style={styles.upcomingHeader}>Coming Soon</Text>
                {upcoming.map((item) => (
                  <TouchableOpacity
                    key={item.game_id}
                    style={styles.row}
                    onPress={() => navigation.navigate('GameDetail', { gameId: item.game_id })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.rowMain}>
                      <Text style={styles.title}>{item.title}</Text>
                      <Text style={styles.platforms}>
                        {(item.platforms || []).map((p) => PLATFORM_LABELS[p] || p).join(' · ')}
                      </Text>
                      <Text style={styles.releaseDate}>
                        Releases {formatReleaseDate(item.release_date)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#808080" />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null
          }
        />
```

(Keep the screen's existing loading/error branches and its FlatList props; only `ListFooterComponent` and the parallel fetch are new. Reuse the existing `row`, `rowMain`, `title`, `platforms` styles.)

Add styles at the bottom of the StyleSheet:

```javascript
  upcomingSection: {
    marginTop: 24,
  },
  upcomingHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  releaseDate: {
    fontSize: 13,
    color: '#fbbf24',
    fontWeight: '600',
    marginTop: 2,
  },
```

(Match the horizontal padding of the existing rows — if rows pad themselves, drop `paddingHorizontal` from `upcomingHeader` accordingly.)

- [ ] **Step 2: Run mobile tests**

Run: `npx jest`
Expected: PASS (if `src/screens/__tests__` has a WhatsNewScreen test, update its api mock to include `getUpcomingGames: jest.fn().mockResolvedValue([])`).

- [ ] **Step 3: Commit**

```bash
git add src/screens/WhatsNewScreen.js
git commit -m "feat: Coming Soon section on What's New screen"
```

---

### Task 12: Rating row on GameDetailScreen

**Files:**
- Modify: `mobile-app/src/screens/GameDetailScreen.js`

- [ ] **Step 1: Implement**

In `mobile-app/src/screens/GameDetailScreen.js`:

Add state below the existing `useState` calls:

```javascript
  const [rating, setRating] = useState(null);        // RatingSummary from API
  const [ratingBusy, setRatingBusy] = useState(false);
```

Fetch alongside game details — inside `fetchGameDetails`, after `setGame(gameData);` add:

```javascript
      // Rating is optional decoration; never block the screen on it.
      api.getGameRating(gameId).then(setRating).catch(() => {});
```

Add the handler after `handleSubscriptionPress`:

```javascript
  const handleRate = async (value) => {
    if (ratingBusy) return;
    const next = rating?.user_rating === value ? null : value;  // tap again to clear
    hapticLight();
    logEvent('game_rated', { game_id: gameId, rating: next || 'cleared' });
    setRatingBusy(true);
    const previous = rating;
    // Optimistic flip of the user's own state; counts refresh from the response.
    setRating((r) => ({ ...(r || { up: 0, down: 0, total: 0, percent_liked: null }), user_rating: next }));
    try {
      const summary = await api.setGameRating(gameId, next, game?.title || gameTitle);
      setRating(summary);
    } catch {
      setRating(previous);  // revert on failure
    } finally {
      setRatingBusy(false);
    }
  };
```

Render the rating section in the ScrollView after the "Meta tags" block (before "Fun Fact"):

```javascript
          {/* Rating (spec 2026-09-22: thumbs only, % shown at threshold) */}
          <View style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>Played it?</Text>
            <View style={styles.ratingButtons}>
              <TouchableOpacity
                style={[styles.ratingButton, rating?.user_rating === 'up' && styles.ratingButtonActive]}
                onPress={() => handleRate('up')}
                accessibilityLabel="Thumbs up"
                accessibilityRole="button"
              >
                <Ionicons
                  name={rating?.user_rating === 'up' ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={20}
                  color={rating?.user_rating === 'up' ? '#f857a6' : '#a0a0a0'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ratingButton, rating?.user_rating === 'down' && styles.ratingButtonActive]}
                onPress={() => handleRate('down')}
                accessibilityLabel="Thumbs down"
                accessibilityRole="button"
              >
                <Ionicons
                  name={rating?.user_rating === 'down' ? 'thumbs-down' : 'thumbs-down-outline'}
                  size={20}
                  color={rating?.user_rating === 'down' ? '#f857a6' : '#a0a0a0'}
                />
              </TouchableOpacity>
            </View>
            {rating?.percent_liked != null && (
              <Text style={styles.ratingPercent}>{rating.percent_liked}% of players liked this</Text>
            )}
          </View>
```

Add styles at the bottom of the StyleSheet:

```javascript
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a0a0a0',
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingButton: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  ratingButtonActive: {
    backgroundColor: 'rgba(248, 87, 166, 0.15)',
  },
  ratingPercent: {
    fontSize: 13,
    color: '#c0c0c0',
    fontWeight: '500',
  },
```

- [ ] **Step 2: Run mobile tests**

Run: `npx jest`
Expected: PASS (update any GameDetailScreen test's api mock with `getGameRating: jest.fn().mockResolvedValue({ up: 0, down: 0, total: 0, percent_liked: null, user_rating: null })` and `setGameRating: jest.fn()`).

- [ ] **Step 3: Commit**

```bash
git add src/screens/GameDetailScreen.js
git commit -m "feat: thumbs rating row on game detail"
```

---

## Part C — Catalog data

### Task 13: Fall 2026 batch (⚠️ HUMAN REVIEW GATE)

**Files:**
- Create: `api-service/scripts/games_data/refresh_2026_fall.json`
- Verify: `api-service/scripts/seed_refresh.py` passes `release_date` through

- [ ] **Step 1: Verify seed_refresh passes release_date through**

Read `api-service/scripts/seed_refresh.py` end to end. It reads entries from the JSON, enriches store links, and writes docs via Firestore REST. Confirm unknown fields in an entry (like `release_date`) are written to the doc. If the script whitelists fields, add `release_date` to the written set. If it passes the whole dict through (most likely), no change.

- [ ] **Step 2: Draft the batch**

Create `api-service/scripts/games_data/refresh_2026_fall.json` matching the entry shape of `games_data/refresh_2025_2026.json` (read it first for the exact field list — entries carry `game_id`, `title`, `platforms`, `release_year`, `genre_tags`, `time_tags`, `energy_level`, `mood_tags`, `play_style`, `time_to_fun`, `stop_friendliness`, `multiplayer_modes`, `description_short`, `fun_fact`, `subscription_services`, plus a RAWG slug field if the file uses one).

Coverage to draft (verify current release status and dates against RAWG/press before writing; drop anything delisted or slipped out of the window):
- **September 2026 releases** not yet in the catalog.
- **Announced Oct–Dec 2026 titles** with confirmed dates — these entries MUST include `"release_date": "YYYY-MM-DD"` with the future date (they power Coming Soon and are excluded from recommendations until release).
- Released entries may include `release_date` too (accurate data, no behavior change); unknown exact dates on released games may omit it.
- Every entry needs full curation fields (time_tags/energy/mood/stop_friendliness are hand-authored — the product differentiator; never scraped).

- [ ] **Step 3: 🛑 STOP — Tom reviews the drafted batch**

Present the drafted JSON to Tom for curation review (tag accuracy is his call). Do not seed until approved.

- [ ] **Step 4: Dry-run, then apply**

```bash
cd api-service/scripts
python seed_refresh.py --file=refresh_2026_fall.json
```

Review the dry-run output (dedupe gate: anything already in Firestore or tombstoned is skipped). Then:

```bash
python seed_refresh.py --file=refresh_2026_fall.json --apply
```

- [ ] **Step 5: Verify live**

```bash
curl -s "https://playnxt-api-167253232570.us-central1.run.app/api/games/upcoming" | python -m json.tool
```

Expected: the future-dated entries, soonest first. (Requires the Task 3 API deploy; if the API hasn't shipped yet, verify in the Firestore console instead and re-check after deploy.)

- [ ] **Step 6: Commit**

```bash
git add scripts/games_data/refresh_2026_fall.json
git commit -m "data: fall 2026 catalog batch incl. coming-soon titles"
```

---

## Part D — Monthly candidate pipeline (independent track — must NOT gate the 1.4.0 release)

### Task 14: Candidate script

**Files:**
- Create: `api-service/scripts/new_release_candidates.py`
- Test: `api-service/tests/test_new_release_candidates.py`

- [ ] **Step 1: Write the failing tests**

Create `api-service/tests/test_new_release_candidates.py`:

```python
"""Tests for the monthly new-release candidate filter (pure logic only)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from new_release_candidates import filter_candidates, to_candidate_entry


def _rawg(slug, name, released, added=500, platforms=None):
    return {
        "slug": slug,
        "name": name,
        "released": released,
        "added": added,
        "platforms": [{"platform": {"slug": s}} for s in (platforms or ["pc"])],
        "genres": [{"slug": "action"}],
    }


class TestFilterCandidates:
    def test_drops_existing_and_tombstoned(self):
        results = [_rawg("new-game", "New Game", "2026-09-10"),
                   _rawg("old-game", "Old Game", "2026-09-11"),
                   _rawg("dead-game", "Dead Game", "2026-09-12")]
        out = filter_candidates(results, existing_ids={"old-game"}, tombstones={"dead-game"},
                                min_added=100)
        assert [c["slug"] for c in out] == ["new-game"]

    def test_drops_below_popularity_floor(self):
        results = [_rawg("popular", "Popular", "2026-09-10", added=500),
                   _rawg("obscure", "Obscure", "2026-09-10", added=3)]
        out = filter_candidates(results, existing_ids=set(), tombstones=set(), min_added=100)
        assert [c["slug"] for c in out] == ["popular"]

    def test_existing_match_is_case_and_punct_insensitive_on_title(self):
        results = [_rawg("hades-ii", "Hades II", "2026-09-10")]
        out = filter_candidates(results, existing_ids=set(), tombstones=set(),
                                min_added=100, existing_titles={"hades ii"})
        assert out == []


class TestToCandidateEntry:
    def test_prefills_rawg_fields_and_blanks_curation(self):
        entry = to_candidate_entry(_rawg("new-game", "New Game", "2026-11-05",
                                         platforms=["pc", "playstation5"]))
        assert entry["game_id"] == "new-game"
        assert entry["title"] == "New Game"
        assert entry["release_date"] == "2026-11-05"
        assert entry["release_year"] == 2026
        assert "pc" in entry["platforms"]
        # Curation fields deliberately blank — the human fills these in the PR.
        assert entry["time_tags"] == []
        assert entry["mood_tags"] == []
        assert entry["energy_level"] == "FILL_ME"
        assert entry["stop_friendliness"] == "FILL_ME"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_new_release_candidates.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `api-service/scripts/new_release_candidates.py`:

```python
"""Monthly new-release candidate finder (spec 2026-09-22).

Queries RAWG for recent (past ~45 days) and upcoming (next ~60 days) releases,
drops games already in Firestore or tombstoned, and writes a candidate JSON
for HUMAN curation. It never writes to Firestore — the GitHub Actions workflow
opens a PR; a person fills in the curation fields before seeding.

Usage:
    python new_release_candidates.py                 # writes games_data/candidates_<YYYY_MM>.json
    python new_release_candidates.py --min-added=50  # lower popularity floor

Env: RAWG_API_KEY (falls back to mobile-app/.env's EXPO_PUBLIC_RAWG_API_KEY locally).
"""

import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
GAMES_DATA = SCRIPT_DIR / "games_data"
TOMBSTONES_FILE = SCRIPT_DIR / "deleted_game_ids.json"
PROJECT = "playnxt-1a2c6"
FIRESTORE_BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/games"

# RAWG platform slug -> catalog platform enum
RAWG_PLATFORM_MAP = {
    "pc": "pc",
    "playstation5": "playstation", "playstation4": "playstation",
    "xbox-series-x": "xbox", "xbox-one": "xbox",
    "nintendo-switch": "switch", "nintendo-switch-2": "switch",
    "ios": "mobile", "android": "mobile",
}

DEFAULT_MIN_ADDED = 100   # RAWG "added" count — popularity floor keeping the list reviewable
RECENT_DAYS = 45
UPCOMING_DAYS = 60


def norm_title(t):
    return re.sub(r"[^a-z0-9]+", " ", (t or "").lower()).strip()


def filter_candidates(rawg_results, existing_ids, tombstones, min_added,
                      existing_titles=None):
    """Drop known, tombstoned, and unpopular games. Pure function."""
    existing_titles = existing_titles or set()
    out = []
    seen = set()
    for g in rawg_results:
        slug = g.get("slug")
        if not slug or slug in seen:
            continue
        seen.add(slug)
        if slug in existing_ids or slug in tombstones:
            continue
        if norm_title(g.get("name")) in existing_titles:
            continue
        if (g.get("added") or 0) < min_added:
            continue
        out.append(g)
    return out


def to_candidate_entry(g):
    """RAWG result -> catalog entry skeleton. Curation fields stay blank on
    purpose: the seed gate must refuse the file until a human fills them."""
    released = g.get("released") or ""
    platforms = []
    for p in g.get("platforms") or []:
        mapped = RAWG_PLATFORM_MAP.get((p.get("platform") or {}).get("slug"))
        if mapped and mapped not in platforms:
            platforms.append(mapped)
    return {
        "game_id": g["slug"],
        "title": g.get("name", ""),
        "platforms": platforms or ["pc"],
        "release_year": int(released[:4]) if len(released) >= 4 and released[:4].isdigit() else date.today().year,
        "release_date": released,
        "genre_tags": [x.get("slug") for x in (g.get("genres") or []) if x.get("slug")],
        "time_tags": [],
        "energy_level": "FILL_ME",
        "mood_tags": [],
        "play_style": [],
        "time_to_fun": "FILL_ME",
        "stop_friendliness": "FILL_ME",
        "multiplayer_modes": [],
        "description_short": "FILL_ME",
        "fun_fact": "",
        "subscription_services": [],
        "store_links": {},
    }


# ---------------------------------------------------------------- I/O below


def rawg_key():
    key = os.environ.get("RAWG_API_KEY")
    if key:
        return key
    env = (SCRIPT_DIR / ".." / ".." / "mobile-app" / ".env").resolve()
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("EXPO_PUBLIC_RAWG_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise SystemExit("Set RAWG_API_KEY (or mobile-app/.env)")


def fetch_rawg_window(key, start, end):
    """All RAWG results released in [start, end], paged."""
    results, page = [], 1
    while True:
        q = urllib.parse.urlencode({
            "key": key, "dates": f"{start},{end}",
            "ordering": "-added", "page_size": 40, "page": page,
        })
        try:
            d = json.load(urllib.request.urlopen(f"https://api.rawg.io/api/games?{q}", timeout=30))
        except Exception as e:
            print(f"RAWG fetch failed on page {page}: {e}", file=sys.stderr)
            break
        results.extend(d.get("results") or [])
        if not d.get("next") or page >= 5:   # 200 games max per window is plenty
            break
        page += 1
    return results


def fetch_existing():
    """All catalog game ids + normalized titles via the public API (no creds needed)."""
    ids, titles = set(), set()
    url = "https://playnxt-api-167253232570.us-central1.run.app/api/games?limit=100"
    offset = 0
    while True:
        try:
            d = json.load(urllib.request.urlopen(f"{url}&offset={offset}", timeout=30))
        except Exception as e:
            raise SystemExit(f"Could not list existing games: {e}")
        if not d:
            break
        for g in d:
            ids.add(g["game_id"])
            titles.add(norm_title(g.get("title")))
        if len(d) < 100:
            break
        offset += 100
    return ids, titles


def main():
    min_added = DEFAULT_MIN_ADDED
    for a in sys.argv[1:]:
        if a.startswith("--min-added="):
            min_added = int(a.split("=", 1)[1])

    key = rawg_key()
    today = date.today()
    start = (today - timedelta(days=RECENT_DAYS)).isoformat()
    end = (today + timedelta(days=UPCOMING_DAYS)).isoformat()
    print(f"Fetching RAWG releases {start} .. {end} (min_added={min_added})")

    raw = fetch_rawg_window(key, start, end)
    existing_ids, existing_titles = fetch_existing()
    tombstones = set(json.loads(TOMBSTONES_FILE.read_text())) if TOMBSTONES_FILE.exists() else set()

    candidates = filter_candidates(raw, existing_ids, tombstones, min_added,
                                   existing_titles=existing_titles)
    entries = [to_candidate_entry(g) for g in candidates]

    out_file = GAMES_DATA / f"candidates_{today.strftime('%Y_%m')}.json"
    out_file.write_text(json.dumps(entries, indent=2) + "\n")
    print(f"Wrote {len(entries)} candidates to {out_file.name}")
    print("Fill in every FILL_ME / empty curation field before seeding.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_new_release_candidates.py -v`
Expected: PASS (pure functions only; no network in tests).

- [ ] **Step 5: Add a seed-gate check**

`seed_refresh.py` must refuse `FILL_ME` entries. Read its validation section; if it has none for these fields, add near the top of its main loop:

```python
    if any(v == "FILL_ME" for v in (g.get("energy_level"), g.get("time_to_fun"),
                                    g.get("stop_friendliness"), g.get("description_short"))) \
            or not g.get("time_tags"):
        print(f"SKIP (uncurated): {g.get('game_id')}")
        continue
```

- [ ] **Step 6: Run the script once for real (sanity check)**

```bash
cd api-service/scripts
python new_release_candidates.py
```

Expected: a `candidates_2026_09.json` with a reviewable list (roughly 10–40 entries); spot-check that known catalog games are absent. Delete the sanity-check file afterwards or keep it as the first monthly candidate file — Tom's call.

- [ ] **Step 7: Commit**

```bash
git add scripts/new_release_candidates.py tests/test_new_release_candidates.py scripts/seed_refresh.py
git commit -m "feat: monthly new-release candidate script (human-curated, PR-based)"
```

---

### Task 15: Monthly workflow that opens a PR

**Files:**
- Create: `.github/workflows/new-release-candidates.yml`
- Setup (Tom): add `RAWG_API_KEY` as a GitHub Actions repo secret

- [ ] **Step 1: Implement the workflow**

Create `.github/workflows/new-release-candidates.yml`:

```yaml
# PlayNxt — monthly new-release candidate PR (spec 2026-09-22)
#
# Fetches recent + upcoming releases from RAWG, filters out games already in
# the catalog, and opens a PR with a candidate JSON whose curation fields are
# blank. A human fills them in on the PR branch, then seeds with
# seed_refresh.py. This workflow NEVER writes to Firestore.

name: New Release Candidates

on:
  schedule:
    - cron: '0 9 5 * *'   # 5th of each month, 09:00 UTC
  workflow_dispatch:

jobs:
  candidates:
    runs-on: ubuntu-latest

    permissions:
      contents: write
      pull-requests: write

    steps:
      - uses: actions/checkout@v6

      - name: Set up Python
        uses: actions/setup-python@v6
        with:
          python-version: '3.11'

      - name: Generate candidate file
        working-directory: api-service/scripts
        env:
          RAWG_API_KEY: ${{ secrets.RAWG_API_KEY }}
        run: python new_release_candidates.py

      - name: Open candidate PR
        uses: peter-evans/create-pull-request@v7
        with:
          branch: catalog/new-release-candidates
          commit-message: "data: monthly new-release candidates (uncurated)"
          title: "Catalog: new-release candidates for review"
          body: |
            Automated monthly candidate list from RAWG (recent + upcoming releases,
            already-cataloged and tombstoned games removed).

            **Before merging:** fill in every `FILL_ME` and empty curation field
            (`time_tags`, `energy_level`, `mood_tags`, `play_style`, `time_to_fun`,
            `stop_friendliness`, `multiplayer_modes`, `description_short`) — these
            are hand-curated, never scraped. Delete entries that don't belong.
            After merge, seed with:
            `python seed_refresh.py --file=<candidate file> --apply`
          add-paths: api-service/scripts/games_data/candidates_*.json
          delete-branch: true
```

- [ ] **Step 2: Verify workflow syntax**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/new-release-candidates.yml'))"`
Expected: no output (valid YAML). (Run from repo root; PyYAML is available in the api-service venv.)

- [ ] **Step 3: 🛑 Tom's setup step**

Tom adds the `RAWG_API_KEY` repo secret (GitHub → Settings → Secrets and variables → Actions), using the rotated RAWG key. Then trigger the workflow once by hand (Actions → New Release Candidates → Run workflow) and confirm a PR appears.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/new-release-candidates.yml
git commit -m "ci: monthly new-release candidate PR workflow"
```

---

## Part E — Wrap-up

### Task 16: Full verification + docs

- [ ] **Step 1: Full backend suite**

Run (from `api-service/`): `python -m pytest tests/ -v`
Expected: all green (190 pre-existing + ~25 new).

- [ ] **Step 2: Full mobile suite + expo-doctor**

Run (from `mobile-app/`): `npx jest` then `npx expo-doctor`
Expected: jest all green (176 pre-existing + 6 new); expo-doctor 18/18 (two checks are network-dependent).

- [ ] **Step 3: Update ROADMAP**

Add to the Current State section of `docs/ROADMAP.md`: the 1.4.0 feature set (changelog modal, Coming Soon + unreleased exclusion, thumbs ratings with `rated_up`/`rated_down` signals and the ≥10 display threshold, fall catalog batch), and the monthly candidate pipeline (workflow name, PR-based, human-curated). Note the digest now mentions coming-soon titles.

- [ ] **Step 4: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: roadmap current state for 1.4.0 feature set"
```

- [ ] **Step 5: Ship checklist (separate, Tom-driven)**

Version bump, store "What's New" copy (`store/`), EAS build/submit, and device pass are release-runbook work — run the `/mobile-release PlayNxt` skill when ready; model the checklist on `docs/runbooks/ship-1-3-0.md`. The changelog modal's 1.4.0 entry (Task 8) should match the store copy's feature list. Deploy the API (merge to main → Cloud Run CI) BEFORE the binary reaches users so `/games/upcoming` and the rating endpoints exist when 1.4.0 launches; both endpoints are additive, so older binaries are unaffected.

---

## Plan self-review notes

- **Spec coverage:** release pipeline (T14–15), fall batch incl. future-dated entries (T13), changelog modal + analytics (T8–9), Coming Soon UI + `/games/upcoming` + engine exclusion (T2–3, T11), digest coming-soon mention on existing scheduler (T7), ratings end to end with new signal types, threshold, engine feed (T4–6, T10, T12). Out-of-scope items from the spec have no tasks, as intended.
- **Types:** `release_date` is `Optional[str]` (ISO date) everywhere; rating wire values are `"up"`/`"down"`/`null`, signal values `rated_up`/`rated_down`; `RatingSummary` shape matches `build_rating_summary` output and the mobile client's expectations.
- **Known flex points called out inline:** conftest fixture mutation timing (T3), `RecommendationRequest` constructor shape (T2), navigation route names for CTAs (T8), seed_refresh field pass-through (T13). Each has a verification step, not an assumption.
