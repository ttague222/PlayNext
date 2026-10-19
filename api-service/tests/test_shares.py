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
        "picks": [{"game_id": "game-001"}],
    }


WHY_LINE = "Saves anytime, so you can stop when your 30 minutes are up."


def _mint_pick_token(**overrides):
    """A token as the engine would issue it for the fixture's scenario.

    Caller is responsible for patching share_token_salt while minting."""
    from src.services.pick_token import issue_pick_token

    kwargs = {
        "game_id": "game-001",
        "why": WHY_LINE,
        "match_percentage": 92,
        "time_available": 30,
        "energy_mood": "wind_down",
    }
    kwargs.update(overrides)
    return issue_pick_token(**kwargs)


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
    from unittest.mock import patch

    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        share_payload["picks"][0]["pick_token"] = _mint_pick_token()
        share_id = client.post("/api/shares", json=share_payload).json()["share_id"]

        resp = client.get(f"/api/shares/{share_id}")

    assert resp.json()["picks"][0]["why"] == WHY_LINE


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

    from unittest.mock import patch

    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        token_a = client.get(f"/api/shares/{first}").json()["sharer_token"]
        token_b = client.get(f"/api/shares/{second}").json()["sharer_token"]

    assert token_a
    assert token_a == token_b
    assert token_a != "anon-abc123"


def test_a_different_sharer_gets_a_different_token(client, shares_collection, share_payload):
    first = client.post("/api/shares", json=share_payload).json()["share_id"]

    share_payload["sharer_id"] = "anon-someone-else"
    second = client.post("/api/shares", json=share_payload).json()["share_id"]

    from unittest.mock import patch

    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        token_a = client.get(f"/api/shares/{first}").json()["sharer_token"]
        token_b = client.get(f"/api/shares/{second}").json()["sharer_token"]

    assert token_a
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

    from unittest.mock import patch

    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        token_signed_in = client.get(f"/api/shares/{signed_in}").json()["sharer_token"]
        token_anonymous = client.get(f"/api/shares/{anonymous}").json()["sharer_token"]

    # The body said "anon-abc123" both times; the signed-in share must not
    # be attributed to it.
    assert token_signed_in != token_anonymous


# --- Security: identity namespaces, token strength, and `why` content ---


def test_an_anonymous_caller_cannot_forge_an_authenticated_sharers_token(
    client, shares_collection, share_payload
):
    """Hashing the bare id would let anyone who knows a uid mint its token."""
    from src.main import app
    from src.api.auth import get_user_id

    from unittest.mock import patch

    app.dependency_overrides[get_user_id] = lambda: "victim-uid"
    try:
        real = client.post("/api/shares", json=share_payload).json()["share_id"]
    finally:
        app.dependency_overrides.pop(get_user_id, None)

    share_payload["sharer_id"] = "victim-uid"  # anonymous caller claims the uid
    forged = client.post("/api/shares", json=share_payload).json()["share_id"]

    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        real_token = client.get(f"/api/shares/{real}").json()["sharer_token"]
        forged_token = client.get(f"/api/shares/{forged}").json()["sharer_token"]

    assert real_token
    assert real_token != forged_token


def test_no_sharer_token_is_served_when_no_key_is_configured(
    client, shares_collection, share_payload
):
    """A keyless digest is a confirmation oracle: anyone holding an id could
    recompute it and prove who shared. Better to serve nothing."""
    from unittest.mock import patch

    share_id = client.post("/api/shares", json=share_payload).json()["share_id"]

    with patch("src.core.config.settings.share_token_salt", ""):
        body = client.get(f"/api/shares/{share_id}").json()

    assert body["sharer_token"] is None


def test_a_sharer_token_is_served_when_a_key_is_configured(
    client, shares_collection, share_payload
):
    from unittest.mock import patch

    share_id = client.post("/api/shares", json=share_payload).json()["share_id"]

    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        body = client.get(f"/api/shares/{share_id}").json()

    assert body["sharer_token"]



# --- Security: `why` comes from a signed engine record, not the caller ---
#
# The engine issues a pick token (HMAC over game, why line, match and
# scenario) with every recommendation. `create_share` verifies it and reads
# `why` and `match_percentage` from the token, so the request body has no
# text field a caller controls -- the link filter this replaced is gone.


def test_a_verified_token_puts_the_engines_why_and_match_on_the_share(
    client, shares_collection, share_payload
):
    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        share_payload["picks"][0]["pick_token"] = _mint_pick_token()
        share_id = client.post("/api/shares", json=share_payload).json()["share_id"]

        pick = client.get(f"/api/shares/{share_id}").json()["picks"][0]

    assert pick["why"] == WHY_LINE
    assert pick["match_percentage"] == 92


