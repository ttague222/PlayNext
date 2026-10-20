"""Tests for the seasonal content model, loader and rule validation (spec 4, 4.1a)."""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from src.models.seasonal import CollectionParams, SeasonalContent
from src.services.seasonal_service import (
    DEFAULT_PATH,
    SeasonalContentError,
    get_seasonal,
    load_seasonal,
    validate_rules,
)

VECTORS_PATH = Path(__file__).parent / "fixtures" / "palette_vectors.json"


def _palette(name: str) -> dict:
    vectors = json.loads(VECTORS_PATH.read_text(encoding="utf-8"))
    return next(p["palette"] for p in vectors["palettes"] if p["name"] == name)


def _collection(cid: str, time_available: int = 60, **extra) -> dict:
    collection = {
        "id": cid,
        "title": f"Title {cid}",
        "blurb": "One line.",
        "params": {"time_available": time_available, "energy_mood": "casual"},
    }
    collection.update(extra)
    return collection


def _season(
    sid="s1", starts="2026-11-01", ends="2026-11-30", collections=None, palette="spooky"
) -> dict:
    return {
        "id": sid,
        "name": sid,
        "starts": starts,
        "ends": ends,
        "palette": _palette(palette),
        "collections": collections if collections is not None else [_collection(f"{sid}-a")],
    }


def _content(*seasons: dict) -> dict:
    return {"schema_version": 1, "seasons": list(seasons)}


def _errors(*seasons: dict) -> list:
    return validate_rules(SeasonalContent.model_validate(_content(*seasons)))


def test_shipped_file_is_valid():
    assert DEFAULT_PATH.name == "seasonal.json"
    assert validate_rules(load_seasonal()) == []


def test_get_seasonal_caches_and_can_be_reset():
    get_seasonal.cache_clear()
    first = get_seasonal()
    assert get_seasonal() is first
    get_seasonal.cache_clear()
    assert get_seasonal() is not first


def test_valid_content_has_no_errors():
    assert _errors(_season()) == []


def test_premium_param_rejected():
    with pytest.raises(ValidationError):
        CollectionParams(
            time_available=60, energy_mood="casual", on_subscriptions=["game_pass"]
        )


def test_library_only_rejected():
    with pytest.raises(ValidationError):
        CollectionParams(time_available=60, energy_mood="casual", library_only=True)


@pytest.mark.parametrize("minutes", [14, 241])
def test_time_available_range_enforced(minutes):
    with pytest.raises(ValidationError):
        CollectionParams(time_available=minutes, energy_mood="casual")


def test_params_defaults():
    params = CollectionParams(time_available=60, energy_mood="casual")
    assert params.genres is None
    assert params.session_type.value == "any"
    assert params.discovery_mode.value == "familiar"


def test_unknown_energy_mood_rejected():
    with pytest.raises(ValidationError):
        CollectionParams(time_available=60, energy_mood="sleepy")


def test_bad_hex_color_rejected():
    data = _content(_season())
    data["seasons"][0]["palette"]["accent_season"] = "orange"
    with pytest.raises(ValidationError):
        SeasonalContent.model_validate(data)


def test_gradient_must_have_three_stops():
    data = _content(_season())
    data["seasons"][0]["palette"]["bg_gradient"] = ["#000000", "#111111"]
    with pytest.raises(ValidationError):
        SeasonalContent.model_validate(data)


def test_unknown_schema_version_rejected():
    data = _content(_season())
    data["schema_version"] = 2
    with pytest.raises(ValidationError):
        SeasonalContent.model_validate(data)


def test_unknown_field_rejected():
    data = _content(_season())
    data["seasons"][0]["surprise"] = True
    with pytest.raises(ValidationError):
        SeasonalContent.model_validate(data)


def test_overlapping_seasons_rejected():
    errors = _errors(
        _season("a", "2026-11-01", "2026-11-30"),
        _season("b", "2026-11-30", "2026-12-05"),
    )
    assert any("overlap" in e for e in errors)


def test_adjacent_seasons_with_gap_accepted():
    assert (
        _errors(
            _season("a", "2026-11-01", "2026-11-30"),
            _season("b", "2026-12-01", "2026-12-05"),
        )
        == []
    )


def test_end_before_start_rejected():
    errors = _errors(_season("a", "2026-11-30", "2026-11-01"))
    assert any("ends before it starts" in e for e in errors)


def test_three_unwindowed_collections_rejected():
    errors = _errors(
        _season(
            collections=[
                _collection("c1", 30),
                _collection("c2", 60),
                _collection("c3", 90),
            ]
        )
    )
    assert any("more than 2" in e for e in errors)


