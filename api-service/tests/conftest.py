"""
Pytest configuration and fixtures for PlayNxt API tests.
"""
import pytest
from unittest.mock import MagicMock, patch


@pytest.fixture
def mock_firebase():
    """Mock Firebase connections to prevent actual DB calls."""
    with patch('src.db.firebase.get_collection') as mock_gc, \
         patch('src.db.firebase.initialize_firebase') as mock_init:
        mock_gc.return_value = MagicMock()
        mock_init.return_value = None
        yield mock_gc


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    from fastapi.testclient import TestClient
    with patch('src.db.firebase.get_collection'), \
         patch('src.db.firebase.initialize_firebase'):
        from main import app
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
        "time_tags": [15, 30],
        "play_style": ["action"],
        "multiplayer_modes": ["solo"],
        "subscription_services": [],
        "content_warnings": [],
        "store_links": {},
        "explanation_templates": {
            "relaxing": "A chill puzzle experience perfect for unwinding."
        },
        "description_short": "A fun test game.",
    }


@pytest.fixture
def sample_games():
    """Sample list of games for filtering/scoring tests."""
    return [
        {
            "game_id": "game-001",
            "title": "Action Game",
            "platforms": ["pc", "xbox"],
            "energy_level": "medium",
            "time_to_fun": "medium",
            "stop_friendliness": "checkpoints",
            "time_tags": [15, 30],
            "play_style": ["action"],
            "multiplayer_modes": ["solo"],
            "subscription_services": ["gamepass"],
            "description_short": "An action game.",
            "explanation_templates": {},
        },
        {
            "game_id": "game-002",
            "title": "Puzzle Game",
            "platforms": ["pc", "playstation"],
            "energy_level": "low",
            "time_to_fun": "short",
            "stop_friendliness": "anytime",
            "time_tags": [15, 30, 60],
            "play_style": ["puzzle_strategy"],
            "multiplayer_modes": ["solo"],
            "subscription_services": [],
            "description_short": "A puzzle game.",
            "explanation_templates": {},
        },
        {
            "game_id": "game-003",
            "title": "Handheld Game",
            "platforms": ["handheld", "mobile"],
            "energy_level": "low",
            "time_to_fun": "short",
            "stop_friendliness": "anytime",
            "time_tags": [15, 30, 60, 90],
            "play_style": ["puzzle_strategy"],
            "multiplayer_modes": ["solo"],
            "subscription_services": [],
            "description_short": "A handheld game.",
            "explanation_templates": {},
        },
    ]


@pytest.fixture
def mock_user():
    """Sample authenticated user data."""
    return {
        "uid": "user-123",
        "email": "test@example.com",
        "display_name": "Test User",
    }


@pytest.fixture
def sample_signal():
    """Sample signal document from Firestore."""
    return {
        "signal_id": "signal-001",
        "user_id": "user-123",
        "game_id": "game-001",
        "signal_type": "thumbs_up",
        "session_id": "session-001",
        "created_at": "2024-01-01T00:00:00Z",
    }


@pytest.fixture
def sample_session():
    """Sample session document from Firestore."""
    return {
        "session_id": "session-001",
        "user_id": "user-123",
        "reroll_count": 0,
        "games_shown": [],
        "created_at": "2024-01-01T00:00:00Z",
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
