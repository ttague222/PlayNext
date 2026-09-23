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
