"""
Tests for Backlog Mode (premium `library_only` engine path):
picks come from the user's owned-underplayed library, never-launched games
get a tie-break boost, explanations say why, and a no-fit backlog falls
back to the full catalog rather than returning empty or wrong-mood picks.
"""
import time
from unittest.mock import MagicMock, patch

import pytest

from src.models import RecommendationRequest, EnergyMood
from src.services.recommendation_service import BACKLOG_FALLBACK_MESSAGE


def _game(game_id, title, time_tags, energy):
    return {
        "game_id": game_id,
        "title": title,
        "platforms": ["pc"],
        "energy_level": energy,
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "mood_tags": [],
        "genre_tags": ["indie"],
        "time_tags": time_tags,
        "play_style": ["action"],
        "multiplayer_modes": ["solo"],
        "subscription_services": [],
        "description_short": f"{title} description.",
        "explanation_templates": {},
    }


CATALOG = [
    _game("hades", "Hades", [15, 30], "low"),
    _game("celeste", "Celeste", [15, 30], "low"),
    _game("stardew", "Stardew Valley", [15, 30], "low"),
    _game("elden", "Elden Ring", [120], "high"),
]

LIBRARY_DOC = {
    "played_game_ids": ["stardew"],
    "owned_unplayed_game_ids": ["hades", "celeste"],
    "games": [
        {"appid": 1, "game_id": "stardew", "playtime_minutes": 900},
        {"appid": 2, "game_id": "hades", "playtime_minutes": 0},
        {"appid": 3, "game_id": "celeste", "playtime_minutes": 60},
    ],
}


def _make_service(library_doc=LIBRARY_DOC):
    from src.services.recommendation_service import RecommendationService

    with patch("src.services.recommendation_service.get_collection") as mock_get_collection:
        mock_get_collection.return_value = MagicMock()
        service = RecommendationService()

    # Serve the catalog from the in-process cache — no Firestore.
    service._games_cache = [dict(g) for g in CATALOG]
    service._games_cache_at = time.monotonic()

    lib_doc = MagicMock()
    if library_doc is None:
        lib_doc.exists = False
    else:
        lib_doc.exists = True
        lib_doc.to_dict.return_value = library_doc
    service.libraries_collection = MagicMock()
    service.libraries_collection.document.return_value.get.return_value = lib_doc
    return service


def _request(**kwargs):
    defaults = {"time_available": 30, "energy_mood": EnergyMood.CASUAL, "library_only": True}
    return RecommendationRequest(**{**defaults, **kwargs})


class TestBacklogMode:
    @pytest.mark.asyncio
    async def test_picks_come_from_backlog_only(self):
        service = _make_service()
        response = await service.get_recommendations(_request(), user_id="user-1")

        ids = {r.game_id for r in response.recommendations}
        # stardew fits the request but is played; hades + celeste are the backlog
        assert ids == {"hades", "celeste"}
        assert response.fallback_applied is False
        assert all(r.in_library for r in response.recommendations)

    @pytest.mark.asyncio
    async def test_explanation_names_the_backlog(self):
        service = _make_service()
        response = await service.get_recommendations(_request(), user_id="user-1")

        by_id = {r.game_id: r for r in response.recommendations}
        assert by_id["hades"].explanation.library_fit == (
            "It's been sitting unplayed in your Steam library."
        )
        assert "unplayed in your Steam library" in by_id["hades"].explanation.summary
        assert by_id["celeste"].explanation.library_fit == (
            "It's in your Steam library with only 60 minutes played."
        )

    @pytest.mark.asyncio
    async def test_never_played_outranks_barely_played(self):
        service = _make_service()
        # hades (0 min) and celeste (60 min) have identical fit; the boost
        # must break the tie once the variety jitter is patched out.
        with patch("src.services.recommendation_service.random.uniform", return_value=0.0):
            response = await service.get_recommendations(_request(), user_id="user-1")

        assert [r.game_id for r in response.recommendations][0] == "hades"

    @pytest.mark.asyncio
    async def test_no_fit_backlog_falls_back_to_catalog(self):
        service = _make_service()
        # 120-min intense session: nothing in the backlog matches the mood,
        # so results must come from the catalog with the fallback message —
        # never wrong-mood backlog games, never empty.
        response = await service.get_recommendations(
            _request(time_available=120, energy_mood=EnergyMood.INTENSE),
            user_id="user-1",
        )

        ids = {r.game_id for r in response.recommendations}
        assert "elden" in ids
        assert response.fallback_applied is True
        assert response.fallback_message == BACKLOG_FALLBACK_MESSAGE
        # Catalog-fallback picks don't pretend to be backlog finds
        assert all(r.explanation.library_fit is None for r in response.recommendations)

    @pytest.mark.asyncio
    async def test_exhausted_backlog_falls_back_on_reroll(self):
        service = _make_service()
        response = await service.get_recommendations(
            _request(excluded_game_ids=["hades", "celeste"]),
            user_id="user-1",
        )

        assert len(response.recommendations) >= 1
        assert response.fallback_applied is True
        assert response.fallback_message == BACKLOG_FALLBACK_MESSAGE

    @pytest.mark.asyncio
    async def test_library_only_without_sync_raises(self):
        service = _make_service(library_doc=None)
        with pytest.raises(ValueError):
            await service.get_recommendations(_request(), user_id="user-1")

    @pytest.mark.asyncio
    async def test_library_only_anonymous_raises(self):
        service = _make_service()
        with pytest.raises(ValueError):
            await service.get_recommendations(_request(), user_id=None)

    @pytest.mark.asyncio
    async def test_flag_off_keeps_standard_behavior(self):
        service = _make_service()
        response = await service.get_recommendations(
            _request(library_only=False), user_id="user-1"
        )

        ids = {r.game_id for r in response.recommendations}
        # Free tier: played library game still excluded, catalog game eligible
        assert "stardew" not in ids
        assert "celeste" in ids or "hades" in ids
        assert all(r.explanation.library_fit is None for r in response.recommendations)


class TestAllowPartialFlag:
    @pytest.mark.asyncio
    async def test_filter_games_returns_empty_when_partial_disallowed(self):
        service = _make_service()
        request = RecommendationRequest(time_available=120, energy_mood=EnergyMood.INTENSE)
        pool = [dict(g) for g in CATALOG if g["game_id"] in ("hades", "celeste")]

        filtered, fallback, _ = await service._filter_games(
            games=pool, request=request, user_id=None, allow_partial=False
        )
        assert filtered == []
        assert fallback is True

        filtered, _, _ = await service._filter_games(
            games=pool, request=request, user_id=None, allow_partial=True
        )
        assert filtered != []
