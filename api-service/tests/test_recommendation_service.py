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

        # Patch out the random variety factor so the test isolates the
        # deterministic 0.1 subscription boost. Without this, the per-game
        # random.uniform(0, 0.3) jitter can overwhelm the 0.1 delta and the
        # comparison fails intermittently.
        with patch("src.services.recommendation_service.random.uniform", return_value=0.0):
            scored = service._score_games(games, request)

        # Look games up by id rather than position. Both games share identical
        # base characteristics here, so the only scoring difference is the 0.1
        # subscription boost.
        sub_game = next(g for g in scored if g["game_id"] == "game-001")
        no_sub_game = next(g for g in scored if g["game_id"] == "game-002")
        assert sub_game["score"] > no_sub_game["score"]

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

    @pytest.mark.asyncio
    async def test_indie_boost_reads_genre_tags(self, service):
        """Indie boost must use the canonical genre_tags field, not legacy genres."""
        service._get_global_popularity = AsyncMock(return_value={})
        service._get_user_game_history = AsyncMock(return_value=set())

        games = [
            {"game_id": "indie-1", "title": "Tiny Quest",
             "genre_tags": ["indie"], "subscription_services": [], "score": 0.5},
            {"game_id": "action-1", "title": "Big Shooter",
             "genre_tags": ["action"], "subscription_services": [], "score": 0.5},
        ]

        with patch("src.services.recommendation_service.random.uniform", return_value=0.0):
            boosted = await service._apply_surprise_boost(games, None)

        indie = next(g for g in boosted if g["game_id"] == "indie-1")
        action = next(g for g in boosted if g["game_id"] == "action-1")

        # Only the indie game receives the +0.55 boost, so it must score higher.
        assert indie["score"] > action["score"]


def test_scoring_is_deterministic():
    """Scoring must produce the same ranking every call (PRD Principle #8)."""
    from src.services.recommendation_service import RecommendationService

    service = RecommendationService.__new__(RecommendationService)

    games = [
        {
            "game_id": "game-a",
            "stop_friendliness": "anytime",
            "time_to_fun": "short",
            "energy_level": "low",
            "play_style": ["action"],
            "platforms": ["pc"],
            "subscription_services": ["game_pass"],
        },
        {
            "game_id": "game-b",
            "stop_friendliness": "commitment",
            "time_to_fun": "long",
            "energy_level": "high",
            "play_style": ["narrative"],
            "platforms": ["playstation"],
            "subscription_services": [],
        },
    ]

    request = RecommendationRequest(
        time_available=30,
        energy_mood=EnergyMood.WIND_DOWN,
    )

    # Scoring deliberately includes a small bounded jitter (RANDOM_VARIETY_RANGE)
    # so near-ties vary between rerolls. Determinism is asserted for the BASE
    # scores: with the jitter patched out, identical input must produce
    # identical scores — no hidden nondeterminism beyond the documented term.
    with patch("src.services.recommendation_service.random.uniform", return_value=0.0):
        results_1 = service._score_games(games, request)
        results_2 = service._score_games(games, request)

    scores_1 = {g["game_id"]: g["score"] for g in results_1}
    scores_2 = {g["game_id"]: g["score"] for g in results_2}

    assert scores_1 == scores_2, (
        "Base scoring must be deterministic. Same input must produce same "
        "scores once the documented variety jitter is patched out."
    )
    # game-a must outscore game-b: anytime stop + short time-to-fun + mood match
    assert scores_1["game-a"] > scores_1["game-b"], (
        "game-a has better heuristic match and must score higher than game-b"
    )
    # Output list order must also be deterministic
    ids_1 = [g["game_id"] for g in results_1]
    ids_2 = [g["game_id"] for g in results_2]
    assert ids_1 == ids_2, (
        "Output list order must be deterministic. "
        "If this fails, random.shuffle is still present in _score_games."
    )


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