def test_a_share_without_a_token_stores_no_why_or_match(
    client, shares_collection, share_payload
):
    """A tokenless share (older client, no signing key, a share made outside a
    fresh engine run) still works -- it just carries no engine text."""
    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        resp = client.post("/api/shares", json=share_payload)
        assert resp.status_code == 201

        pick = client.get(f"/api/shares/{resp.json()['share_id']}").json()["picks"][0]

    assert pick["why"] is None
    assert pick["match_percentage"] is None


def test_a_client_supplied_why_is_ignored(client, shares_collection, share_payload):
    """`why` is no longer an input surface: a body field by that name is not
    read at all, so there is nothing to filter."""
    share_payload["picks"][0]["why"] = "Claim your prize at https://evil.example"

    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        resp = client.post("/api/shares", json=share_payload)
        assert resp.status_code == 201

        body = client.get(f"/api/shares/{resp.json()['share_id']}").json()

    assert "evil.example" not in str(body)
    assert body["picks"][0]["why"] is None


def test_a_client_supplied_match_percentage_is_ignored(
    client, shares_collection, share_payload
):
    share_payload["picks"][0]["match_percentage"] = 100

    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        resp = client.post("/api/shares", json=share_payload)
        pick = client.get(f"/api/shares/{resp.json()['share_id']}").json()["picks"][0]

    assert pick["match_percentage"] is None


def test_a_tampered_token_is_rejected(client, shares_collection, share_payload):
    import base64
    import json as jsonlib

    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        token = _mint_pick_token()
        payload_b64, sig = token.rsplit(".", 1)
        decoded = jsonlib.loads(base64.urlsafe_b64decode(payload_b64 + "=="))
        decoded["w"] = "Visit evil.example for free keys"
        share_payload["picks"][0]["pick_token"] = (
            base64.urlsafe_b64encode(jsonlib.dumps(decoded).encode()).rstrip(b"=").decode()
            + "."
            + sig
        )

        resp = client.post("/api/shares", json=share_payload)

    assert resp.status_code == 400


def test_a_token_for_another_game_is_rejected(client, shares_collection, share_payload):
    """A token binds its why line to one game; it cannot be replayed onto a
    different pick to caption it with another game's text."""
    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        share_payload["picks"][0]["pick_token"] = _mint_pick_token(game_id="game-002")

        resp = client.post("/api/shares", json=share_payload)

    assert resp.status_code == 400


def test_a_token_for_another_scenario_is_rejected(client, shares_collection, share_payload):
    """The why line was written for a scenario; showing it under a different
    one would misrepresent what the engine said."""
    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        share_payload["picks"][0]["pick_token"] = _mint_pick_token(time_available=120)
        assert client.post("/api/shares", json=share_payload).status_code == 400

        share_payload["picks"][0]["pick_token"] = _mint_pick_token(energy_mood="intense")
        assert client.post("/api/shares", json=share_payload).status_code == 400


def test_picks_from_two_engine_responses_can_share_one_scenario(
    client, shares_collection, share_payload
):
    """A swap replaces one card, so the final set mixes two responses. Tokens
    are per pick, so a mixed set verifies as long as the scenario matches."""
    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        share_payload["picks"] = [
            {"game_id": "game-001", "pick_token": _mint_pick_token()},
            {
                "game_id": "game-002",
                "pick_token": _mint_pick_token(
                    game_id="game-002", why="A puzzle you can put down anytime.",
                    match_percentage=88,
                ),
            },
        ]

        resp = client.post("/api/shares", json=share_payload)
        assert resp.status_code == 201

        picks = client.get(f"/api/shares/{resp.json()['share_id']}").json()["picks"]

    assert [p["why"] for p in picks] == [
        WHY_LINE,
        "A puzzle you can put down anytime.",
    ]


def test_with_no_key_a_token_is_stored_as_unverified_not_rejected(
    client, shares_collection, share_payload
):
    """No key means the server cannot vouch for any token. Sharing must not
    break, so the share is created without the engine text."""
    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        token = _mint_pick_token()

    with patch("src.core.config.settings.share_token_salt", ""):
        share_payload["picks"][0]["pick_token"] = token
        resp = client.post("/api/shares", json=share_payload)
        assert resp.status_code == 201

        pick = client.get(f"/api/shares/{resp.json()['share_id']}").json()["picks"][0]

    assert pick["why"] is None