def test_two_unwindowed_plus_micro_moment_accepted():
    # Deep Winter plus a Valentine micro-moment: the app shows the windowed
    # collection first and slices to 2.
    assert (
        _errors(
            _season(
                "winter",
                "2027-01-08",
                "2027-02-28",
                collections=[
                    _collection("w1", 90),
                    _collection("w2", 60),
                    _collection("valentine", 45, starts="2027-02-14", ends="2027-02-14"),
                ],
            )
        )
        == []
    )


def test_three_windowed_collections_on_one_date_rejected():
    errors = _errors(
        _season(
            collections=[
                _collection("m1", 30, starts="2026-11-10", ends="2026-11-12"),
                _collection("m2", 60, starts="2026-11-11", ends="2026-11-13"),
                _collection("m3", 90, starts="2026-11-12", ends="2026-11-14"),
            ]
        )
    )
    assert any("more than 2" in e for e in errors)


def test_overlapping_windowed_collections_without_triple_accepted():
    assert (
        _errors(
            _season(
                collections=[
                    _collection("m1", 30, starts="2026-11-10", ends="2026-11-12"),
                    _collection("m2", 60, starts="2026-11-12", ends="2026-11-14"),
                    _collection("m3", 90, starts="2026-11-13", ends="2026-11-15"),
                ]
            )
        )
        == []
    )


def test_micro_moment_outside_season_rejected():
    errors = _errors(
        _season(collections=[_collection("m", 45, starts="2026-12-01", ends="2026-12-02")])
    )
    assert any("outside" in e for e in errors)


def test_micro_moment_window_end_before_start_rejected():
    errors = _errors(
        _season(collections=[_collection("m", 45, starts="2026-11-12", ends="2026-11-10")])
    )
    assert any("ends before it starts" in e for e in errors)


def test_failing_palette_rejected():
    errors = _errors(_season("harvest-2026", palette="harvest"))
    assert any("focused" in e.lower() for e in errors)
    assert all(e.startswith("harvest-2026") for e in errors)


def test_duplicate_collection_ids_rejected():
    errors = _errors(
        _season("a", "2026-11-01", "2026-11-30", [_collection("dup", 30)]),
        _season("b", "2026-12-01", "2026-12-31", [_collection("dup", 60)]),
    )
    assert any("duplicate" in e.lower() and "dup" in e for e in errors)


def test_duplicate_season_ids_rejected():
    errors = _errors(
        _season("same", "2026-11-01", "2026-11-30"),
        _season("same", "2026-12-01", "2026-12-31"),
    )
    assert any("duplicate" in e.lower() and "same" in e for e in errors)


def test_concurrent_collections_with_identical_params_rejected():
    errors = _errors(_season(collections=[_collection("c1", 120), _collection("c2", 120)]))
    assert any("identical params" in e for e in errors)


def test_concurrent_collections_differing_in_one_param_accepted():
    second = _collection("c2", 120)
    second["params"]["discovery_mode"] = "surprise"
    assert _errors(_season(collections=[_collection("c1", 120), second])) == []


def test_micro_moment_with_identical_params_as_season_collection_rejected():
    errors = _errors(
        _season(
            collections=[
                _collection("c1", 60),
                _collection("m", 60, starts="2026-11-10", ends="2026-11-10"),
            ]
        )
    )
    assert any("identical params" in e for e in errors)


def test_non_concurrent_windowed_collections_may_share_params():
    assert (
        _errors(
            _season(
                collections=[
                    _collection("m1", 60, starts="2026-11-02", ends="2026-11-03"),
                    _collection("m2", 60, starts="2026-11-10", ends="2026-11-11"),
                ]
            )
        )
        == []
    )


def test_load_missing_file_raises_content_error(tmp_path):
    with pytest.raises(SeasonalContentError) as exc:
        load_seasonal(tmp_path / "nope.json")
    assert exc.value.errors


def test_load_invalid_json_raises_content_error(tmp_path):
    path = tmp_path / "seasonal.json"
    path.write_text("{not json", encoding="utf-8")
    with pytest.raises(SeasonalContentError):
        load_seasonal(path)


def test_load_schema_violation_raises_content_error(tmp_path):
    data = _content(_season())
    data["seasons"][0]["collections"][0]["params"]["library_only"] = True
    path = tmp_path / "seasonal.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(SeasonalContentError) as exc:
        load_seasonal(path)
    assert any("library_only" in e for e in exc.value.errors)


def test_load_rule_violation_raises_content_error(tmp_path):
    data = _content(
        _season("a", "2026-11-01", "2026-11-30"), _season("b", "2026-11-30", "2026-12-05")
    )
    path = tmp_path / "seasonal.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(SeasonalContentError) as exc:
        load_seasonal(path)
    assert any("overlap" in e for e in exc.value.errors)


def test_load_valid_file(tmp_path):
    path = tmp_path / "seasonal.json"
    path.write_text(json.dumps(_content(_season())), encoding="utf-8")
    content = load_seasonal(path)
    assert content.seasons[0].id == "s1"
    assert content.seasons[0].collections[0].params.time_available == 60