class TestPremiumFilters:
    """Tests for the premium-only advanced filters."""

    @pytest.fixture
    def service(self, mock_firebase):
        from unittest.mock import MagicMock, patch as _patch
        with _patch('src.services.recommendation_service.get_collection') as mock_get_collection:
            mock_get_collection.side_effect = lambda name: MagicMock()
            from src.services.recommendation_service import RecommendationService
            return RecommendationService()

    @pytest.fixture
    def games(self):
        return [
            {"game_id": "a", "title": "A", "platforms": ["pc"], "time_tags": [30],
             "energy_level": "low", "play_style": ["action"], "genre_tags": [],
             "multiplayer_modes": ["solo"], "stop_friendliness": "anytime",
             "time_to_fun": "short", "subscription_services": ["game_pass"]},
            {"game_id": "b", "title": "B", "platforms": ["pc"], "time_tags": [30],
             "energy_level": "low", "play_style": ["action"], "genre_tags": [],
             "multiplayer_modes": ["solo"], "stop_friendliness": "commitment",
             "time_to_fun": "long", "subscription_services": []},
            {"game_id": "c", "title": "C", "platforms": ["pc"], "time_tags": [30],
             "energy_level": "low", "play_style": ["action"], "genre_tags": [],
             "multiplayer_modes": ["solo"], "stop_friendliness": "checkpoints",
             "time_to_fun": "medium", "subscription_services": ["ps_plus"]},
        ]

    def test_stop_friendliness_filter(self, service, games):
        from src.models import StopFriendliness
        req = RecommendationRequest(
            time_available=30, energy_mood=EnergyMood.CASUAL,
            stop_friendliness=StopFriendliness.ANYTIME,
        )
        out = service._apply_filters(games, req)
        assert [g["game_id"] for g in out] == ["a"]

    def test_time_to_fun_filter(self, service, games):
        from src.models import TimeToFun
        req = RecommendationRequest(
            time_available=30, energy_mood=EnergyMood.CASUAL,
            time_to_fun=TimeToFun.SHORT,
        )
        out = service._apply_filters(games, req)
        assert [g["game_id"] for g in out] == ["a"]

    def test_on_subscriptions_filter(self, service, games):
        req = RecommendationRequest(
            time_available=30, energy_mood=EnergyMood.CASUAL,
            on_subscriptions=["game_pass"],
        )
        out = service._apply_filters(games, req)
        assert [g["game_id"] for g in out] == ["a"]

    def test_no_premium_filters_no_change(self, service, games):
        """When all premium filters are None/False, every game survives."""
        req = RecommendationRequest(time_available=30, energy_mood=EnergyMood.CASUAL)
        out = service._apply_filters(games, req)
        assert len(out) == 3


class TestExcludePlayedFilter:
    """Tests for the exclude_played premium filter via _apply_filters."""

    @pytest.fixture
    def service(self, mock_firebase):
        from unittest.mock import MagicMock, patch as _patch
        with _patch('src.services.recommendation_service.get_collection') as mock_get_collection:
            mock_get_collection.side_effect = lambda name: MagicMock()
            from src.services.recommendation_service import RecommendationService
            return RecommendationService()

    @pytest.fixture
    def games(self):
        return [
            {"game_id": "a", "title": "A", "platforms": ["pc"], "time_tags": [30],
             "energy_level": "low", "play_style": ["action"], "genre_tags": [],
             "multiplayer_modes": ["solo"]},
            {"game_id": "b", "title": "B", "platforms": ["pc"], "time_tags": [30],
             "energy_level": "low", "play_style": ["action"], "genre_tags": [],
             "multiplayer_modes": ["solo"]},
            {"game_id": "c", "title": "C", "platforms": ["pc"], "time_tags": [30],
             "energy_level": "low", "play_style": ["action"], "genre_tags": [],
             "multiplayer_modes": ["solo"]},
        ]

    def test_exclude_played_removes_user_history(self, service, games):
        """exclude_played + user_history hides games the user has interacted with."""
        req = RecommendationRequest(
            time_available=30, energy_mood=EnergyMood.CASUAL,
            exclude_played=True,
        )
        out = service._apply_filters(games, req, user_history={"a", "c"})
        assert [g["game_id"] for g in out] == ["b"]

    def test_exclude_played_off_keeps_all(self, service, games):
        req = RecommendationRequest(time_available=30, energy_mood=EnergyMood.CASUAL)
        out = service._apply_filters(games, req, user_history={"a", "c"})
        assert len(out) == 3

    def test_exclude_played_without_history_is_noop(self, service, games):
        """exclude_played=True but no user_history (anonymous) keeps all games."""
        req = RecommendationRequest(
            time_available=30, energy_mood=EnergyMood.CASUAL,
            exclude_played=True,
        )
        out = service._apply_filters(games, req, user_history=None)
        assert len(out) == 3


