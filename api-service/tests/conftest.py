"""
Pytest configuration and fixtures for PlayNxt API tests.
"""
from datetime import datetime

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


@pytest.fixture
def mock_firebase():
    """Prevent real Firebase initialization during tests."""
    with patch("src.db.firebase.initialize_firebase", return_value=None):
        yield


def _make_game_doc(data):
    """Build a fake Firestore document snapshot for a game."""
    doc = MagicMock()
    doc.id = data["game_id"]
    doc.exists = True
    doc.to_dict.return_value = dict(data)
    return doc


def _make_games_collection(games):
    """Build a fake Firestore "games" collection seeded with the given games.

    Supports the access patterns the services actually use:
    - recommendation_service._fetch_games:  collection.stream()
    - game_service.list_games:              collection.limit(l).offset(o)[.where(...)].stream()
    - game_service.get_game:                collection.document(id).get()
    """
    # release_year is required by the full Game model but is absent from the
    # lightweight sample fixtures; inject a default so get_game can build a Game.
    docs = [_make_game_doc({"release_year": 2020, **g}) for g in games]
    by_id = {g["game_id"]: d for g, d in zip(games, docs)}

    collection = MagicMock()
    collection.stream.return_value = docs

    # list_games chains .limit().offset()[.where()].stream(); make the chain
    # return the same seeded docs regardless of pagination/filter args.
    query = MagicMock()
    query.stream.return_value = docs
    query.where.return_value = query
    query.offset.return_value = query
    query.limit.return_value = query
    collection.limit.return_value = query
    collection.offset.return_value = query
    collection.where.return_value = query

    def document(game_id):
        ref = MagicMock()
        if game_id in by_id:
            ref.get.return_value = by_id[game_id]
        else:
            missing = MagicMock()
            missing.exists = False
            ref.get.return_value = missing
        return ref

    collection.document.side_effect = document
    return collection


@pytest.fixture
def client(mock_firebase, sample_games):
    """Create a test client for the FastAPI app with Firestore mocked + seeded.

    Patches get_collection in each service module so routes read the in-memory
    sample_games instead of a real Firestore. The patch is kept active for the
    whole test (via yield) because services build their collections lazily
    through singletons -- the patch must outlive fixture setup.
    """
    games_collection = _make_games_collection(sample_games)

    def fake_get_collection(name):
        if name == "games":
            return games_collection
        # signals / sessions / users aren't exercised by the endpoint tests.
        return MagicMock()

    import src.services.game_service as game_service
    import src.services.recommendation_service as recommendation_service
    import src.services.signal_service as signal_service

    # Reset singletons so each service is rebuilt against the patched collection.
    game_service._game_service = None
    recommendation_service._recommendation_service = None
    signal_service._signal_service = None

    with patch("src.services.recommendation_service.get_collection", side_effect=fake_get_collection), \
         patch("src.services.game_service.get_collection", side_effect=fake_get_collection), \
         patch("src.services.signal_service.get_collection", side_effect=fake_get_collection):
        from src.main import app
        yield TestClient(app)

    # Clear singletons so later tests don't reuse the mock-backed services.
    game_service._game_service = None
    recommendation_service._recommendation_service = None
    signal_service._signal_service = None


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
            "multiplayer_modes": ["solo", "online_coop"],
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


@pytest.fixture
def mock_user():
    """A mock authenticated user (Firebase auth claims shape).

    SignalService methods take the user id as a string; the signal-service
    tests reference it as mock_user["uid"].
    """
    return {
        "uid": "test-user-123",
        "email": "tester@example.com",
        "display_name": "Test User",
    }


@pytest.fixture
def sample_signal():
    """A stored signal document owned by mock_user.

    Used as the return value of doc.to_dict(); its user_id matches
    mock_user["uid"] so ownership checks pass for the authorized user and
    fail for a "different-user".
    """
    return {
        "signal_id": "signal-001",
        "user_id": "test-user-123",
        "session_id": "session-001",
        "game_id": "game-001",
        "game_title": "Adventure Land",
        "signal_type": "accepted",
        "context": None,
        "timestamp": datetime.utcnow(),
        "worked": None,
    }


@pytest.fixture
def sample_session():
    """A stored session document owned by mock_user.

    Shaped to construct a Session model via Session(**doc.to_dict()).
    """
    return {
        "session_id": "session-001",
        "user_id": "test-user-123",
        "started_at": datetime.utcnow(),
        "ended_at": None,
        "games_shown": [],
        "reroll_count": 0,
        "accepted_game_id": None,
    }
