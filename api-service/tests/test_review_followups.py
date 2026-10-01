"""Follow-ups from the 2026-10-01 review of PRs #17 and #19.

- Cards are ordered by match % (the number they show), not ranking score.
- Swap requests (limit < 3) never repeat a bullet already on screen.
- 2+ hour sessions aren't phrased as "120 minutes".
- Lowercase-led titles keep their casing.
- Bullet normalization folds curly quotes and keeps accented letters.
- Mood-tag tables are checked against the catalog.
"""
import logging
import time
from unittest.mock import MagicMock, patch

import pytest

from src.models import RecommendationRequest, EnergyMood
from src.services.recommendation_service import (
    GENERIC_FILLER,
    LONG_SESSION_MINUTES,
    MOOD_TAG_AFFINITY,
    MOOD_TAG_CLASH,
    RecommendationService,
    _normalize_bullet,
    display_order,
    generate_bullets,
    unmatched_mood_tags,
)

BULLET_FIELDS = ("style_fit", "stop_fit", "mood_fit", "session_fit", "time_fit")


def _game(game_id, title, **overrides):
    game = {
        "game_id": game_id,
        "title": title,
        "platforms": ["pc"],
        "energy_level": "low",
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "mood_tags": [],
        "genre_tags": ["adventure"],
        "time_tags": [15, 30],
        "play_style": ["action"],
        "multiplayer_modes": ["solo"],
        "subscription_services": [],
        "description_short": f"{title} description.",
        "explanation_templates": {},
    }
    game.update(overrides)
    return game


def _make_service(catalog):
    with patch("src.services.recommendation_service.get_collection") as mock_get_collection:
        mock_get_collection.return_value = MagicMock()
        service = RecommendationService()
    service._games_cache = [dict(g) for g in catalog]
    service._games_cache_at = time.monotonic()
    return service


def _request(**kwargs):
    defaults = {"time_available": 30, "energy_mood": EnergyMood.CASUAL}
    return RecommendationRequest(**{**defaults, **kwargs})


def _bullets(rec):
    return [getattr(rec.explanation, f) for f in BULLET_FIELDS if getattr(rec.explanation, f)]


# --- display order (review #19-1) -------------------------------------------

# Ranks first on score only because of ranking-only boosts (subscription and
# multi-platform), but fits the casual request worse than the others.
BOOSTED = _game("boosted", "Boosted", subscription_services=["xbox_game_pass"],
                platforms=["pc", "xbox"], mood_tags=["nostalgic", "retro", "anime"])
ON_MOOD = _game("on_mood", "On Mood", mood_tags=["cozy", "charming", "cute"])
MIDDLE = _game("middle", "Middle", mood_tags=["cozy", "retro", "anime"])
OFF_ENERGY = _game("off_energy", "Off Energy", energy_level="medium")


@pytest.fixture
def no_jitter():
    with patch("src.services.recommendation_service.random.uniform", return_value=0.0):
        yield


@pytest.mark.asyncio
async def test_cards_are_ordered_by_match_percent(no_jitter):
    service = _make_service([BOOSTED, ON_MOOD, MIDDLE, OFF_ENERGY])
    response = await service.get_recommendations(_request())
    ids = [r.game_id for r in response.recommendations]
    scores = [r.match_score for r in response.recommendations]
    # Same three picks the ranking score chose...
    assert set(ids) == {"boosted", "on_mood", "middle"}
    # ...shown highest match % first, so "TOP PICK" is never below card #2.
    assert scores == sorted(scores, reverse=True)
    assert ids[0] == "on_mood"
    assert ids[-1] == "boosted"


def test_display_order_is_stable_for_ties():
    games = [{"game_id": "a", "match_ratio": 0.9}, {"game_id": "b", "match_ratio": 0.9},
             {"game_id": "c", "match_ratio": 1.0}]
    assert [g["game_id"] for g in display_order(games)] == ["c", "a", "b"]


@pytest.mark.asyncio
async def test_limit_returns_the_top_ranked_pick_only(no_jitter):
    service = _make_service([BOOSTED, ON_MOOD, MIDDLE, OFF_ENERGY])
    response = await service.get_recommendations(_request(limit=1))
    # limit picks by ranking score (same as the first slot of a full response
    # before display ordering), then returns just that many.
    assert [r.game_id for r in response.recommendations] == ["boosted"]


def test_limit_is_bounded():
    with pytest.raises(ValueError):
        _request(limit=0)
    with pytest.raises(ValueError):
        _request(limit=4)


# --- swap requests (review #17-1) -------------------------------------------

ON_SCREEN = _game("on_screen", "On Screen", mood_tags=["cute"])
LOOKALIKE = _game("lookalike", "Lookalike", mood_tags=["cute"])