class TestTasteProfile:
    def test_build_taste_profile_counts_genre_and_mood_tags(self):
        from src.services.recommendation_service import build_taste_profile
        games = [
            {"genre_tags": ["indie", "puzzle"], "mood_tags": ["cozy"]},
            {"genre_tags": ["indie"], "mood_tags": ["cozy", "relaxing"]},
        ]
        profile = build_taste_profile(games)
        assert profile["genres"] == {"indie": 2, "puzzle": 1}
        assert profile["moods"] == {"cozy": 2, "relaxing": 1}

    def test_build_taste_profile_empty(self):
        from src.services.recommendation_service import build_taste_profile
        assert build_taste_profile([]) == {"genres": {}, "moods": {}}


class TestFavorHistoryScoring:
    @pytest.fixture
    def service(self, mock_firebase):
        from unittest.mock import MagicMock, patch as _patch
        with _patch('src.services.recommendation_service.get_collection') as mock_get_collection:
            mock_get_collection.side_effect = lambda name: MagicMock()
            from src.services.recommendation_service import RecommendationService
            return RecommendationService()

    def test_favor_history_boosts_matching_games(self, service):
        """Games whose tags match the taste profile score higher than those that don't."""
        cozy = {"game_id": "cozy", "title": "Cozy", "platforms": ["pc"], "time_tags": [30],
                "energy_level": "low", "play_style": ["action"], "genre_tags": ["cozy"],
                "mood_tags": ["relaxing"], "stop_friendliness": "anytime",
                "time_to_fun": "short", "multiplayer_modes": ["solo"],
                "subscription_services": []}
        action = {"game_id": "action", "title": "Action", "platforms": ["pc"], "time_tags": [30],
                  "energy_level": "low", "play_style": ["action"], "genre_tags": ["action"],
                  "mood_tags": ["intense"], "stop_friendliness": "anytime",
                  "time_to_fun": "short", "multiplayer_modes": ["solo"],
                  "subscription_services": []}

        req = RecommendationRequest(
            time_available=30, energy_mood=EnergyMood.CASUAL, favor_history=True,
        )
        profile = {"genres": {"cozy": 5}, "moods": {"relaxing": 3}}

        with patch("src.services.recommendation_service.random.uniform", return_value=0.0), \
             patch("src.services.recommendation_service.random.shuffle", lambda x: None):
            scored = service._score_games([cozy, action], req, taste_profile=profile)

        cozy_g = next(g for g in scored if g["game_id"] == "cozy")
        action_g = next(g for g in scored if g["game_id"] == "action")
        assert cozy_g["score"] > action_g["score"]

    def test_no_profile_means_no_boost(self, service):
        """Without a profile, favor_history is a no-op."""
        g = {"game_id": "x", "title": "X", "platforms": ["pc"], "time_tags": [30],
             "energy_level": "low", "play_style": ["action"], "genre_tags": ["indie"],
             "mood_tags": ["cozy"], "stop_friendliness": "anytime",
             "time_to_fun": "short", "multiplayer_modes": ["solo"],
             "subscription_services": []}
        req_off = RecommendationRequest(time_available=30, energy_mood=EnergyMood.CASUAL)
        req_on = RecommendationRequest(
            time_available=30, energy_mood=EnergyMood.CASUAL, favor_history=True,
        )

        with patch("src.services.recommendation_service.random.uniform", return_value=0.0), \
             patch("src.services.recommendation_service.random.shuffle", lambda x: None):
            off = service._score_games([dict(g)], req_off, taste_profile=None)
            on = service._score_games([dict(g)], req_on, taste_profile=None)

        assert off[0]["score"] == on[0]["score"]


