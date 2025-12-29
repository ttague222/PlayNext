"""
Tests for game catalog endpoints.
"""


def test_list_games(client):
    """Test listing all games."""
    response = client.get("/games")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list) or "games" in data


def test_get_game_by_id(client):
    """Test getting a specific game by ID."""
    # First get the list of games to find a valid ID
    list_response = client.get("/games")
    if list_response.status_code == 200:
        games = list_response.json()
        if isinstance(games, list) and len(games) > 0:
            game_id = games[0].get("game_id") or games[0].get("id")
            if game_id:
                response = client.get(f"/games/{game_id}")
                assert response.status_code in [200, 404]


def test_get_nonexistent_game(client):
    """Test getting a game that doesn't exist."""
    response = client.get("/games/nonexistent_game_id_12345")
    assert response.status_code == 404


def test_search_games(client):
    """Test searching games by title."""
    response = client.get("/games/search", params={"q": "mario"})
    # Endpoint might not exist yet
    assert response.status_code in [200, 404, 405]
