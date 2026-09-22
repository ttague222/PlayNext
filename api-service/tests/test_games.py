"""
Tests for game catalog endpoints.
"""

from contextlib import contextmanager
from datetime import date
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from src.services.game_service import is_released
from tests.conftest import _make_games_collection


@contextmanager
def _client_for_games(games):
    """Build a TestClient whose games collection is seeded from `games` as
    they are AT CALL TIME.

    The shared `client` fixture (conftest.py) snapshots `sample_games` into
    mock Firestore docs during fixture SETUP -- before a test body runs --
    because `client` depends on `sample_games` and both are function-scoped,
    so pytest instantiates `sample_games` first and `_make_games_collection`
    copies each dict (`dict(data)`) right then. Mutating `sample_games[i]`
    inside the test body (e.g. to set `release_date`) happens too late to
    reach those already-copied docs. This helper mirrors the `client`
    fixture's patching but builds the mock collection from `games` at call
    time, so tests can mutate sample game dicts first and see the effect.
    """
    games_collection = _make_games_collection(games)

    def fake_get_collection(name):
        if name == "games":
            return games_collection
        return MagicMock()

    import src.services.game_service as game_service
    import src.services.recommendation_service as recommendation_service
    import src.services.signal_service as signal_service

    game_service._game_service = None
    recommendation_service._recommendation_service = None
    signal_service._signal_service = None

    with patch("src.db.firebase.initialize_firebase", return_value=None), \
         patch("src.services.recommendation_service.get_collection", side_effect=fake_get_collection), \
         patch("src.services.game_service.get_collection", side_effect=fake_get_collection), \
         patch("src.services.signal_service.get_collection", side_effect=fake_get_collection):
        from src.main import app
        yield TestClient(app)

    game_service._game_service = None
    recommendation_service._recommendation_service = None
    signal_service._signal_service = None


def test_list_games(client):
    """Test listing all games."""
    response = client.get("/api/games")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list) or "games" in data


def test_get_game_by_id(client):
    """Test getting a specific game by ID."""
    # First get the list of games to find a valid ID
    list_response = client.get("/api/games")
    if list_response.status_code == 200:
        games = list_response.json()
        if isinstance(games, list) and len(games) > 0:
            game_id = games[0].get("game_id") or games[0].get("id")
            if game_id:
                response = client.get(f"/api/games/{game_id}")
                assert response.status_code in [200, 404]


def test_get_nonexistent_game(client):
    """Test getting a game that doesn't exist."""
    response = client.get("/api/games/nonexistent_game_id_12345")
    assert response.status_code == 404


def test_search_games(client):
    """Test searching games by title."""
    response = client.get("/api/games/search", params={"q": "mario"})
    # Endpoint might not exist yet
    assert response.status_code in [200, 404, 405]


def test_upcoming_endpoint_exists(client):
    response = client.get("/api/games/upcoming")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_upcoming_returns_only_future_sorted(sample_games):
    # sample_games is mutated below, so this uses _client_for_games (see its
    # docstring) rather than the shared `client` fixture -- the mock docs
    # must be built AFTER the release_date mutations, not before.
    sample_games[0]["release_date"] = "2099-12-01"
    sample_games[1]["release_date"] = "2099-01-15"
    # sample_games[2]: no release_date -> released -> excluded from upcoming
    with _client_for_games(sample_games) as client:
        response = client.get("/api/games/upcoming")
    assert response.status_code == 200
    data = response.json()
    ids = [g["game_id"] for g in data]
    assert ids == [sample_games[1]["game_id"], sample_games[0]["game_id"]]  # soonest first
    assert all(g["release_date"] for g in data)


def test_recent_excludes_unreleased(sample_games):
    from datetime import datetime, timezone
    for g in sample_games:
        g["created_at"] = datetime.now(timezone.utc)
    sample_games[0]["release_date"] = "2099-12-01"
    with _client_for_games(sample_games) as client:
        response = client.get("/api/games/recent")
    assert response.status_code == 200
    ids = [g["game_id"] for g in response.json()]
    assert sample_games[0]["game_id"] not in ids


def test_list_games_propagates_release_date(sample_games):
    sample_games[0]["release_date"] = "2020-03-20"
    with _client_for_games(sample_games) as client:
        response = client.get("/api/games")
    assert response.status_code == 200
    data = response.json()
    match = next(g for g in data if g["game_id"] == sample_games[0]["game_id"])
    assert match["release_date"] == "2020-03-20"


def test_recent_games_propagates_release_date(sample_games):
    from datetime import datetime, timezone
    for g in sample_games:
        g["created_at"] = datetime.now(timezone.utc)
    sample_games[0]["release_date"] = "2020-03-20"  # released (past date)
    with _client_for_games(sample_games) as client:
        response = client.get("/api/games/recent")
    assert response.status_code == 200
    data = response.json()
    match = next(g for g in data if g["game_id"] == sample_games[0]["game_id"])
    assert match["release_date"] == "2020-03-20"


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
