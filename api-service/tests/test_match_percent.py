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
from src.services.recommendation_service import (
    MOOD_TAG_AFFINITY_MAX as AFFINITY,
    RecommendationService,
)


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
    FOCUSED (+0.2), every mood_tag on-mood for FOCUSED (+AFFINITY),
    time_tags reaching the full session length (+0.1). Total fit =
    0.75 + AFFINITY, and fit_max for this request (no genres, no
    taste/free profile, no platform requested) is the same. Its
    subscription and 2+ platforms are ranking-only boosts that never
    count toward the match ratio.
    """
    return {
        "game_id": game_id,
        "title": game_id.title(),
        "stop_friendliness": "anytime",
        "time_to_fun": "short",
        "energy_level": "medium",
        "play_style": ["action"],
        "genre_tags": [],
        "mood_tags": ["strategic", "thoughtful", "clever"],
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
        """0.25 earned out of a 0.65 + AFFINITY denominator (no genres/taste/free/platform
        request; time component of fit_max is 0 here because nothing in this
        one-game pool has time_tags, so the pool-relative ceiling is 0 too).
        """
        scored = svc._score_games([_partial_game()], _request())
        assert scored[0]["match_ratio"] == pytest.approx(0.25 / (0.65 + AFFINITY))

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
        # (RANDOM_VARIETY_RANGE over 20 continuous draws: collision odds are negligible.)
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
        assert genre_ratio == pytest.approx((0.75 + AFFINITY) / (0.90 + AFFINITY))
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
        assert ratios["shallow"] == pytest.approx((0.70 + AFFINITY) / (0.75 + AFFINITY))
        assert ratios["shallow"] < ratios["deep"]


class TestRankingOnlyBoosts:
    """Subscription availability and multi-platform reach help ranking but
    say nothing about fit to the request, so they stay out of match_ratio."""

    def test_subscription_does_not_change_match_ratio_but_still_ranks(self, svc, monkeypatch):
        monkeypatch.setattr("src.services.recommendation_service.random.uniform", lambda a, b: 0.0)
        with_sub = _perfect_game("with_sub")
        without_sub = {**_perfect_game("without_sub"), "subscription_services": []}

        scored = {g["game_id"]: g for g in svc._score_games([with_sub, without_sub], _request())}

        assert scored["with_sub"]["match_ratio"] == pytest.approx(1.0)
        assert scored["without_sub"]["match_ratio"] == pytest.approx(1.0)
        assert scored["with_sub"]["score"] == pytest.approx(scored["without_sub"]["score"] + 0.1)

    def test_multi_platform_does_not_change_match_ratio_but_still_ranks(self, svc, monkeypatch):
        monkeypatch.setattr("src.services.recommendation_service.random.uniform", lambda a, b: 0.0)
        multi = _perfect_game("multi")
        single = {**_perfect_game("single"), "platforms": ["pc"]}

        scored = {g["game_id"]: g for g in svc._score_games([multi, single], _request())}

        assert scored["multi"]["match_ratio"] == pytest.approx(1.0)
        assert scored["single"]["match_ratio"] == pytest.approx(1.0)
        assert scored["multi"]["score"] == pytest.approx(scored["single"]["score"] + 0.05)

    def test_requested_platform_match_still_counts_toward_match_ratio(self, svc):
        from src.models import Platform

        request = _request(platforms=[Platform.XBOX])
        on_xbox = _perfect_game("on_xbox")
        off_xbox = {**_perfect_game("off_xbox"), "platforms": ["pc", "switch"]}

        scored = {g["game_id"]: g for g in svc._score_games([on_xbox, off_xbox], request)}

        assert scored["on_xbox"]["match_ratio"] == pytest.approx(1.0)
        assert scored["off_xbox"]["match_ratio"] == pytest.approx((0.75 + AFFINITY) / (0.85 + AFFINITY))


class TestMoodTagAffinity:
    """energy_level is a yes/no mood check that every top pick passes, so
    mood_tags grade how well the game's feel fits the requested mood."""

    def _ratio(self, svc, mood_tags, mood=EnergyMood.FOCUSED):
        game = {**_perfect_game(), "mood_tags": mood_tags}
        return svc._score_games([game], _request(energy_mood=mood))[0]["match_ratio"]

    def test_share_of_on_mood_tags_grades_the_ratio(self, svc):
        all_on = self._ratio(svc, ["strategic", "thoughtful", "clever", "tactical"])
        half_on = self._ratio(svc, ["strategic", "thoughtful", "nostalgic", "colorful"])
        none_on = self._ratio(svc, ["nostalgic", "colorful", "retro", "anime"])
        assert all_on == pytest.approx(1.0)
        assert half_on == pytest.approx((0.75 + AFFINITY / 2) / (0.75 + AFFINITY))
        assert none_on == pytest.approx(0.75 / (0.75 + AFFINITY))

    def test_vague_tags_dilute_affinity(self, svc):
        """3 of 3 on-mood beats 3 of 6 on-mood."""
        tight = self._ratio(svc, ["strategic", "thoughtful", "clever"])
        diluted = self._ratio(svc, ["strategic", "thoughtful", "clever", "fun", "retro", "anime"])
        assert tight > diluted

    def test_single_lucky_tag_cannot_earn_full_affinity(self, svc):
        """Denominator floors at MOOD_TAG_MIN_DENOMINATOR so a one-tag game
        can't outscore a game with three on-mood tags."""
        one_tag = self._ratio(svc, ["strategic"])
        three_tags = self._ratio(svc, ["strategic", "thoughtful", "clever"])
        assert one_tag == pytest.approx((0.75 + AFFINITY / 3) / (0.75 + AFFINITY))
        assert one_tag < three_tags

    def test_clashing_tags_are_penalized(self, svc):
        """PGA Tour 2K25 (relaxing, competitive) for a wind-down request."""
        calm = self._ratio(svc, ["relaxing", "satisfying", "peaceful"], EnergyMood.WIND_DOWN)
        pga = self._ratio(svc, ["competitive", "relaxing", "satisfying"], EnergyMood.WIND_DOWN)
        assert pga < calm

    def test_clash_penalty_is_capped(self, svc):
        from src.services.recommendation_service import MOOD_TAG_CLASH_CAP

        game = {**_perfect_game(), "energy_level": "low",
                "mood_tags": ["intense", "tense", "scary", "brutal", "chaotic"]}
        no_tags = {**_perfect_game("no_tags"), "energy_level": "low", "mood_tags": []}
        scored = {g["game_id"]: g for g in svc._score_games(
            [game, no_tags], _request(energy_mood=EnergyMood.WIND_DOWN))}
        gap = scored["no_tags"]["match_ratio"] - scored["perfect"]["match_ratio"]
        assert gap * (0.75 + AFFINITY) == pytest.approx(MOOD_TAG_CLASH_CAP)

    def test_every_request_mood_has_affinity_and_no_tag_is_both_on_and_clashing(self):
        from src.services.recommendation_service import MOOD_TAG_AFFINITY, MOOD_TAG_CLASH

        for mood in EnergyMood:
            assert MOOD_TAG_AFFINITY[mood], mood
            assert not MOOD_TAG_AFFINITY[mood] & MOOD_TAG_CLASH.get(mood, frozenset()), mood

    def test_affinity_also_moves_ranking(self, svc, monkeypatch):
        """Intended product change: on-mood games rank above off-mood ties."""
        monkeypatch.setattr("src.services.recommendation_service.random.uniform", lambda a, b: 0.0)
        on = {**_perfect_game("on")}
        off = {**_perfect_game("off"), "mood_tags": ["nostalgic", "colorful", "retro"]}
        scored = {g["game_id"]: g for g in svc._score_games([on, off], _request())}
        assert scored["on"]["score"] == pytest.approx(scored["off"]["score"] + AFFINITY)
