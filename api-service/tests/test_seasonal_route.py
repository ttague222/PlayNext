"""Tests for GET /api/seasonal and the startup content check."""

import re
from unittest.mock import patch

import pytest

from src.services.seasonal_service import SeasonalContentError, get_seasonal


def test_seasonal_returns_content(client):
    r = client.get("/api/seasonal")
    assert r.status_code == 200
    body = r.json()
    assert body["schema_version"] == 1 and len(body["seasons"]) >= 1
    assert r.headers["cache-control"] == "public, max-age=3600"


def test_seasonal_dates_are_iso_strings(client):
    s = client.get("/api/seasonal").json()["seasons"][0]
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", s["starts"])
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", s["ends"])


def test_seasonal_unexpected_failure_returns_500(client):
    with patch("src.api.routes_seasonal.get_seasonal", side_effect=RuntimeError("boom")):
        r = client.get("/api/seasonal")
    assert r.status_code == 500


def test_startup_fails_on_bad_content():
    """A bad content file must fail the container boot, not the first request."""
    from fastapi.testclient import TestClient

    from src.main import app

    bad = SeasonalContentError(["harvest-2026: bad"])
    with patch("src.main.get_seasonal", side_effect=bad), \
         patch("src.main.initialize_firebase", return_value=None):
        with pytest.raises(SeasonalContentError):
            with TestClient(app):
                pass


def test_startup_loads_content_once_when_valid():
    from fastapi.testclient import TestClient

    from src.main import app

    get_seasonal.cache_clear()
    with patch("src.main.initialize_firebase", return_value=None):
        with TestClient(app):
            assert get_seasonal.cache_info().currsize == 1
