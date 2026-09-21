"""
Tests for free-tier Steam library integration in the recommendation engine:
played library games are excluded from the candidate pool, and
owned-but-unplayed library games are flagged in_library on result cards.
"""
from unittest.mock import MagicMock, patch

import pytest

from src.models import RecommendationRequest, EnergyMood


def _make_service(library_doc=None):
    """RecommendationService with a mocked library document."""
    from src.services.recommendation_service import RecommendationService

    with patch("src.services.recommendation_service.get_collection") as mock_get_collection:
        mock_get_collection.return_value = MagicMock()
        service = RecommendationService()

    lib_doc = MagicMock()
    if library_doc is None:
        lib_doc.exists = False
    else:
        lib_doc.exists = True
        lib_doc.to_dict.return_value = library_doc
    service.libraries_collection = MagicMock()
    service.libraries_collection.document.return_value.get.return_value = lib_doc
    return service


class TestGetLibraryData:
    @pytest.mark.asyncio
    async def test_no_library_returns_none(self):
        service = _make_service(library_doc=None)
        assert await service._get_library_data("user-1") is None

    @pytest.mark.asyncio
    async def test_empty_library_returns_none(self):
        service = _make_service(library_doc={"played_game_ids": [], "owned_unplayed_game_ids": []})
        assert await service._get_library_data("user-1") is None

    @pytest.mark.asyncio
    async def test_returns_played_and_unplayed_sets(self):
        service = _make_service(library_doc={
            "played_game_ids": ["game-001"],
            "owned_unplayed_game_ids": ["game-002", "game-003"],
        })
        data = await service._get_library_data("user-1")
        assert data["played"] == {"game-001"}
        assert data["owned_unplayed"] == {"game-002", "game-003"}

    @pytest.mark.asyncio
    async def test_firestore_error_returns_none(self):
        service = _make_service()
        service.libraries_collection.document.return_value.get.side_effect = RuntimeError("boom")
        assert await service._get_library_data("user-1") is None


class TestLibraryExclusionInFiltering:
    @pytest.mark.asyncio
    async def test_played_games_are_excluded(self, sample_games):
        service = _make_service()
        request = RecommendationRequest(time_available=30, energy_mood=EnergyMood.CASUAL)

        filtered, _, _ = await service._filter_games(
            games=[dict(g) for g in sample_games],
            request=request,
            user_id="user-1",
            signal_data={"recently_shown": set(), "rejected": set(),
                         "positive_ids": [], "negative_ids": []},
            library_played={"game-001"},
        )
        assert "game-001" not in {g["game_id"] for g in filtered}

    @pytest.mark.asyncio
    async def test_no_library_changes_nothing(self, sample_games):
        service = _make_service()
        request = RecommendationRequest(time_available=30, energy_mood=EnergyMood.CASUAL)

        with_lib, _, _ = await service._filter_games(
            games=[dict(g) for g in sample_games],
            request=request,
            user_id="user-1",
            signal_data={"recently_shown": set(), "rejected": set(),
                         "positive_ids": [], "negative_ids": []},
            library_played=None,
        )
        without_lib, _, _ = await service._filter_games(
            games=[dict(g) for g in sample_games],
            request=request,
            user_id="user-1",
            signal_data={"recently_shown": set(), "rejected": set(),
                         "positive_ids": [], "negative_ids": []},
        )
        assert {g["game_id"] for g in with_lib} == {g["game_id"] for g in without_lib}


class TestInLibraryFlag:
    def test_flag_set_for_owned_unplayed(self, sample_game):
        service = _make_service()
        request = RecommendationRequest(time_available=30, energy_mood=EnergyMood.CASUAL)

        rec = service._build_recommendation(
            dict(sample_game), request, in_library_ids={"test_game_001"}
        )
        assert rec.in_library is True

    def test_flag_defaults_false(self, sample_game):
        service = _make_service()
        request = RecommendationRequest(time_available=30, energy_mood=EnergyMood.CASUAL)

        rec = service._build_recommendation(dict(sample_game), request)
        assert rec.in_library is False

        rec = service._build_recommendation(
            dict(sample_game), request, in_library_ids={"other-game"}
        )
        assert rec.in_library is False
