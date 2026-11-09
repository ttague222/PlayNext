"""Tests for the monthly new-release candidate finder (pure logic only).

The source moved from RAWG to Steam's store search after RAWG went
unreachable around 2026-11-05 and failed that month's run.
"""
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from new_release_candidates import (  # noqa: E402
    filter_candidates,
    parse_search_html,
    parse_steam_date,
    to_candidate_entry,
)

TODAY = date(2026, 11, 9)


def _row_html(app_id, title, released, reviews=None, windows=True):
    """One search result row, trimmed from a real 2026-11-09 Steam response."""
    review = (
        '<span class="search_review_summary positive" data-tooltip-html="Mostly Positive&lt;br&gt;'
        f'71% of the {reviews:,} user reviews for this game are positive.&lt;br&gt;"></span>'
        if reviews is not None else ""
    )
    platform = '<span class="platform_img win"></span>' if windows else '<span class="platform_img mac"></span>'
    return (
        f'<a href="https://store.steampowered.com/app/{app_id}/X/?snr=1_7_7_popularnew_150_2" '
        f'data-ds-appid="{app_id}" class="search_result_row ds_collapse_flag "> '
        f'<div class="search_name ellipsis"> <span class="title">{title}</span> </div> '
        f'<div class="search_platforms"> {platform} </div> '
        f'<div class="search_released responsive_secondrow"> {released} </div> '
        f'<div class="search_reviewscore responsive_secondrow"> {review} </div> </a>'
    )


def _row(app_id, title, released, reviews=0, windows=True):
    return {"app_id": app_id, "title": title, "released": released,
            "reviews": reviews, "windows": windows}


class TestParseSearchHtml:
    def test_reads_app_id_title_date_reviews_and_platform(self):
        html = _row_html("4435490", "Call of Duty®: Modern Warfare® 4", "Oct 22, 2026", reviews=6189)
        assert parse_search_html(html) == [{
            "app_id": "4435490",
            "title": "Call of Duty®: Modern Warfare® 4",
            "released": "2026-10-22",
            "reviews": 6189,
            "windows": True,
        }]

    def test_unreleased_game_has_no_reviews_and_placeholder_dates_are_none(self):
        html = _row_html("1", "Soon", "Coming soon") + _row_html("2", "Later", "2027")
        rows = parse_search_html(html)
        assert [(r["released"], r["reviews"]) for r in rows] == [(None, 0), (None, 0)]

    def test_changed_layout_parses_to_nothing(self):
        # main() treats zero rows on page 1 as a failed fetch, not a quiet month.
        assert parse_search_html("<div>nothing like a result row</div>") == []


def test_parse_steam_date_accepts_both_day_orders_and_rejects_placeholders():
    assert parse_steam_date("Oct 22, 2026") == "2026-10-22"
    assert parse_steam_date("22 Oct, 2026") == "2026-10-22"
    for placeholder in ("Q1 2027", "2027", "Nov 2026", "To be announced", ""):
        assert parse_steam_date(placeholder) is None


class TestFilterCandidates:
    def _filter(self, recent=(), upcoming=(), **kw):
        args = {"existing_ids": set(), "tombstones": set(), "min_reviews": 100}
        args.update(kw)
        return filter_candidates(list(recent), list(upcoming), TODAY, **args)

    def test_recent_needs_a_date_in_the_last_45_days_and_the_review_floor(self):
        recent = [
            _row("1", "In Window", "2026-10-22", reviews=6189),
            _row("2", "Too Old", "2012-08-21", reviews=2_000_000),  # popularnew lists old hits too
            _row("3", "Obscure", "2026-10-30", reviews=12),
        ]
        assert [r["title"] for r in self._filter(recent=recent)] == ["In Window"]

    def test_upcoming_needs_a_full_date_in_the_next_60_days(self):
        upcoming = [
            _row("1", "Next Month", "2026-12-04"),
            _row("2", "Too Far", "2027-02-23"),
            _row("3", "Undated", None),
        ]
        assert [r["title"] for r in self._filter(upcoming=upcoming)] == ["Next Month"]

    def test_drops_existing_by_title_and_tombstoned_by_slug(self):
        recent = [
            _row("1", "Hades II", "2026-10-22", reviews=500),
            _row("2", "Dead Game", "2026-10-22", reviews=500),
            _row("3", "New Game", "2026-10-22", reviews=500),
        ]
        out = self._filter(recent=recent, existing_titles={"hades ii"}, tombstones={"dead-game"})
        assert [r["title"] for r in out] == ["New Game"]

    def test_dedupes_across_lists_by_app_id(self):
        row = _row("1", "Same", "2026-10-22", reviews=500)
        assert len(self._filter(recent=[row], upcoming=[row])) == 1


class TestToCandidateEntry:
    def test_prefills_steam_fields_and_blanks_curation(self):
        # Schema matches the refresh-file format seed_refresh.transform() reads.
        entry = to_candidate_entry(_row("4435490", "Call of Duty®: Modern Warfare® 4", "2026-10-22"),
                                   genres=["action"])
        assert entry["id"] == "call-of-duty-modern-warfare-4"
        assert entry["year"] == 2026
        assert entry["release_date"] == "2026-10-22"
        assert entry["platforms"] == ["pc"]
        assert entry["genres"] == ["action"]
        assert entry["store_links"] == {"steam": "https://store.steampowered.com/app/4435490/"}
        # Curation fields deliberately blank; the human fills these in the PR.
        assert entry["time_tags"] == [] and entry["moods"] == []
        assert entry["energy"] == "FILL_ME" and entry["stop_friendliness"] == "FILL_ME"

    def test_mac_only_listing_gets_no_platform_guess(self):
        # An empty list is a visible sign a human must check platform support.
        assert to_candidate_entry(_row("1", "Mac Only", "2026-10-22", windows=False))["platforms"] == []
