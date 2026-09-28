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
