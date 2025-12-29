"""
Tests for Pydantic models.

These tests verify model validation, serialization, and constraints.
"""

import pytest
from datetime import datetime
from pydantic import ValidationError

from src.models import (
    # Game models
    EnergyLevel,
    TimeToFun,
    StopFriendliness,
    Platform,
    PlayStyle,
    MultiplayerMode,
    GameBase,
    GameCreate,
    Game,
    GameSummary,
    # Recommendation models
    EnergyMood,
    SessionType,
    DiscoveryMode,
    RecommendationRequest,
    RecommendationExplanation,
    GameRecommendation,
    RecommendationResponse,
    # User models
    SignalType,
    UserSignalCreate,
    FeedbackRequest,
)


class TestEnums:
    """Test enum definitions."""

    def test_energy_level_values(self):
        assert EnergyLevel.LOW.value == "low"
        assert EnergyLevel.MEDIUM.value == "medium"
        assert EnergyLevel.HIGH.value == "high"

    def test_platform_values(self):
        assert Platform.PC.value == "pc"
        assert Platform.CONSOLE.value == "console"
        assert Platform.HANDHELD.value == "handheld"

    def test_energy_mood_values(self):
        assert EnergyMood.WIND_DOWN.value == "wind_down"
        assert EnergyMood.CASUAL.value == "casual"
        assert EnergyMood.FOCUSED.value == "focused"
        assert EnergyMood.INTENSE.value == "intense"

    def test_session_type_values(self):
        assert SessionType.SOLO.value == "solo"
        assert SessionType.COUCH_COOP.value == "couch_coop"
        assert SessionType.ONLINE_FRIENDS.value == "online_friends"
        assert SessionType.ANY.value == "any"

    def test_discovery_mode_values(self):
        assert DiscoveryMode.FAMILIAR.value == "familiar"
        assert DiscoveryMode.SURPRISE.value == "surprise"

    def test_signal_type_values(self):
        assert SignalType.ACCEPTED.value == "accepted"
        assert SignalType.SKIPPED.value == "skipped"


class TestRecommendationRequest:
    """Test RecommendationRequest model."""

    def test_valid_request(self):
        request = RecommendationRequest(
            time_available=60,
            energy_mood=EnergyMood.FOCUSED
        )
        assert request.time_available == 60
        assert request.energy_mood == EnergyMood.FOCUSED
        assert request.session_type == SessionType.SOLO  # default
        assert request.discovery_mode == DiscoveryMode.FAMILIAR  # default

    def test_full_request(self):
        request = RecommendationRequest(
            time_available=30,
            energy_mood=EnergyMood.CASUAL,
            play_style=PlayStyle.PUZZLE_STRATEGY,
            platform=Platform.PC,
            session_type=SessionType.COUCH_COOP,
            discovery_mode=DiscoveryMode.SURPRISE,
            session_id="test-session",
            excluded_game_ids=["game-1", "game-2"]
        )
        assert request.play_style == PlayStyle.PUZZLE_STRATEGY
        assert request.platform == Platform.PC
        assert len(request.excluded_game_ids) == 2

    def test_time_minimum_validation(self):
        with pytest.raises(ValidationError) as exc_info:
            RecommendationRequest(
                time_available=10,  # Below minimum of 15
                energy_mood=EnergyMood.CASUAL
            )
        assert "time_available" in str(exc_info.value)

    def test_time_maximum_validation(self):
        with pytest.raises(ValidationError) as exc_info:
            RecommendationRequest(
                time_available=300,  # Above maximum of 240
                energy_mood=EnergyMood.CASUAL
            )
        assert "time_available" in str(exc_info.value)

    def test_missing_required_fields(self):
        with pytest.raises(ValidationError):
            RecommendationRequest(time_available=60)  # Missing energy_mood


class TestGameRecommendation:
    """Test GameRecommendation model."""

    def test_valid_recommendation(self):
        rec = GameRecommendation(
            game_id="game-001",
            title="Test Game",
            platforms=[Platform.PC, Platform.CONSOLE],
            description_short="A great game",
            explanation=RecommendationExplanation(summary="Perfect match"),
            time_to_fun=TimeToFun.SHORT,
            stop_friendliness=StopFriendliness.ANYTIME,
            match_score=0.85
        )
        assert rec.game_id == "game-001"
        assert len(rec.platforms) == 2
        assert rec.match_score == 0.85

    def test_match_score_bounds(self):
        # Valid score at boundaries
        rec_min = GameRecommendation(
            game_id="game-001",
            title="Test",
            platforms=[Platform.PC],
            description_short="Test",
            explanation=RecommendationExplanation(summary="Test"),
            time_to_fun=TimeToFun.SHORT,
            stop_friendliness=StopFriendliness.ANYTIME,
            match_score=0.0
        )
        assert rec_min.match_score == 0.0

        rec_max = GameRecommendation(
            game_id="game-001",
            title="Test",
            platforms=[Platform.PC],
            description_short="Test",
            explanation=RecommendationExplanation(summary="Test"),
            time_to_fun=TimeToFun.SHORT,
            stop_friendliness=StopFriendliness.ANYTIME,
            match_score=1.0
        )
        assert rec_max.match_score == 1.0

    def test_match_score_out_of_bounds(self):
        with pytest.raises(ValidationError):
            GameRecommendation(
                game_id="game-001",
                title="Test",
                platforms=[Platform.PC],
                description_short="Test",
                explanation=RecommendationExplanation(summary="Test"),
                time_to_fun=TimeToFun.SHORT,
                stop_friendliness=StopFriendliness.ANYTIME,
                match_score=1.5  # Above max
            )


class TestRecommendationResponse:
    """Test RecommendationResponse model."""

    def test_valid_response(self):
        rec = GameRecommendation(
            game_id="game-001",
            title="Test",
            platforms=[Platform.PC],
            description_short="Test",
            explanation=RecommendationExplanation(summary="Test"),
            time_to_fun=TimeToFun.SHORT,
            stop_friendliness=StopFriendliness.ANYTIME,
            match_score=0.8
        )
        response = RecommendationResponse(
            recommendations=[rec],
            session_id="session-001"
        )
        assert len(response.recommendations) == 1
        assert response.fallback_applied is False

    def test_response_with_fallback(self):
        response = RecommendationResponse(
            recommendations=[],
            session_id="session-001",
            fallback_applied=True,
            fallback_message="No exact matches found"
        )
        assert response.fallback_applied is True
        assert response.fallback_message is not None


class TestFeedbackRequest:
    """Test FeedbackRequest model."""

    def test_valid_feedback(self):
        feedback = FeedbackRequest(
            game_id="game-001",
            signal_type=SignalType.ACCEPTED,
            session_id="session-001"
        )
        assert feedback.game_id == "game-001"
        assert feedback.signal_type == SignalType.ACCEPTED


class TestGameModels:
    """Test game-related models."""

    def test_game_summary(self):
        summary = GameSummary(
            game_id="game-001",
            title="Test Game",
            platforms=[Platform.PC],
            description_short="A test game",
            time_to_fun=TimeToFun.SHORT,
            stop_friendliness=StopFriendliness.ANYTIME
        )
        assert summary.game_id == "game-001"
        assert summary.title == "Test Game"

    def test_game_base_required_fields(self):
        with pytest.raises(ValidationError):
            GameBase(title="Test")  # Missing required fields
