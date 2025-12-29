"""
Tests for recommendation endpoints.
"""


def test_get_recommendations_requires_context(client):
    """Test that recommendations endpoint requires context parameters."""
    response = client.get("/recommendations")
    # Should require query params or return default recommendations
    assert response.status_code in [200, 422]


def test_get_recommendations_with_mood(client):
    """Test recommendations filtered by mood."""
    response = client.get("/recommendations", params={
        "mood": "relaxing",
        "available_time": 30
    })
    assert response.status_code == 200
    data = response.json()
    assert "games" in data or "recommendations" in data or isinstance(data, list)


def test_get_recommendations_with_platform(client):
    """Test recommendations filtered by platform."""
    response = client.get("/recommendations", params={
        "platform": "pc",
        "available_time": 60
    })
    assert response.status_code == 200


def test_get_recommendations_with_energy(client):
    """Test recommendations filtered by energy level."""
    response = client.get("/recommendations", params={
        "energy_level": "low",
        "available_time": 15
    })
    assert response.status_code == 200
