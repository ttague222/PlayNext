"""
Catalog writes are admin-only.

Every app install signs in anonymously, so "has a Firebase token" proves
nothing. Writes need a non-anonymous token carrying the `admin` custom claim.
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.rate_limiter import limiter


ANON = {"uid": "anon-1", "firebase": {"sign_in_provider": "anonymous"}}
SIGNED_IN = {"uid": "user-1", "email": "player@example.com", "firebase": {"sign_in_provider": "google.com"}}
ADMIN = {"uid": "admin-1", "email": "admin@example.com", "admin": True, "firebase": {"sign_in_provider": "google.com"}}
# A claim only counts if it's literally true, and never on an anonymous account.
ANON_WITH_CLAIM = {"uid": "anon-2", "admin": True, "firebase": {"sign_in_provider": "anonymous"}}
TRUTHY_CLAIM = {"uid": "user-2", "admin": "yes", "firebase": {"sign_in_provider": "google.com"}}

TOKENS = {
    "anon": ANON,
    "signed-in": SIGNED_IN,
    "admin": ADMIN,
    "anon-with-claim": ANON_WITH_CLAIM,
    "truthy-claim": TRUTHY_CLAIM,
}


def _auth(kind):
    return {"Authorization": f"Bearer {kind}"}


@pytest.fixture
def game_service():
    service = MagicMock()
    service.get_game = AsyncMock(return_value=None)
    service.create_game = AsyncMock(side_effect=lambda game: {**game.model_dump(), "created_at": "2026-01-01T00:00:00", "updated_at": "2026-01-01T00:00:00"})
    service.update_game = AsyncMock(return_value=None)
    service.delete_game = AsyncMock(return_value=True)
    service.seed_game = AsyncMock(return_value=True)
    return service


@pytest.fixture
def sample_game(sample_game):
    # The shared fixture predates release_year being required on GameCreate.
    return {**sample_game, "release_year": 2020}


@pytest.fixture
def api(mock_firebase, game_service):
    with patch("src.api.auth.auth.verify_id_token", side_effect=lambda token: TOKENS[token]), \
         patch("src.api.routes_games.get_game_service", return_value=game_service):
        from fastapi.testclient import TestClient
        from src.main import app
        yield TestClient(app)


WRITES = [
    ("post", "/api/games/seed", []),
    ("post", "/api/games", None),  # body filled from sample_game
    ("put", "/api/games/test_game_001", {"title": "Defaced"}),
    ("delete", "/api/games/test_game_001", None),
]


def _call(api, method, path, body, sample_game, headers=None):
    if method == "post" and body is None:
        body = sample_game
    kwargs = {"headers": headers or {}}
    if body is not None:
        kwargs["json"] = body
    return getattr(api, method)(path, **kwargs)


@pytest.mark.parametrize("method,path,body", WRITES)
def test_write_without_token_is_401(api, sample_game, game_service, method, path, body):
    response = _call(api, method, path, body, sample_game)
    assert response.status_code == 401
    game_service.seed_game.assert_not_called()
    game_service.create_game.assert_not_called()
    game_service.update_game.assert_not_called()
    game_service.delete_game.assert_not_called()


@pytest.mark.parametrize("kind", ["anon", "signed-in", "anon-with-claim", "truthy-claim"])
@pytest.mark.parametrize("method,path,body", WRITES)
def test_write_without_admin_claim_is_403(api, sample_game, game_service, method, path, body, kind):
    response = _call(api, method, path, body, sample_game, _auth(kind))
    assert response.status_code == 403
    game_service.seed_game.assert_not_called()
    game_service.create_game.assert_not_called()
    game_service.update_game.assert_not_called()
    game_service.delete_game.assert_not_called()


def test_admin_can_create(api, sample_game, game_service):
    response = api.post("/api/games", json=sample_game, headers=_auth("admin"))
    assert response.status_code == 200
    game_service.create_game.assert_awaited_once()


def test_admin_can_delete(api, game_service):
    response = api.delete("/api/games/test_game_001", headers=_auth("admin"))
    assert response.status_code == 200
    game_service.delete_game.assert_awaited_once_with("test_game_001")


def test_admin_can_seed(api, sample_game, game_service):
    response = api.post("/api/games/seed", json=[sample_game], headers=_auth("admin"))
    assert response.status_code == 200
    assert response.json()["success"] == 1


@pytest.mark.parametrize("link", ["javascript:alert(1)", "data:text/html,hi", "//evil.example", "ftp://x.example"])
def test_create_rejects_non_http_store_links(api, sample_game, game_service, link):
    game = {**sample_game, "store_links": {"steam": link}}
    response = api.post("/api/games", json=game, headers=_auth("admin"))
    assert response.status_code == 422
    game_service.create_game.assert_not_called()


def test_create_rejects_non_http_link_in_other(api, sample_game, game_service):
    game = {**sample_game, "store_links": {"other": {"itch": "javascript:alert(1)"}}}
    response = api.post("/api/games", json=game, headers=_auth("admin"))
    assert response.status_code == 422


def test_update_rejects_non_http_store_links(api, game_service):
    response = api.put(
        "/api/games/test_game_001",
        json={"store_links": {"steam": "javascript:alert(1)"}},
        headers=_auth("admin"),
    )
    assert response.status_code == 422
    game_service.update_game.assert_not_called()


def test_seed_rejects_non_http_store_links(api, sample_game, game_service):
    game = {**sample_game, "store_links": {"epic": "javascript:alert(1)"}}
    response = api.post("/api/games/seed", json=[game], headers=_auth("admin"))
    assert response.status_code == 422
    game_service.seed_game.assert_not_called()


def test_create_accepts_https_store_links(api, sample_game, game_service):
    game = {**sample_game, "store_links": {"steam": "https://store.steampowered.com/app/1"}}
    response = api.post("/api/games", json=game, headers=_auth("admin"))
    assert response.status_code == 200


@pytest.fixture
def rate_limited():
    limiter.enabled = True


def test_catalog_stats_is_rate_limited(api, game_service, rate_limited):
    game_service.get_catalog_stats = AsyncMock(return_value={"total_games": 0})
    codes = [api.get("/api/games/stats").status_code for _ in range(12)]
    assert codes[:10] == [200] * 10
    assert codes[-1] == 429


def test_default_limit_applies_to_undecorated_routes(api, game_service, rate_limited):
    """The middleware must be attached, or default_limits never run."""
    from src.core.config import settings
    codes = [api.get("/health").status_code for _ in range(settings.rate_limit_requests + 1)]
    assert codes[0] == 200
    assert codes[-1] == 429


def test_catalog_stats_are_cached(mock_firebase):
    """A second stats call inside the cache window must not re-read the catalog."""
    from src.services.game_service import GameService

    collection = MagicMock()
    collection.stream.return_value = []
    with patch("src.services.game_service.get_collection", return_value=collection):
        service = GameService()
        asyncio.run(service.get_catalog_stats())
        asyncio.run(service.get_catalog_stats())
    assert collection.stream.call_count == 1
