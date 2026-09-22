"""Tests for the monthly new-release candidate filter (pure logic only)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from new_release_candidates import filter_candidates, to_candidate_entry


def _rawg(slug, name, released, added=500, platforms=None):
    return {
        "slug": slug,
        "name": name,
        "released": released,
        "added": added,
        "platforms": [{"platform": {"slug": s}} for s in (platforms or ["pc"])],
        "genres": [{"slug": "action"}],
    }


class TestFilterCandidates:
    def test_drops_existing_and_tombstoned(self):
        results = [_rawg("new-game", "New Game", "2026-09-10"),
                   _rawg("old-game", "Old Game", "2026-09-11"),
                   _rawg("dead-game", "Dead Game", "2026-09-12")]
        out = filter_candidates(results, existing_ids={"old-game"}, tombstones={"dead-game"},
                                min_added=100)
        assert [c["slug"] for c in out] == ["new-game"]

    def test_drops_below_popularity_floor(self):
        results = [_rawg("popular", "Popular", "2026-09-10", added=500),
                   _rawg("obscure", "Obscure", "2026-09-10", added=3)]
        out = filter_candidates(results, existing_ids=set(), tombstones=set(), min_added=100)
        assert [c["slug"] for c in out] == ["popular"]

    def test_dedupes_by_slug(self):
        results = [_rawg("same", "Same", "2026-09-10"), _rawg("same", "Same", "2026-09-10")]
        out = filter_candidates(results, existing_ids=set(), tombstones=set(), min_added=100)
        assert len(out) == 1

    def test_existing_match_is_case_and_punct_insensitive_on_title(self):
        results = [_rawg("hades-ii", "Hades II", "2026-09-10")]
        out = filter_candidates(results, existing_ids=set(), tombstones=set(),
                                min_added=100, existing_titles={"hades ii"})
        assert out == []


class TestToCandidateEntry:
    def test_prefills_rawg_fields_and_blanks_curation(self):
        entry = to_candidate_entry(_rawg("new-game", "New Game", "2026-11-05",
                                         platforms=["pc", "playstation5"]))
        assert entry["game_id"] == "new-game"
        assert entry["title"] == "New Game"
        assert entry["release_date"] == "2026-11-05"
        assert entry["release_year"] == 2026
        assert "pc" in entry["platforms"] and "playstation" in entry["platforms"]
        # Curation fields deliberately blank — the human fills these in the PR.
        assert entry["time_tags"] == []
        assert entry["mood_tags"] == []
        assert entry["energy_level"] == "FILL_ME"
        assert entry["stop_friendliness"] == "FILL_ME"

    def test_handles_missing_release_date(self):
        entry = to_candidate_entry(_rawg("mystery", "Mystery", None))
        assert entry["release_date"] == ""
        assert isinstance(entry["release_year"], int)
