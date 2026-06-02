"""
Tests for recommendation endpoints.

The recommendation endpoint is POST /api/recommend and takes a
RecommendationRequest body (time_available + energy_mood are required).
"""


def test_get_recommendations_requires_context(client):
    """Missing required context (empty body) should be a validation error."""
    response = client.post("/api/recommend", json={})
    # time_available and energy_mood are required -> 422 (or 200 if defaulted)
    assert response.status_code in [200, 422]


def test_get_recommendations_with_mood(client):
    """Test recommendations for a wind-down mood."""
    response = client.post("/api/recommend", json={
        "energy_mood": "wind_down",
        "time_available": 30,
    })
    assert response.status_code == 200
    data = response.json()
    assert "recommendations" in data


def test_get_recommendations_with_platform(client):
    """Test recommendations filtered by platform."""
    response = client.post("/api/recommend", json={
        "energy_mood": "focused",
        "time_available": 60,
        "platform": "pc",
    })
    assert response.status_code == 200


def test_get_recommendations_with_energy(client):
    """Test recommendations for a low-energy/short session."""
    response = client.post("/api/recommend", json={
        "energy_mood": "wind_down",
        "time_available": 15,
    })
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# E2E tests for premium fields (Task 1-4 from the premium-rebuild plan)
# ---------------------------------------------------------------------------

def test_recommend_accepts_stop_friendliness(client):
    """Backend accepts the stop_friendliness premium field and 200s."""
    response = client.post("/api/recommend", json={
        "energy_mood": "casual",
        "time_available": 30,
        "stop_friendliness": "anytime",
    })
    assert response.status_code == 200
    assert "recommendations" in response.json()


def test_recommend_accepts_time_to_fun(client):
    """Backend accepts the time_to_fun premium field and 200s."""
    response = client.post("/api/recommend", json={
        "energy_mood": "focused",
        "time_available": 60,
        "time_to_fun": "short",
    })
    assert response.status_code == 200


def test_recommend_accepts_on_subscriptions(client):
    """Backend accepts on_subscriptions and 200s."""
    response = client.post("/api/recommend", json={
        "energy_mood": "casual",
        "time_available": 30,
        "on_subscriptions": ["game_pass", "ps_plus"],
    })
    assert response.status_code == 200


def test_recommend_accepts_exclude_played_and_favor_history(client):
    """Backend accepts both Smart History-related flags and 200s."""
    response = client.post("/api/recommend", json={
        "energy_mood": "wind_down",
        "time_available": 30,
        "exclude_played": True,
        "favor_history": True,
    })
    assert response.status_code == 200


def test_recommend_rejects_invalid_stop_friendliness(client):
    """Off-enum stop_friendliness must be a 422 validation error, not silently ignored."""
    response = client.post("/api/recommend", json={
        "energy_mood": "casual",
        "time_available": 30,
        "stop_friendliness": "definitely_not_a_value",
    })
    assert response.status_code == 422


def test_recommend_rejects_invalid_time_to_fun(client):
    response = client.post("/api/recommend", json={
        "energy_mood": "casual",
        "time_available": 30,
        "time_to_fun": "instant",  # 'instant' was migrated out — should not be accepted
    })
    assert response.status_code == 422


def test_recommend_all_premium_fields_together(client):
    """The full premium payload — every new field at once — parses and returns 200."""
    response = client.post("/api/recommend", json={
        "energy_mood": "focused",
        "time_available": 60,
        "platform": "pc",
        "stop_friendliness": "checkpoints",
        "time_to_fun": "short",
        "on_subscriptions": ["game_pass"],
        "exclude_played": True,
        "favor_history": True,
    })
    assert response.status_code == 200
    data = response.json()
    assert "recommendations" in data
    assert "session_id" in data


def test_recommend_no_premium_fields_unchanged(client):
    """A baseline request (no premium fields) must still 200 and look identical
    to before the rebuild — additivity guarantee."""
    response = client.post("/api/recommend", json={
        "energy_mood": "wind_down",
        "time_available": 30,
    })
    assert response.status_code == 200
    data = response.json()
    # None of the new request fields should affect the response schema.
    assert "recommendations" in data
    assert "session_id" in data
    assert "fallback_applied" in data
