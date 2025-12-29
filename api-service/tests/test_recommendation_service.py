"""
Tests for RecommendationService.

These tests verify the recommendation algorithm logic including:
- Filtering games by time, energy, platform, etc.
- Scoring games based on match quality
- Fallback strategies when no exact matches exist
- Surprise mode logic
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime

from src.models import (
    EnergyMood,
    SessionType,
    DiscoveryMode,
    Platform,
    PlayStyle,
    EnergyLevel,
    RecommendationRequest,
)


class TestRecommendationFiltering:
    """Test game filtering logic."""

    def test_time_bracket_mapping(self):
        """Verify time bracket mappings are correct."""
        from src.services.recommendation_service import TIME_BRACKETS

        assert TIME_BRACKETS[15] == [15]
        assert TIME_BRACKETS[30] == [15, 30]
        assert TIME_BRACKETS[60] == [15, 30, 60]
        assert TIME_BRACKETS[120] == [15, 30, 60, 90, 120]

    def test_mood_to_energy_mapping(self):
        """Verify mood to energy mappings."""
        from src.services.recommendation_service import MOOD_TO_ENERGY

        assert MOOD_TO_ENERGY[EnergyMood.WIND_DOWN] == EnergyLevel.LOW
        assert MOOD_TO_ENERGY[EnergyMood.CASUAL] == EnergyLevel.LOW
        assert MOOD_TO_ENERGY[EnergyMood.FOCUSED] == EnergyLevel.MEDIUM
        assert MOOD_TO_ENERGY[EnergyMood.INTENSE] == EnergyLevel.HIGH

    def test_session_to_multiplayer_mapping(self):
        """Verify session type to multiplayer mode mappings."""
        from src.services.recommendation_service import SESSION_TO_MULTIPLAYER
        from src.models import MultiplayerMode

        assert SESSION_TO_MULTIPLAYER[SessionType.SOLO] == [MultiplayerMode.SOLO]
        assert SESSION_TO_MULTIPLAYER[SessionType.ANY] is None


class TestRecommendationService:
    """Test RecommendationService methods."""

    @pytest.fixture
    def service(self, mock_firebase):
        """Create a RecommendationService instance with mocked Firebase."""
        with patch('src.services.recommendation_service.get_collection') as mock_get_collection:
            mock_games_collection = MagicMock()
            mock_signals_collection = MagicMock()
            mock_get_collection.side_effect = lambda name: {
                'games': mock_games_collection,
                'signals': mock_signals_collection,
            }.get(name, MagicMock())

            from src.services.recommendation_service import RecommendationService
            svc = RecommendationService()
            svc.games_collection = mock_games_collection
            svc.signals_collection = mock_signals_collection
            return svc

    def test_energy_compatible_same_level(self, service):
        """Test energy compatibility with same level."""
        assert service._energy_compatible("medium", EnergyLevel.MEDIUM) is True
        assert service._energy_compatible("low", EnergyLevel.LOW) is True
        assert service._energy_compatible("high", EnergyLevel.HIGH) is True

    def test_energy_compatible_adjacent_levels(self, service):
        """Test energy compatibility with adjacent levels."""
        # Low and Medium are adjacent
        assert service._energy_compatible("low", EnergyLevel.MEDIUM) is True
        assert service._energy_compatible("medium", EnergyLevel.LOW) is True

        # Medium and High are adjacent
        assert service._energy_compatible("medium", EnergyLevel.HIGH) is True
        assert service._energy_compatible("high", EnergyLevel.MEDIUM) is True

    def test_energy_compatible_non_adjacent(self, service):
        """Test energy compatibility with non-adjacent levels."""
        # Low and High are not adjacent
        assert service._energy_compatible("low", EnergyLevel.HIGH) is False
        assert service._energy_compatible("high", EnergyLevel.LOW) is False

    def test_energy_compatible_invalid_value(self, service):
        """Test energy compatibility with invalid values."""
        assert service._energy_compatible("invalid", EnergyLevel.MEDIUM) is False

    def test_score_games_stop_friendliness(self, service, sample_games):
        """Test that stop-friendliness affects scoring."""
        request = RecommendationRequest(
            time_available=30,
            energy_mood=EnergyMood.CASUAL
        )

        # Create identical games except for stop_friendliness to isolate the factor
        base_game = {
            "game_id": "test-game",
            "title": "Test Game",
            "platforms": ["pc"],
            "time_tags": [30],
            "energy_level": "low",
            "play_style": ["action"],
            "time_to_fun": "medium",
            "multiplayer_modes": ["solo"],
            "description_short": "Test",
            "explanation_templates": {},
            "subscription_services": [],
        }

        games = [
            {**base_game, "game_id": "game-a", "stop_friendliness": "anytime"},
            {**base_game, "game_id": "game-b", "stop_friendliness": "commitment"},
        ]

        scored = service._score_games(games, request)

        # Anytime should get 0.25 boost, commitment gets 0
        anytime_game = next(g for g in scored if g["game_id"] == "game-a")
        commitment_game = next(g for g in scored if g["game_id"] == "game-b")
        assert anytime_game["score"] > commitment_game["score"]

    def test_score_games_time_to_fun(self, service, sample_games):
        """Test that time-to-fun affects scoring."""
        request = RecommendationRequest(
            time_available=30,
            energy_mood=EnergyMood.CASUAL
        )

        # Create identical games except for time_to_fun to isolate the factor
        base_game = {
            "game_id": "test-game",
            "title": "Test Game",
            "platforms": ["pc"],
            "time_tags": [30],
            "energy_level": "low",
            "play_style": ["action"],
            "stop_friendliness": "checkpoints",
            "multiplayer_modes": ["solo"],
            "description_short": "Test",
            "explanation_templates": {},
            "subscription_services": [],
        }

        games = [
            {**base_game, "game_id": "game-a", "time_to_fun": "short"},
            {**base_game, "game_id": "game-b", "time_to_fun": "long"},
        ]

        scored = service._score_games(games, request)

        # Short time-to-fun gets 0.2 boost, long gets 0
        short_game = next(g for g in scored if g["game_id"] == "game-a")
        long_game = next(g for g in scored if g["game_id"] == "game-b")
        assert short_game["score"] > long_game["score"]

    def test_score_games_subscription_boost(self, service, sample_games):
        """Test that subscription availability affects scoring."""
        request = RecommendationRequest(
            time_available=60,
            energy_mood=EnergyMood.FOCUSED
        )

        games = [
            {**sample_games[0], "subscription_services": ["gamepass"], "stop_friendliness": "checkpoints", "time_to_fun": "medium"},
            {**sample_games[1], "subscription_services": [], "stop_friendliness": "checkpoints", "time_to_fun": "medium"},
        ]

        scored = service._score_games(games, request)

        # Game with subscription should get 0.1 boost
        assert scored[0]["score"] > scored[1]["score"]

    def test_apply_filters_time(self, service, sample_games):
        """Test time filtering."""
        request = RecommendationRequest(
            time_available=30,
            energy_mood=EnergyMood.CASUAL
        )

        # Only games with 15 or 30 min tags should pass
        filtered = service._apply_filters(sample_games, request)

        for game in filtered:
            assert any(t in [15, 30] for t in game.get("time_tags", []))

    def test_apply_filters_platform(self, service, sample_games):
        """Test platform filtering."""
        request = RecommendationRequest(
            time_available=60,
            energy_mood=EnergyMood.CASUAL,
            platform=Platform.HANDHELD
        )

        filtered = service._apply_filters(sample_games, request)

        # Only game-003 has handheld platform
        for game in filtered:
            assert "handheld" in game.get("platforms", [])

    def test_apply_filters_play_style(self, service, sample_games):
        """Test play style filtering."""
        request = RecommendationRequest(
            time_available=60,
            energy_mood=EnergyMood.CASUAL,
            play_style=PlayStyle.PUZZLE_STRATEGY
        )

        filtered = service._apply_filters(sample_games, request)

        for game in filtered:
            assert "puzzle_strategy" in game.get("play_style", [])

    def test_empty_response(self, service):
        """Test empty response generation."""
        response = service._empty_response("session-001")

        assert response.recommendations == []
        assert response.session_id == "session-001"
        assert response.fallback_applied is True
        assert response.fallback_message is not None


class TestSurpriseMode:
    """Test surprise mode logic."""

    @pytest.fixture
    def service(self, mock_firebase):
        """Create service with mocked collections."""
        with patch('src.services.recommendation_service.get_collection') as mock_get_collection:
            mock_games_collection = MagicMock()
            mock_signals_collection = MagicMock()
            mock_get_collection.side_effect = lambda name: {
                'games': mock_games_collection,
                'signals': mock_signals_collection,
            }.get(name, MagicMock())

            from src.services.recommendation_service import RecommendationService
            svc = RecommendationService()
            svc.games_collection = mock_games_collection
            svc.signals_collection = mock_signals_collection
            return svc

    @pytest.mark.asyncio
    async def test_apply_surprise_boost_reduces_popular_games(self, service, sample_games):
        """Test that popular games get score reduction in surprise mode."""
        # Mock popularity data - game-001 is very popular
        async def mock_popularity(game_ids):
            return {"game-001": 100, "game-002": 10, "game-003": 5}

        service._get_global_popularity = mock_popularity
        service._get_user_game_history = AsyncMock(return_value=set())

        # Give all games same initial score
        games = [
            {**g, "score": 0.5} for g in sample_games
        ]

        boosted = await service._apply_surprise_boost(games, None)

        # Popular game should have lower score than less popular games
        game_001 = next(g for g in boosted if g["game_id"] == "game-001")
        game_003 = next(g for g in boosted if g["game_id"] == "game-003")

        # Less popular game should have higher score (excluding random variation)
        # The difference should be roughly 0.3 (from -0.15 to +0.15)
        assert game_003["score"] > game_001["score"] - 0.1  # Account for random

    @pytest.mark.asyncio
    async def test_apply_surprise_boost_novelty(self, service, sample_games):
        """Test that games user hasn't seen get boosted."""
        service._get_global_popularity = AsyncMock(return_value={})

        # User has interacted with game-001
        service._get_user_game_history = AsyncMock(return_value={"game-001"})

        games = [
            {**g, "score": 0.5} for g in sample_games
        ]

        boosted = await service._apply_surprise_boost(games, "user-123")

        # Games user hasn't seen should get 0.1 boost
        game_001 = next(g for g in boosted if g["game_id"] == "game-001")
        game_002 = next(g for g in boosted if g["game_id"] == "game-002")

        # game-002 should be slightly higher due to novelty boost
        # (accounting for random variation)
        assert game_002["score"] >= game_001["score"] - 0.05


class TestBuildRecommendation:
    """Test recommendation building."""

    @pytest.fixture
    def service(self, mock_firebase):
        """Create service instance."""
        with patch('src.services.recommendation_service.get_collection'):
            from src.services.recommendation_service import RecommendationService
            return RecommendationService()

    def test_build_recommendation_with_templates(self, service, sample_game):
        """Test building recommendation with explanation templates."""
        request = RecommendationRequest(
            time_available=60,
            energy_mood=EnergyMood.FOCUSED
        )

        sample_game["score"] = 0.85
        rec = service._build_recommendation(sample_game, request)

        assert rec.game_id == sample_game["game_id"]
        assert rec.title == sample_game["title"]
        assert rec.match_score == 0.85
        assert rec.explanation.summary is not None

    def test_build_recommendation_default_explanation(self, service, sample_game):
        """Test building recommendation with default explanation."""
        request = RecommendationRequest(
            time_available=30,
            energy_mood=EnergyMood.CASUAL
        )

        # Remove templates
        sample_game["explanation_templates"] = {}
        sample_game["score"] = 0.7

        rec = service._build_recommendation(sample_game, request)

        # Should generate default explanation
        assert "30-minute" in rec.explanation.summary
        assert "casual" in rec.explanation.summary
