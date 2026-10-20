"""Tests for the seasonal engine sampling script (canned responses only, no network)."""
import io
import sys
import urllib.error
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

import validate_seasonal
from validate_seasonal import DEFAULT_API, exit_code, post_json, summarize


def _run(*game_ids, fallback=False):
    return {
        "recommendations": [{"game_id": g, "title": g.title()} for g in game_ids],
        "fallback_applied": fallback,
        "fallback_message": "relaxed" if fallback else None,
        "session_id": "validate-seasonal",
    }


class TestSummarize:
    def test_counts_empty_and_fallback_runs_and_orders_tally(self):
        runs = [
            _run("a", "b", "c"),
            _run("a", "d", fallback=True),
            _run(),
        ]
        out = summarize(runs)
        assert out["empty_runs"] == 1
        assert out["fallback_runs"] == 1
        # most frequent first, ties broken by game_id
        assert out["tally"] == [("a", 2), ("b", 1), ("c", 1), ("d", 1)]

    def test_empty_input(self):
        assert summarize([]) == {"tally": [], "empty_runs": 0, "fallback_runs": 0}

    def test_run_that_is_both_empty_and_fallback_counts_in_both(self):
        out = summarize([_run(fallback=True)])
        assert out["empty_runs"] == 1
        assert out["fallback_runs"] == 1


class TestExitCode:
    def _report(self, empty=0, fallback=0, errors=0):
        return {
            "label": "x",
            "summary": {"tally": [], "empty_runs": empty, "fallback_runs": fallback},
            "errors": errors,
        }

    def test_clean_is_zero(self):
        assert exit_code([self._report(), self._report()]) == 0

    @pytest.mark.parametrize("kwargs", [{"empty": 1}, {"fallback": 2}, {"errors": 1}])
    def test_any_problem_is_one(self, kwargs):
        assert exit_code([self._report(), self._report(**kwargs)]) == 1


class TestPostJson:
    def _http_error(self, code):
        return urllib.error.HTTPError("http://x", code, "err", {}, io.BytesIO(b"{}"))

    class _Resp:
        def __init__(self, body):
            self._body = body

        def read(self):
            return self._body

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    def test_backs_off_on_429_then_succeeds(self):
        calls, sleeps = [], []

        def opener(request, timeout):
            calls.append(request)
            if len(calls) < 3:
                raise self._http_error(429)
            return self._Resp(b'{"recommendations": []}')

        result = post_json("http://x", {"a": 1}, opener=opener, sleep=sleeps.append)
        assert result == {"recommendations": []}
        assert sleeps == [5, 10]

    def test_gives_up_after_all_backoffs(self):
        sleeps = []

        def opener(request, timeout):
            raise self._http_error(429)

        assert post_json("http://x", {}, opener=opener, sleep=sleeps.append) is None
        assert sleeps == [5, 10, 20]

    def test_other_http_error_is_not_retried(self):
        sleeps = []

        def opener(request, timeout):
            raise self._http_error(500)

        assert post_json("http://x", {}, opener=opener, sleep=sleeps.append) is None
        assert sleeps == []


def test_default_api_is_playnxt_not_playbeacon():
    assert DEFAULT_API == "https://playnxt-api-167253232570.us-central1.run.app/api"
    assert "346141384720" not in DEFAULT_API
