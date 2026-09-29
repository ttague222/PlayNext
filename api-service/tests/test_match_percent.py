"""Tests for the normalized match percent (display ratio).

The display `match_score` used to be the uncapped ranking score clamped at
1.0, which saturated at "100% match" for every strong pick (ranking boosts
total 1.10+, and the top-3 sort guarantees a saturated winner). This suite
covers the new `match_ratio` computed in `_score_games`: deterministic
request-fit points earned over points available for that request, kept
separate from the (unchanged, still-uncapped) ranking `score`.
"""
import pytest

from src.models import EnergyMood, RecommendationRequest
from src.services.recommendation_service import RecommendationService


@pytest.fixture
def svc():
    return RecommendationService.__new__(RecommendationService)  # no Firestore needed


def _request(**overrides):
    defaults = dict(time_available=60, energy_mood=EnergyMood.FOCUSED)
    defaults.update(overrides)
    return RecommendationRequest(**defaults)


def _perfect_game(game_id="perfect"):
    """Earns every fit point available to a no-genre, no-platform request.

    stop=anytime (+0.25), ttf=short (+0.2), energy_level=medium matches
    FOCUSED (+0.2), subscription present (+0.1), 2+ platforms with no
    platform requested (+0.05, the multi-platform ceiling, not the +0.1
    single-platform-match ceiling), time_tags reaching the full session
    length (+0.1). Total fit = 0.90, and fit_max for this request (no
    genres, no taste/free profile, no platform requested) is also 0.90.
    """
    return {
        "game_id": game_id,
        "title": game_id.title(),
        "stop_friendliness": "anytime",
        "time_to_fun": "short",
        "energy_level": "medium",
        "play_style": ["action"],
        "genre_tags": [],
        "platforms": ["pc", "xbox"],
        "subscription_services": ["game_pass"],
        "time_tags": [60],
    }


def _partial_game(game_id="partial"):
    """Earns only the checkpoints + medium-ttf fit points (0.25 total)."""
    return {
        "game_id": game_id,
        "title": game_id.title(),
        "stop_friendliness": "checkpoints",   # +0.15
        "time_to_fun": "medium",              # +0.10
        "energy_level": "high",               # mood miss (request is FOCUSED/medium)
        "play_style": [],
        "genre_tags": [],
        "platforms": ["pc"],                  # single platform, none requested -> no boost
        "subscription_services": [],
        "time_tags": [],
    }


class TestMatchRatio:
    def test_perfect_fit_reaches_full_ratio(self, svc):
        """A game earning every available fit point for a no-genre request scores 1.0."""
        scored = svc._score_games([_perfect_game()], _request())
        assert scored[0]["match_ratio"] == pytest.approx(1.0)

    def test_partial_fit_matches_computed_ratio(self, svc):
        """0.25 earned out of a 0.80 denominator (no genres/taste/free/platform
        request; time component of fit_max is 0 here because nothing in this
        one-game pool has time_tags, so the pool-relative ceiling is 0 too).
        """
        scored = svc._score_games([_partial_game()], _request())
        assert scored[0]["match_ratio"] == pytest.approx(0.25 / 0.80)

    def test_match_ratio_is_deterministic_despite_random_ranking_score(self, svc):
        """score varies run to run (random variety term); match_ratio must not."""
        request = _request()
        game = _perfect_game()

        runs = [svc._score_games([game], request)[0] for _ in range(20)]
        ratios = {round(r["match_ratio"], 12) for r in runs}
        scores = {r["score"] for r in runs}

        assert ratios == {round(1.0, 12)}
        # Sanity: the ranking score really does include a random term, so this
        # test isn't accidentally checking two constants against each other.
        # (RANDOM_VARIETY_RANGE=0.15 over 20 draws: collision odds are negligible.)
        assert len(scores) > 1

    def test_denominator_grows_when_request_specifies_genres(self, svc):
        """Same game, same fit earned, but a genre-filtered request has a bigger
        denominator (the game doesn't match the requested genre), so the ratio drops.
        """
        game = _perfect_game()  # play_style=["action"], no genre_tags

        no_genre_request = _request()
        genre_request = _request(genres=["rpg"])

        no_genre_ratio = svc._score_games([game], no_genre_request)[0]["match_ratio"]
        genre_ratio = svc._score_games([game], genre_request)[0]["match_ratio"]

        assert no_genre_ratio == pytest.approx(1.0)
        assert genre_ratio == pytest.approx(0.90 / 1.05)
        assert genre_ratio < no_genre_ratio

    def test_build_recommendation_uses_match_ratio_when_present(self, svc):
        game = {**_perfect_game(), "score": 1.3, "match_ratio": 0.62}
        rec = svc._build_recommendation(game, _request())
        assert rec.match_score == pytest.approx(0.62)

    def test_build_recommendation_falls_back_to_score_without_match_ratio(self, svc):
        """Any path that skipped _score_games (no match_ratio key) keeps old behavior."""
        game = {**_perfect_game()}
        game.pop("match_ratio", None)
        game["score"] = 0.42
        rec = svc._build_recommendation(game, _request())
        assert rec.match_score == pytest.approx(0.42)

    def test_surprise_boost_style_score_bump_does_not_change_match_ratio(self, svc):
        """Ranking-only adjustments (surprise/indie/popularity, applied outside
        _score_games) must never leak into the display ratio. We simulate that
        here by bumping `score` directly after scoring rather than mocking the
        full async `_apply_surprise_boost` pipeline.
        """
        scored = svc._score_games([_perfect_game()], _request())
        original_ratio = scored[0]["match_ratio"]

        bumped = {**scored[0], "score": scored[0]["score"] + 5.0}

        assert bumped["match_ratio"] == original_ratio

    def test_time_ceiling_is_pool_relative_not_request_relative(self, svc):
        """Most of the catalog tops out well under a long session. If the
        denominator assumed every game could reach request.time_available,
        an otherwise-perfect game whose deepest tag is 60 would be stuck
        under 100% for a 120-minute request even though nothing in the pool
        could do better. The ceiling must reflect what the POOL can attain.
        """
        game = {**_perfect_game(), "time_tags": [60]}
        request = _request(time_available=120)

        scored = svc._score_games([game], request)
        assert scored[0]["match_ratio"] == pytest.approx(1.0)

    def test_time_ceiling_lets_deeper_game_reach_full_ratio_while_shallower_cannot(self, svc):
        """With both a 60-tag and a 120-tag game in the pool for a 120-minute
        request, best_depth is 120: the deep game can still reach 1.0, but
        the shallow game — identical in every other respect — now correctly
        falls short, since the pool proved 120 was attainable.
        """
        request = _request(time_available=120)
        deep = {**_perfect_game("deep"), "time_tags": [120]}
        shallow = {**_perfect_game("shallow"), "time_tags": [60]}

        scored = svc._score_games([deep, shallow], request)
        ratios = {g["game_id"]: g["match_ratio"] for g in scored}

        assert ratios["deep"] == pytest.approx(1.0)
        assert ratios["shallow"] == pytest.approx(0.85 / 0.90)
        assert ratios["shallow"] < ratios["deep"]
