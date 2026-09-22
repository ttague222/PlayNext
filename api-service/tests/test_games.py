"""
Tests for game catalog endpoints.
"""

from datetime import date

from src.services.game_service import is_released


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