class TestScoreRankingAndVariety:
    """Ranking scores are uncapped; display scores stay inside the API contract.

    Regression cover for the scoring change made 2026-08-19. Previously
    _score_games clamped to min(score, 1.0) while the deterministic boosts
    also totalled 1.00, so every strong match pinned to exactly 1.0 and weaker
    games tied them. The randomness term was also wide enough (0-0.30) that a
    game fitting 0.20 worse still won roughly 17% of the time.
    """

    @pytest.fixture
    def service(self, mock_firebase):
        """Create service instance."""
        with patch('src.services.recommendation_service.get_collection'):
            from src.services.recommendation_service import RecommendationService
            return RecommendationService()

    @pytest.fixture
    def base_game(self):
        return {
            "game_id": "base",
            "title": "Base Game",
            "platforms": ["pc"],
            "time_tags": [30],
            "energy_level": "low",
            "play_style": ["action"],
            "genre_tags": ["action"],
            "time_to_fun": "medium",
            "multiplayer_modes": ["solo"],
            "description_short": "Test",
            "explanation_templates": {},
            "subscription_services": [],
        }

    def _perfect_fit(self, base_game):
        """Game hitting every deterministic boost for the request below."""
        return {
            **base_game,
            "game_id": "perfect",
            "stop_friendliness": "anytime",   # +0.25
            "time_to_fun": "short",           # +0.20
            "energy_level": "low",            # +0.20 (matches WIND_DOWN)
            "play_style": ["action"],         # +0.15 genre
            "platforms": ["pc"],              # +0.10
            "subscription_services": ["game_pass"],  # +0.10
        }

    def _good_not_perfect(self, base_game):
        """Scores 0.80: perfect fit minus the platform and subscription boosts.

        The 0.20 gap against _perfect_fit is the discriminating case. The old
        0.30 random range flipped it roughly 17% of the time; 0.15 cannot.
        """
        return {
            **self._perfect_fit(base_game),
            "game_id": "good",
            "platforms": ["console"],        # no +0.10, request asks for pc
            "subscription_services": [],     # no +0.10
        }

    def _weak_fit(self, base_game):
        return {
            **base_game,
            "game_id": "weak",
            "stop_friendliness": "commitment",
            "time_to_fun": "long",
            "energy_level": "high",
            "play_style": ["narrative"],
            "genre_tags": ["narrative"],
            "platforms": ["console"],
            "subscription_services": [],
        }

    def _request(self):
        return RecommendationRequest(
            time_available=30,
            energy_mood=EnergyMood.WIND_DOWN,
            play_style=PlayStyle.ACTION,
            platform=Platform.PC,
        )

    def test_random_variety_range_is_small(self):
        """Pin the constant. Widening it re-introduces bad-match promotion."""
        from src.services.recommendation_service import RANDOM_VARIETY_RANGE
        assert RANDOM_VARIETY_RANGE == 0.15

    def test_ranking_score_is_uncapped(self, service, base_game):
        """A perfect fit must be able to exceed 1.0 so it can outrank others."""
        scored = service._score_games([self._perfect_fit(base_game)], self._request())
        # 1.00 deterministic + a positive random term. Strict >: the old
        # min(score, 1.0) clamp pinned this to exactly 1.0.
        assert scored[0]["score"] > 1.0

    def test_match_score_stays_within_api_bounds(self, service, base_game):
        """match_score is Field(ge=0.0, le=1.0) - an uncapped raw score must not leak."""
        game = {**self._perfect_fit(base_game), "score": 1.29}
        rec = service._build_recommendation(game, self._request())
        assert rec.match_score == 1.0

        negative = {**self._weak_fit(base_game), "score": -0.4}
        rec_neg = service._build_recommendation(negative, self._request())
        assert rec_neg.match_score == 0.0

    def test_better_match_reliably_outranks_worse(self, service, base_game):
        """With a wide fit gap the better game should nearly always win.

        Under the old 0.30 range this sat around 83%.
        """
        request = self._request()
        wins = 0
        trials = 400
        for _ in range(trials):
            scored = service._score_games(
                [self._perfect_fit(base_game), self._good_not_perfect(base_game)], request
            )
            best = max(scored, key=lambda g: g["score"])
            if best["game_id"] == "perfect":
                wins += 1
        assert wins / trials >= 0.95, f"better match won only {wins}/{trials}"

    def test_randomness_still_shuffles_near_ties(self, service, base_game):
        """Variety is preserved: identically-scoring games must not lock order."""
        request = self._request()
        twin_a = {**self._perfect_fit(base_game), "game_id": "twin-a"}
        twin_b = {**self._perfect_fit(base_game), "game_id": "twin-b"}

        winners = set()
        for _ in range(200):
            scored = service._score_games([twin_a, twin_b], request)
            winners.add(max(scored, key=lambda g: g["score"])["game_id"])
            if len(winners) == 2:
                break
        assert winners == {"twin-a", "twin-b"}, "scoring became deterministic"

    @pytest.mark.asyncio
    async def test_surprise_mode_keeps_floor_but_not_ceiling(self, service, base_game):
        """Surprise mode must not re-compress the uncapped ranking scores."""
        service._get_global_popularity = AsyncMock(return_value={})
        service._get_user_game_history = AsyncMock(return_value=set())

        high = {**base_game, "game_id": "high", "title": "Obscure Indie", "score": 1.25}
        result = await service._apply_surprise_boost([high], None)

        # Floor is retained, ceiling is not: the score must not be pinned to 1.0
        assert result[0]["score"] >= 0.0
        assert result[0]["score"] > 1.0, "surprise mode re-clamped a strong match"