@pytest.mark.asyncio
async def test_swap_never_repeats_an_on_screen_bullet(no_jitter):
    service = _make_service([ON_SCREEN, LOOKALIKE])
    on_screen_candidates = {
        _normalize_bullet(b) for bullets in generate_bullets(ON_SCREEN, 30).values() for b in bullets
    }

    swap = await service.get_recommendations(
        _request(limit=1, excluded_game_ids=["on_screen"])
    )

    assert [r.game_id for r in swap.recommendations] == ["lookalike"]
    for bullet in _bullets(swap.recommendations[0]):
        assert _normalize_bullet(bullet) not in on_screen_candidates, bullet


@pytest.mark.asyncio
async def test_full_reroll_with_exclusions_keeps_natural_bullets(no_jitter):
    """A full (non-swap) reroll replaces every card, so excluded games don't
    seed dedupe and the replacement keeps its most natural phrasing."""
    service = _make_service([ON_SCREEN, LOOKALIKE])
    response = await service.get_recommendations(_request(excluded_game_ids=["on_screen"]))
    rec = response.recommendations[0]
    assert rec.explanation.stop_fit == "Saves anytime, so you can stop the moment your 30 minutes are up."


# --- long sessions (review #17-3) -------------------------------------------

@pytest.mark.parametrize("stop", ["anytime", "checkpoints", "commitment"])
def test_two_plus_hours_is_not_phrased_as_120_minutes(stop):
    game = _game("g", "Some Game", stop_friendliness=stop)
    for bullet in generate_bullets(game, LONG_SESSION_MINUTES)["stop_fit"]:
        assert "120" not in bullet
        assert "minutes" not in bullet
        assert "long" in bullet


def test_shorter_sessions_still_name_the_minutes():
    game = _game("g", "Some Game")
    assert "90 minutes" in generate_bullets(game, 90)["stop_fit"][0]


# --- capitalization (review #17-5) ------------------------------------------

@pytest.mark.parametrize("title", ["eFootball", "theHunter: Call of the Wild"])
def test_lowercase_led_titles_keep_their_casing(title):
    game = _game("g", title, stop_friendliness="commitment", genre_tags=["sports"])
    stop = generate_bullets(game, 30)["stop_fit"]
    assert stop[1].startswith("This sports game plays best")
    assert stop[2].startswith(f"{title} plays best")
    style = generate_bullets(game, 30)["style_fit"]
    assert style[-1].startswith(f"{title} is ")


# --- normalization (review #17-6) -------------------------------------------

def test_curly_apostrophes_fold_to_straight():
    assert _normalize_bullet("You’ll be having fun") == _normalize_bullet("You'll be having fun")
    assert _normalize_bullet("You’ll be having fun") == "you'll be having fun"


def test_accented_letters_stay_in_one_word():
    assert _normalize_bullet("Pokémon battles!") == "pokémon battles"


def test_filler_entries_are_still_normalized():
    for entry in GENERIC_FILLER:
        assert entry == _normalize_bullet(entry)


# --- fallback bookkeeping (review #17-4) ------------------------------------

def test_fallback_bullet_is_registered_as_used():
    """Reachable only when two picks share a title: every generated variant is
    already used, so the guarantee path emits the style title variant. It must
    be registered in used_bullets like any other emitted bullet."""
    svc = RecommendationService.__new__(RecommendationService)
    game = _game("g", "Twin")
    used = {_normalize_bullet(b) for bullets in generate_bullets(game, 30).values() for b in bullets}
    used_before = set(used)
    rec = svc._build_recommendation(dict(game), _request(), used_bullets=used)
    assert rec.explanation.style_fit == generate_bullets(game, 30)["style_fit"][-1]
    assert used == used_before | {_normalize_bullet(rec.explanation.style_fit)}


# --- mood-tag tables vs catalog (review #19-5) -------------------------------

def test_unmatched_mood_tags_lists_mapped_tags_missing_from_catalog():
    catalog = [{"mood_tags": ["relaxing", "cozy"]}, {"mood_tags": None}, {}]
    missing = unmatched_mood_tags(catalog)
    assert "relaxing" not in missing and "cozy" not in missing
    every_mapped = set().union(*MOOD_TAG_AFFINITY.values(), *MOOD_TAG_CLASH.values())
    assert missing == every_mapped - {"relaxing", "cozy"}


@pytest.mark.asyncio
async def test_catalog_refresh_warns_once_about_unmatched_tags(caplog):
    every_mapped = set().union(*MOOD_TAG_AFFINITY.values(), *MOOD_TAG_CLASH.values())
    docs = []
    for i, tags in enumerate([sorted(every_mapped - {"zen"})]):
        doc = MagicMock()
        doc.id = f"g{i}"
        doc.to_dict.return_value = {"title": "T", "mood_tags": tags}
        docs.append(doc)
    service = _make_service([])
    service._games_cache = None
    service.games_collection = MagicMock()
    service.games_collection.stream.side_effect = lambda: iter(docs)

    with caplog.at_level(logging.WARNING, logger="playnext-api.recommendation"):
        await service._fetch_games()
        service._games_cache_at = 0.0  # force a second refresh
        await service._fetch_games()

    warnings = [r for r in caplog.records if "zen" in r.getMessage()]
    assert len(warnings) == 1
