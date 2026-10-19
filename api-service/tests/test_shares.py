"""Tests for the shares API (shareable results).

A share is the record behind a /s/<share-id> landing page: the picks a user
actually saw, stored so the page can show them verbatim rather than re-running
the engine (which could return different games).

Firestore is replaced with an in-memory fake collection so create and read
round-trip for real.
"""

from unittest.mock import MagicMock, patch

import pytest


def _fake_shares_collection():
    """In-memory stand-in for the Firestore "shares" collection.

    Supports the access the service uses: collection.document(id).set(data)
    and collection.document(id).get().
    """
    store = {}

    collection = MagicMock()

    def document(share_id):
        ref = MagicMock()

        def _set(data):
            store[share_id] = dict(data)

        def _get():
            snap = MagicMock()
            snap.id = share_id
            snap.exists = share_id in store
            snap.to_dict.return_value = store.get(share_id)
            return snap

        ref.set.side_effect = _set
        ref.get.side_effect = _get
        return ref

    collection.document.side_effect = document
    collection._store = store
    return collection


@pytest.fixture
def shares_collection():
    """Patch the share service onto an in-memory collection."""
    collection = _fake_shares_collection()

    import src.services.share_service as share_service

    share_service._share_service = None
    with patch("src.services.share_service.get_collection", return_value=collection):
        yield collection
    share_service._share_service = None


@pytest.fixture
def share_payload():
    return {
        "surface": "web",
        "sharer_id": "anon-abc123",
        "time_available": 30,
        "energy_mood": "wind_down",
        "picks": [
            {
                "game_id": "game-001",
                "title": "Adventure Land",
                "match_percentage": 92,
                "why": "Saves anytime, so you can stop when your 30 minutes are up.",
            }
        ],
    }


def test_create_share_returns_a_share_id(client, shares_collection, share_payload):
    resp = client.post("/api/shares", json=share_payload)

    assert resp.status_code == 201
    assert resp.json()["share_id"]


def test_get_share_returns_the_picks_that_were_stored(client, shares_collection, share_payload):
    share_id = client.post("/api/shares", json=share_payload).json()["share_id"]

    resp = client.get(f"/api/shares/{share_id}")

    assert resp.status_code == 200
    body = resp.json()
    assert body["time_available"] == 30
    assert body["energy_mood"] == "wind_down"
    assert [p["title"] for p in body["picks"]] == ["Adventure Land"]


def test_get_share_preserves_the_why_line_the_sharer_saw(client, shares_collection, share_payload):
    share_id = client.post("/api/shares", json=share_payload).json()["share_id"]

    resp = client.get(f"/api/shares/{share_id}")

    assert resp.json()["picks"][0]["why"] == (
        "Saves anytime, so you can stop when your 30 minutes are up."
    )


def test_get_unknown_share_returns_404(client, shares_collection):
    resp = client.get("/api/shares/doesNotExist")

    assert resp.status_code == 404


def test_create_share_rejects_more_than_three_picks(client, shares_collection, share_payload):
    pick = share_payload["picks"][0]
    share_payload["picks"] = [dict(pick, game_id=f"game-00{i}") for i in range(4)]

    resp = client.post("/api/shares", json=share_payload)

    assert resp.status_code == 422


def test_create_share_rejects_an_empty_pick_list(client, shares_collection, share_payload):
    share_payload["picks"] = []

    resp = client.post("/api/shares", json=share_payload)

    assert resp.status_code == 422


def test_share_ids_are_not_reused(client, shares_collection, share_payload):
    first = client.post("/api/shares", json=share_payload).json()["share_id"]
    second = client.post("/api/shares", json=share_payload).json()["share_id"]

    assert first != second


# --- Security: client-supplied content must not reach the share page ---


def test_create_share_takes_the_title_from_the_catalog_not_the_client(
    client, shares_collection, share_payload
):
    """A share page is first-party content, so titles come from our catalog."""
    share_payload["picks"][0]["title"] = "Totally Fake Game — click here"

    share_id = client.post("/api/shares", json=share_payload).json()["share_id"]

    body = client.get(f"/api/shares/{share_id}").json()
    assert body["picks"][0]["title"] == "Adventure Land"


def test_create_share_rejects_a_pick_that_is_not_in_the_catalog(
    client, shares_collection, share_payload
):
    share_payload["picks"][0]["game_id"] = "not-a-real-game"

    resp = client.post("/api/shares", json=share_payload)

    assert resp.status_code == 400


def test_create_share_ignores_a_client_supplied_cover_url(
    client, shares_collection, share_payload
):
    """Cover art is resolved by the landing page; accepting a URL here would
    let a caller point a playnxt.io page at anything."""
    share_payload["picks"][0]["cover_url"] = "https://evil.example/beacon.png"

    share_id = client.post("/api/shares", json=share_payload).json()["share_id"]

    body = client.get(f"/api/shares/{share_id}").json()
    assert "evil.example" not in str(body)


# --- Security: the public share must not leak who shared it ---


def test_public_share_does_not_expose_the_sharer_id(client, shares_collection, share_payload):
    """Share links are public, so the response must not name the sharer."""
    share_id = client.post("/api/shares", json=share_payload).json()["share_id"]

    body = client.get(f"/api/shares/{share_id}").json()

    assert "sharer_id" not in body
    assert "anon-abc123" not in str(body)


def test_public_share_carries_a_stable_sharer_token_for_attribution(
    client, shares_collection, share_payload
):
    """Attribution still needs to group shares by sharer, without naming them."""
    first = client.post("/api/shares", json=share_payload).json()["share_id"]
    second = client.post("/api/shares", json=share_payload).json()["share_id"]

    token_a = client.get(f"/api/shares/{first}").json()["sharer_token"]
    token_b = client.get(f"/api/shares/{second}").json()["sharer_token"]

    assert token_a == token_b
    assert token_a != "anon-abc123"


def test_a_different_sharer_gets_a_different_token(client, shares_collection, share_payload):
    first = client.post("/api/shares", json=share_payload).json()["share_id"]

    share_payload["sharer_id"] = "anon-someone-else"
    second = client.post("/api/shares", json=share_payload).json()["share_id"]

    token_a = client.get(f"/api/shares/{first}").json()["sharer_token"]
    token_b = client.get(f"/api/shares/{second}").json()["sharer_token"]

    assert token_a != token_b


def test_an_authenticated_sharer_is_taken_from_the_token_not_the_body(
    client, shares_collection, share_payload
):
    """A client-supplied sharer_id is self-asserted; a verified uid wins."""
    from src.main import app
    from src.api.auth import get_user_id

    app.dependency_overrides[get_user_id] = lambda: "real-uid-999"
    try:
        signed_in = client.post("/api/shares", json=share_payload).json()["share_id"]
    finally:
        app.dependency_overrides.pop(get_user_id, None)

    anonymous = client.post("/api/shares", json=share_payload).json()["share_id"]

    token_signed_in = client.get(f"/api/shares/{signed_in}").json()["sharer_token"]
    token_anonymous = client.get(f"/api/shares/{anonymous}").json()["sharer_token"]

    # The body said "anon-abc123" both times; the signed-in share must not
    # be attributed to it.
    assert token_signed_in != token_anonymous
