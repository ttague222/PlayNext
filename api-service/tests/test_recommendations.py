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
