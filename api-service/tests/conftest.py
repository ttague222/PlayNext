"""
Pytest configuration and fixtures for PlayNxt API tests.
"""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


@pytest.fixture
def mock_firebase():
    """Prevent real Firebase initialization during tests."""
    with patch("src.db.firebase.initialize_firebase", return_value=None):
        yield


@pytest.fixture
def client(mock_firebase):
    """Create a test client for the FastAPI app."""
    with patch("src.services.recommendation_service.get_collection", return_value=MagicMock()), \
         patch("src.services.signal_service.get_collection", return_value=MagicMock()):
        from src.main import app
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
        "stop_friendliness": "checkpoints",
        "mood_tags": ["relaxing", "cozy"],
        "genre_tags": ["puzzle", "indie"],
        "time_tags": [30, 60],
        "play_style": ["puzzle_strategy"],
        "multiplayer_modes": ["solo"],
        "subscription_services": [],
        "content_warnings": [],
        "store_links": {},
        "explanation_templates": {
            "relaxing": "A chill puzzle experience perfect for unwinding."
        }
    }


@pytest.fixture
def sample_games():
    """Multiple sample games for filter/scoring tests."""
    return [
        {
            "game_id": "game-001",
            "title": "Adventure Land",
            "platforms": ["pc", "playstation"],
            "energy_level": "low",
            "time_to_fun": "medium",
            "stop_friendliness": "checkpoints",
            "mood_tags": ["relaxing"],
            "genre_tags": ["adventure"],
            "time_tags": [15, 30],
            "play_style": ["action"],
            "multiplayer_modes": ["solo"],
            "subscription_services": [],
            "description_short": "A relaxing adventure.",
            "explanation_templates": {},
        },
        {
            "game_id": "game-002",
            "title": "Puzzle Master",
            "platforms": ["pc", "mobile"],
            "energy_level": "low",
            "time_to_fun": "short",
            "stop_friendliness": "anytime",
            "mood_tags": ["focused"],
            "genre_tags": ["puzzle"],
            "time_tags": [15, 30, 60],
            "play_style": ["puzzle_strategy"],
            "multiplayer_modes": ["solo"],
            "subscription_services": [],
            "description_short": "A challenging puzzle game.",
            "explanation_templates": {},
        },
        {
            "game_id": "game-003",
            "title": "Handheld Hero",
            "platforms": ["handheld", "mobile"],
            "energy_level": "medium",
            "time_to_fun": "medium",
            "stop_friendliness": "checkpoints",
            "mood_tags": ["casual"],
            "genre_tags": ["action"],
            "time_tags": [60, 90],
            "play_style": ["action"],
            "multiplayer_modes": ["solo", "co-op"],
            "subscription_services": ["gamepass"],
            "description_short": "A portable action game.",
            "explanation_templates": {},
        },
    ]


@pytest.fixture
def sample_user_context():
    """Sample user context for recommendation testing."""
    return {
        "available_time": 30,
        "current_mood": "relaxing",
        "energy_level": "low",
        "platforms": ["pc", "playstation"]
    }
