"""
Pytest configuration and fixtures for PlayNxt API tests.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def sample_game():
    """Sample game data for testing."""
    return {
        "game_id": "test_game_001",
        "title": "Test Game",
        "platforms": ["pc", "playstation", "xbox"],
        "energy_level": "medium",
        "time_to_fun": "medium",
        "stop_friendliness": "high",
        "mood_tags": ["relaxing", "cozy"],
        "genre_tags": ["puzzle", "indie"],
        "time_tags": ["15_min", "30_min"],
        "play_style": "solo",
        "multiplayer_modes": [],
        "subscription_services": [],
        "content_warnings": [],
        "store_links": {},
        "explanation_templates": {
            "relaxing": "A chill puzzle experience perfect for unwinding."
        }
    }


@pytest.fixture
def sample_user_context():
    """Sample user context for recommendation testing."""
    return {
        "available_time": 30,
        "current_mood": "relaxing",
        "energy_level": "low",
        "platforms": ["pc", "playstation"]
    }
