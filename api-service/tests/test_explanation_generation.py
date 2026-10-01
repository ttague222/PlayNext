"""Tests for field-generated explanation bullets (game card refresh P0.2).

Regression for 2026-09-30 production output: catalog templates are mostly
seeded boilerplate, so the generic "Fits a casual 30-minute session." fallback
won for most games and sat beside a near-duplicate time_fit bullet.
"""
import pytest

from src.models.recommendation import RecommendationRequest, EnergyMood
from src.services.recommendation_service import (
    MAX_EXPLANATION_BULLETS,
    MAX_TEMPLATE_SHARE,
    RecommendationService,
    _normalize_bullet,
    count_template_share,
    generate_bullets,
)

BULLET_FIELDS = ("style_fit", "stop_fit", "mood_fit", "session_fit", "time_fit")

# Catalog shapes copied from production Firestore on 2026-09-30.
KINGDOM_TWO_CROWNS = {
    "game_id": "kingdom-two-crowns",
    "title": "Kingdom Two Crowns",
    "platforms": ["pc", "switch"],
    "description_short": "d",
    "explanation_templates": {
        "stop_fit": "Easy to pause whenever you need",
        "mood_fit": "Unwind and enjoy at your own pace",
        "time_fit": "Perfect for a relaxing {time}-minute session",
        "style_fit": "Enjoyable gameplay experience",
    },
    "genre_tags": ["strategy", "indie", "simulation"],
    "play_style": ["strategy"],
    "mood_tags": ["relaxing", "strategic", "beautiful"],
    "time_to_fun": "short",
    "stop_friendliness": "anytime",
    "energy_level": "low",
    "time_tags": [15, 30, 60, 90],
}
LITTLE_KITTY = {
    "game_id": "little-kitty-big-city",
    "title": "Little Kitty, Big City",
    "platforms": ["pc", "switch"],
    "description_short": "d",
    "explanation_templates": None,
    "genre_tags": ["adventure", "exploration", "indie", "casual"],
    "play_style": ["sandbox_creative"],
    "mood_tags": ["cute", "relaxing", "charming", "fun"],
    "time_to_fun": "short",
    "stop_friendliness": "anytime",
    "energy_level": "low",
    "time_tags": [15, 30],
}
LEGO_BATMAN = {
    "game_id": "lego-batman-legacy",
    "title": "LEGO Batman: Legacy of the Dark Knight",
    "platforms": ["pc"],
    "description_short": "d",
    "explanation_templates": {},
    "genre_tags": ["action-adventure", "lego", "co-op", "comedy"],
    "play_style": ["action"],
    "mood_tags": ["fun", "lighthearted", "family-friendly"],
    "time_to_fun": "short",
    "stop_friendliness": "anytime",
    "energy_level": "low",
    "time_tags": [30, 60],
}


@pytest.fixture
def svc():
    return RecommendationService.__new__(RecommendationService)  # no Firestore needed


def _request(time=30, mood=EnergyMood.CASUAL):
    return RecommendationRequest(time_available=time, energy_mood=mood)


def _bullets(rec):
    return [getattr(rec.explanation, f) for f in BULLET_FIELDS if getattr(rec.explanation, f)]


def _response(svc, games, request):
    used = set()
    return [svc._build_recommendation(dict(g), request, used_bullets=used) for g in games]


def _game_clauses(game):
    """Phrases that tie a bullet to this game's own catalog fields."""
    return [
        "strategy game", "adventure", "action-adventure",  # genre/mechanic
        "saves anytime",  # stop-friendliness
        "fun within minutes",  # time-to-fun
        game["title"].lower(),
    ]


# --- generate_bullets -------------------------------------------------------

def test_style_bullet_combines_mood_genre_and_time_to_fun():
    style = generate_bullets(KINGDOM_TWO_CROWNS, 30)["style_fit"]
    assert style[0] == "A relaxing strategy game that's fun within minutes."


def test_style_bullet_skips_mood_tags_that_echo_the_genre():
    game = dict(KINGDOM_TWO_CROWNS, mood_tags=["strategic", "beautiful"])
    assert generate_bullets(game, 30)["style_fit"][0] == (
        "A beautiful strategy game that's fun within minutes."
    )


def test_style_bullet_prefers_specific_genre_over_broad_one():
    game = dict(KINGDOM_TWO_CROWNS, genre_tags=["action", "indie", "roguelike"], mood_tags=["intense"])
    assert generate_bullets(game, 30)["style_fit"][0].startswith("An intense roguelike ")


def test_style_bullet_falls_back_to_play_style_and_handles_no_mood():
    game = {"title": "X", "play_style": ["card_game"], "time_to_fun": "long",
            "stop_friendliness": "checkpoints"}
    assert generate_bullets(game, 60)["style_fit"][0] == (
        "A card game that rewards time spent learning it."
    )


@pytest.mark.parametrize("genre,expected", [("rpg", "An RPG"), ("open-world", "An open-world game")])
def test_style_bullet_article(genre, expected):
    game = {"title": "X", "genre_tags": [genre], "time_to_fun": "medium"}
    assert generate_bullets(game, 60)["style_fit"][0].startswith(expected + " ")


@pytest.mark.parametrize("stop,needle", [
    ("anytime", "Saves anytime"),
    ("checkpoints", "checkpoints"),
    ("commitment", "one sitting"),
])
def test_stop_bullet_reflects_stop_friendliness_and_requested_time(stop, needle):
    game = dict(KINGDOM_TWO_CROWNS, stop_friendliness=stop)
    text = generate_bullets(game, 45)["stop_fit"][0]
    assert needle in text
    assert "45 minutes" in text


