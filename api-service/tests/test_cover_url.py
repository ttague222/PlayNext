"""cover_url travels from the catalog record to every game response.

Regression for 2026-11-09: clients looked covers up live on RAWG by title, and
RAWG has been unreachable since about 2026-11-06, so every card fell back to a
placeholder tile. The catalog now stores cover_url and the API must pass it
through, so clients can show it without asking a third party.
"""
from src.models.game import Game, GameSummary
from src.models.recommendation import EnergyMood, RecommendationRequest
from src.services.recommendation_service import RecommendationService

COVER = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1145360/header.jpg"

GAME = {
    "game_id": "hades",
    "title": "Hades",
    "platforms": ["pc", "switch"],
    "release_year": 2020,
    "description_short": "d",
    "explanation_templates": {},
    "genre_tags": ["roguelike", "action"],
    "play_style": ["action"],
    "mood_tags": ["intense", "satisfying"],
    "time_to_fun": "short",
    "stop_friendliness": "checkpoints",
    "energy_level": "high",
    "time_tags": [30, 60],
}


def _svc():
    svc = RecommendationService.__new__(RecommendationService)  # no Firestore needed
    svc._template_share = {}
    return svc


def _request():
    return RecommendationRequest(time_available=30, energy_mood=EnergyMood.INTENSE)


def test_recommendation_carries_the_catalog_cover_url():
    rec = _svc()._build_recommendation({**GAME, "cover_url": COVER}, _request(), used_bullets=set())
    assert rec.cover_url == COVER


def test_recommendation_without_a_cover_url_sends_none():
    rec = _svc()._build_recommendation(dict(GAME), _request(), used_bullets=set())
    assert rec.cover_url is None


def test_game_detail_and_list_models_expose_cover_url():
    assert Game(**{**GAME, "cover_url": COVER}).cover_url == COVER
    assert GameSummary(**{**GAME, "cover_url": COVER}).cover_url == COVER
    assert Game(**GAME).cover_url is None


def test_game_list_summaries_carry_cover_url():
    from src.services.game_service import GameService

    svc = GameService.__new__(GameService)  # no Firestore needed
    assert svc._to_summary("hades", {**GAME, "cover_url": COVER}).cover_url == COVER
    assert svc._to_summary("hades", dict(GAME)).cover_url is None