@pytest.mark.asyncio
async def test_anonymous_users_get_staleness_protection():
    """
    Anonymous users (no user_id) must have recently-shown games excluded
    when a session_id is provided, to prevent repeat recommendations.
    PRD §5.5: deprioritize games shown in last 7 days.
    """
    from src.services.recommendation_service import RecommendationService
    from unittest.mock import AsyncMock

    service = RecommendationService.__new__(RecommendationService)

    # Simulate: session already showed "game-seen"
    service._get_recently_shown_for_session = AsyncMock(return_value={"game-seen"})
    service._get_recently_shown = AsyncMock(return_value=set())

    games = [
        {"game_id": "game-seen", "stop_friendliness": "anytime", "time_to_fun": "short",
         "energy_level": "low", "play_style": ["action"], "platforms": ["pc"],
         "time_tags": [30], "multiplayer_modes": ["solo"], "subscription_services": []},
        {"game_id": "game-fresh", "stop_friendliness": "anytime", "time_to_fun": "short",
         "energy_level": "low", "play_style": ["action"], "platforms": ["pc"],
         "time_tags": [30], "multiplayer_modes": ["solo"], "subscription_services": []},
    ]

    request = RecommendationRequest(
        time_available=30,
        energy_mood=EnergyMood.WIND_DOWN,
        session_id="anon-session-123",
    )

    filtered, _, _ = await service._filter_games(games, request, user_id=None)
    result_ids = [g["game_id"] for g in filtered]

    assert "game-seen" not in result_ids, (
        "game-seen was recently shown in this session and must be excluded for anonymous users"
    )
    assert "game-fresh" in result_ids, "game-fresh was not recently shown and must still appear"
    # _get_recently_shown (user-based) must NOT have been called — no user_id
    service._get_recently_shown.assert_not_called()
    # _get_recently_shown_for_session must have been called with the correct session_id
    service._get_recently_shown_for_session.assert_called_once_with("anon-session-123")


class TestTimeAffinityScoring:
    """The 0-0.1 time-affinity boost added 2026-08-21.

    A 2-hour request must rank deep games (high max time_tag) above
    quick-hitters, while short requests are unaffected because every
    eligible game reaches the full ratio there.
    """

    @pytest.fixture
    def service(self, mock_firebase):
        with patch('src.services.recommendation_service.get_collection'):
            from src.services.recommendation_service import RecommendationService
            return RecommendationService()

    def _game(self, game_id, time_tags):
        return {
            "game_id": game_id,
            "title": game_id,
            "platforms": ["mobile"],
            "time_tags": time_tags,
            "energy_level": "high",
            "play_style": ["action"],
            "genre_tags": [],
            "time_to_fun": "short",
            "stop_friendliness": "anytime",
            "multiplayer_modes": ["solo"],
            "subscription_services": [],
        }

    def _score(self, service, games, time_available):
        request = RecommendationRequest(
            time_available=time_available,
            energy_mood=EnergyMood.INTENSE,
        )
        with patch("src.services.recommendation_service.random.uniform", return_value=0.0):
            scored = service._score_games(games, request)
        return {g["game_id"]: g["score"] for g in scored}

    def test_long_session_prefers_deep_games(self, service):
        games = [self._game("quick", [15, 30]), self._game("deep", [15, 30, 60, 90, 120])]
        scores = self._score(service, games, 120)
        assert scores["deep"] > scores["quick"], (
            "a 2-hour request must rank a 120-tagged game above a 30-max game"
        )

    def test_short_session_ranking_unchanged(self, service):
        games = [self._game("quick", [15, 30]), self._game("deep", [15, 30, 60, 90, 120])]
        scores = self._score(service, games, 15)
        assert scores["quick"] == scores["deep"], (
            "at 15 minutes both games max the ratio; depth must not matter"
        )

    def test_boost_is_bounded(self, service):
        games = [self._game("quick", [15]), self._game("deep", [120])]
        scores = self._score(service, games, 120)
        assert 0 < scores["deep"] - scores["quick"] <= 0.1 + 1e-9