def test_every_field_ends_with_a_title_variant_so_dedupe_cannot_run_dry():
    bullets = generate_bullets(LEGO_BATMAN, 30)
    for field in ("style_fit", "stop_fit"):
        assert LEGO_BATMAN["title"] in bullets[field][-1]
        assert len(set(bullets[field])) == len(bullets[field])


# --- count_template_share ---------------------------------------------------

def test_count_template_share_counts_games_not_fields():
    games = [
        {"explanation_templates": {"stop_fit": "Save anywhere.", "time_fit": "save anywhere"}},
        {"explanation_templates": {"stop_fit": "Save anywhere"}},
        {"explanation_templates": None},
        {},
    ]
    assert count_template_share(games)[_normalize_bullet("Save anywhere")] == 2


def test_boilerplate_catalog_template_is_skipped(svc):
    svc._template_share = {_normalize_bullet("Rich story to get lost in"): MAX_TEMPLATE_SHARE + 1}
    templates = {"style_fit": "Rich story to get lost in", "stop_fit": "Save between chapters"}
    selected = svc._select_explanation_fields(templates, used=set())
    assert [f for f, _ in selected] == ["stop_fit"]


def test_franchise_shared_template_is_kept(svc):
    svc._template_share = {_normalize_bullet("Authentic NBA action"): MAX_TEMPLATE_SHARE}
    selected = svc._select_explanation_fields({"mood_fit": "Authentic NBA action"}, used=set())
    assert selected == [("mood_fit", "Authentic NBA action")]


# --- response assembly ------------------------------------------------------

@pytest.fixture
def prod_svc(svc):
    games = [KINGDOM_TWO_CROWNS, LITTLE_KITTY, LEGO_BATMAN]
    # KTC's strings are each shared by 110+ catalog games in production.
    svc._template_share = {
        _normalize_bullet(t): 110 for t in KINGDOM_TWO_CROWNS["explanation_templates"].values()
    }
    return svc, games


def test_prod_casual_30_response_meets_p0_2(prod_svc):
    svc, games = prod_svc
    recs = _response(svc, games, _request(30, EnergyMood.CASUAL))
    seen = []
    for game, rec in zip(games, recs):
        bullets = _bullets(rec)
        assert 1 <= len(bullets) <= MAX_EXPLANATION_BULLETS
        for b in bullets:
            # No generic session filler; every bullet carries a game-specific clause.
            assert "minute session" not in b.lower()
            assert any(c in b.lower() for c in _game_clauses(game)), b
        seen.extend(_normalize_bullet(b) for b in bullets)
    assert len(seen) == len(set(seen)), "a bullet repeats within the response"


def test_kingdom_two_crowns_no_longer_gets_near_duplicate_session_bullets(prod_svc):
    svc, _ = prod_svc
    rec = svc._build_recommendation(dict(KINGDOM_TWO_CROWNS), _request(), used_bullets=set())
    assert rec.explanation.style_fit == "A relaxing strategy game that's fun within minutes."
    assert rec.explanation.stop_fit == (
        "Saves anytime, so you can stop the moment your 30 minutes are up."
    )
    assert rec.explanation.mood_fit is None
    assert rec.explanation.time_fit is None


def test_second_game_with_same_stop_value_gets_a_distinct_stop_bullet(prod_svc):
    svc, _ = prod_svc
    used = set()
    first = svc._build_recommendation(dict(KINGDOM_TWO_CROWNS), _request(), used_bullets=used)
    second = svc._build_recommendation(dict(LITTLE_KITTY), _request(), used_bullets=used)
    assert second.explanation.stop_fit != first.explanation.stop_fit
    assert "this adventure" in second.explanation.stop_fit


def test_identical_games_fall_through_to_title_variants(svc):
    a = dict(LITTLE_KITTY, game_id="a", title="Alpha")
    b = dict(LITTLE_KITTY, game_id="b", title="Beta")
    c = dict(LITTLE_KITTY, game_id="c", title="Gamma")
    recs = _response(svc, [a, b, c], _request())
    all_bullets = [b for r in recs for b in _bullets(r)]
    assert len(all_bullets) == len({_normalize_bullet(b) for b in all_bullets})
    assert "Gamma" in recs[2].explanation.stop_fit


def test_near_duplicate_punctuation_variants_are_deduped(svc):
    used = set()
    a = dict(LITTLE_KITTY, game_id="a", title="Alpha",
             explanation_templates={"stop_fit": "Save and quit whenever - no progress lost."})
    b = dict(LITTLE_KITTY, game_id="b", title="Beta",
             explanation_templates={"stop_fit": "Save and quit whenever: no progress lost!"})
    rec_a = svc._build_recommendation(a, _request(), used_bullets=used)
    rec_b = svc._build_recommendation(b, _request(), used_bullets=used)
    assert rec_a.explanation.stop_fit == "Save and quit whenever - no progress lost."
    assert "no progress lost" not in (rec_b.explanation.stop_fit or "")


def test_distinctive_catalog_copy_still_wins_over_generated(svc):
    game = dict(LITTLE_KITTY, explanation_templates={"style_fit": "Knock things off shelves as a cat."})
    rec = svc._build_recommendation(game, _request(), used_bullets=set())
    assert rec.explanation.style_fit == "Knock things off shelves as a cat."
    assert rec.explanation.stop_fit.startswith("Saves anytime")


def test_summary_joins_emitted_bullets_and_library_fit(prod_svc):
    svc, _ = prod_svc
    rec = svc._build_recommendation(
        dict(LITTLE_KITTY), _request(), used_bullets=set(),
        library_playtimes={"little-kitty-big-city": 0},
    )
    for b in _bullets(rec):
        assert b in rec.explanation.summary
    assert rec.explanation.summary.endswith("It's been sitting unplayed in your Steam library.")
