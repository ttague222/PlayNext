"""Unit tests for the field-normalization transform."""

from migrate_field_names import compute_field_updates


def test_copies_old_to_new_when_new_missing():
    doc = {"year": 2014, "genres": ["puzzle"], "moods": ["chill"]}
    updates = compute_field_updates(doc)
    assert updates == {
        "release_year": 2014,
        "genre_tags": ["puzzle"],
        "mood_tags": ["chill"],
    }


def test_does_not_overwrite_existing_new_value():
    # New value is curated/authoritative; conflict must NOT be overwritten.
    doc = {"genres": ["puzzle"], "genre_tags": ["indie", "puzzle"]}
    updates = compute_field_updates(doc)
    assert "genre_tags" not in updates


def test_treats_empty_new_value_as_missing():
    doc = {"genres": ["puzzle"], "genre_tags": []}
    updates = compute_field_updates(doc)
    assert updates == {"genre_tags": ["puzzle"]}


def test_no_updates_when_nothing_to_copy():
    doc = {"release_year": 2022, "genre_tags": ["action"]}
    assert compute_field_updates(doc) == {}


def test_copies_energy_and_multiplayer_and_warnings():
    doc = {"energy": "low", "multiplayer": ["solo"], "warnings": ["violence"]}
    assert compute_field_updates(doc) == {
        "energy_level": "low",
        "multiplayer_modes": ["solo"],
        "content_warnings": ["violence"],
    }
