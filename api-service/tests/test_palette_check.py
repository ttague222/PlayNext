"""
Tests for the seasonal palette guardrail (spec 6.3).

The vectors file is shared with the mobile app's JS port; both sides must
agree on every number in it.
"""

import json
from pathlib import Path

import pytest

from src.services.palette_check import (
    BRAND,
    LOCKED_REFERENCE_COLORS,
    TEXT_SECONDARY,
    contrast_ratio,
    delta_e2000,
    palette_violations,
)

VECTORS_PATH = Path(__file__).parent / "fixtures" / "palette_vectors.json"


@pytest.fixture(scope="module")
def vectors():
    return json.loads(VECTORS_PATH.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def spooky(vectors):
    return next(c["palette"] for c in vectors["palettes"] if c["name"] == "spooky")


def test_contrast_vectors(vectors):
    for a, b, want in vectors["contrast"]:
        assert contrast_ratio(a, b) == pytest.approx(want, abs=0.05), (a, b)


def test_delta_e_vectors(vectors):
    for a, b, want in vectors["delta_e"]:
        assert delta_e2000(a, b) == pytest.approx(want, abs=0.05), (a, b)


def test_palette_vectors(vectors):
    for case in vectors["palettes"]:
        assert (palette_violations(case["palette"]) == []) is case["safe"], case["name"]


def test_violation_messages_name_the_rule(spooky):
    bad = {**spooky, "accent_season": "#f0a33a", "on_accent_season": "#1f1300"}
    assert any("focused" in v and "delta" in v.lower() for v in palette_violations(bad))


def test_contrast_is_symmetric_and_identity_is_one():
    assert contrast_ratio("#123456", "#123456") == pytest.approx(1.0)
    assert contrast_ratio("#ffffff", "#000000") == pytest.approx(21.0)
    assert contrast_ratio("#0a0a1a", "#f857a6") == pytest.approx(contrast_ratio("#f857a6", "#0a0a1a"))


def test_delta_e_identity_is_zero():
    assert delta_e2000("#7c3aed", "#7c3aed") == pytest.approx(0.0, abs=1e-9)


def test_constants():
    assert TEXT_SECONDARY == "#a0a0a0"
    assert BRAND == "#f857a6"
    assert LOCKED_REFERENCE_COLORS["mood.wind_down"] == "#7c3aed"
    assert LOCKED_REFERENCE_COLORS["semantic.rating"] == "#fbbf24"
    assert LOCKED_REFERENCE_COLORS["brand"] == BRAND
    assert len(LOCKED_REFERENCE_COLORS) == 9


def test_light_background_stop_fails_white_text(spooky):
    bad = {**spooky, "bg_gradient": ["#0d0716", "#22103a", "#9999aa"]}
    assert any("#ffffff" in v and "#9999aa" in v for v in palette_violations(bad))


def test_secondary_text_checked_on_middle_stop(spooky):
    # Middle stop light enough to pass white (>=4.5) but fail #a0a0a0 (<4.5).
    bad = {**spooky, "bg_gradient": ["#0d0716", "#4a4a6a", "#2e1546"]}
    violations = palette_violations(bad)
    assert any(TEXT_SECONDARY in v and "#4a4a6a" in v for v in violations)


def test_secondary_text_checked_on_bottom_stop(spooky):
    # The app's tab bar sits on the bottom stop with text.secondary labels.
    # #4a4a6a passes white (>=4.5) but fails #a0a0a0 (<4.5).
    bad = {**spooky, "bg_gradient": ["#0d0716", "#22103a", "#4a4a6a"]}
    violations = palette_violations(bad)
    assert any("bottom stop #4a4a6a" in v for v in violations)


def test_brand_checked_on_lightest_stop_only(spooky):
    # Lightest stop (highest luminance) is the one measured, wherever it sits.
    bad = {**spooky, "bg_gradient": ["#d0d0e0", "#22103a", "#2e1546"]}
    violations = palette_violations(bad)
    assert any(BRAND in v and "#d0d0e0" in v for v in violations)


def test_malformed_palette_reports_instead_of_raising():
    assert palette_violations({}) != []
    assert palette_violations({"bg_gradient": ["#000000"], "accent_season": "#ff8a3d",
                               "on_accent_season": "#000000"}) != []
    assert palette_violations({"bg_gradient": ["#000000"] * 3, "accent_season": "nope",
                               "on_accent_season": "#000000"}) != []
