"""Tests for explanation bullet selection (game card refresh P0.2)."""
import pytest

from src.services.recommendation_service import (
    RecommendationService,
    GENERIC_FILLER,
    _normalize_bullet,
)


@pytest.fixture
def svc():
    return RecommendationService.__new__(RecommendationService)  # no Firestore needed


def test_normalize_bullet_strips_case_and_punctuation():
    assert _normalize_bullet("Enjoyable gameplay experience.") == "enjoyable gameplay experience"
    assert _normalize_bullet("  Easy to pause  ") == "easy to pause"


def test_selects_at_most_two_fields(svc):
    templates = {
        "style_fit": "Turn-based tactics reward careful planning.",
        "session_fit": "One run takes about 25 minutes.",
        "time_fit": "A run fits cleanly in {time} minutes.",
        "mood_fit": "Great when you want to focus.",
        "stop_fit": "Auto-saves between turns.",
    }
    selected = svc._select_explanation_fields(templates, used=set())
    assert len(selected) == 2
    # Most game-specific fields win: style_fit then session_fit
    assert [f for f, _ in selected] == ["style_fit", "session_fit"]


def test_filler_is_skipped(svc):
    templates = {
        "style_fit": "Enjoyable gameplay experience.",  # filler
        "mood_fit": "Unwind and enjoy at your own pace.",  # filler
        "stop_fit": "Auto-saves after every mission.",
    }
    selected = svc._select_explanation_fields(templates, used=set())
    assert [f for f, _ in selected] == ["stop_fit"]


def test_used_bullets_are_skipped_for_dedupe(svc):
    templates = {
        "style_fit": "Deck-building with poker hands.",
        "stop_fit": "Save and quit whenever - no progress lost.",
    }
    used = {_normalize_bullet("Save and quit whenever - no progress lost.")}
    selected = svc._select_explanation_fields(templates, used=used)
    assert [f for f, _ in selected] == ["style_fit"]


def test_empty_selection_when_everything_is_filler(svc):
    templates = {"mood_fit": "Enjoyable gameplay experience."}
    assert svc._select_explanation_fields(templates, used=set()) == []


def test_blocklist_entries_are_normalized():
    for entry in GENERIC_FILLER:
        assert entry == _normalize_bullet(entry), f"not normalized: {entry!r}"


from src.models.recommendation import RecommendationRequest, EnergyMood


def _game(game_id, templates):
    return {
        "game_id": game_id,
        "title": game_id.title(),
        "platforms": ["pc"],
        "description_short": "d",
        "explanation_templates": templates,
        "time_to_fun": "medium",
        "stop_friendliness": "checkpoints",
        "score": 0.9,
    }


def _request():
    return RecommendationRequest(time_available=60, energy_mood=EnergyMood.FOCUSED)


def test_build_recommendation_emits_only_selected_fields(svc):
    rec = svc._build_recommendation(
        _game("a", {
            "style_fit": "Deck-building with poker hands.",
            "mood_fit": "Great when you want to focus.",
            "stop_fit": "Auto-saves between rounds.",
            "time_fit": "A run fits in {time} minutes.",
        }),
        _request(),
        used_bullets=set(),
    )
    emitted = [f for f in ("style_fit", "session_fit", "time_fit", "stop_fit", "mood_fit")
               if getattr(rec.explanation, f)]
    assert len(emitted) == 2
    assert rec.explanation.style_fit == "Deck-building with poker hands."
    assert rec.explanation.mood_fit is None  # capped out


def test_two_games_never_share_a_bullet(svc):
    shared = {"stop_fit": "Save and quit whenever - no progress lost."}
    used = set()
    rec1 = svc._build_recommendation(_game("a", dict(shared)), _request(), used_bullets=used)
    rec2 = svc._build_recommendation(_game("b", dict(shared)), _request(), used_bullets=used)
    assert rec1.explanation.stop_fit == "Save and quit whenever - no progress lost."
    assert rec2.explanation.stop_fit is None


def test_all_filler_falls_back_to_generated_time_bullet(svc):
    rec = svc._build_recommendation(
        _game("a", {"mood_fit": "Enjoyable gameplay experience."}),
        _request(),
        used_bullets=set(),
    )
    # PRD non-negotiable: every rec has a clear explanation
    assert rec.explanation.time_fit == "Fits a focused 60-minute session."
    assert rec.explanation.mood_fit is None
    assert rec.explanation.summary


def test_library_fit_is_untouched(svc):
    rec = svc._build_recommendation(
        _game("a", {"style_fit": "Physics puzzles with real depth."}),
        _request(),
        used_bullets=set(),
        library_playtimes={"a": 0},
    )
    assert rec.explanation.library_fit == "It's been sitting unplayed in your Steam library."
