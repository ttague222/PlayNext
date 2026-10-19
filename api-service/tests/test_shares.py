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


def test_create_share_rejects_a_why_line_containing_a_link(
    client, shares_collection, share_payload
):
    """`why` is the one field the client still owns, so it must not be able to
    carry a destination onto a playnxt.io page."""
    share_payload["picks"][0]["why"] = "Claim your prize at https://evil.example"

    resp = client.post("/api/shares", json=share_payload)

    assert resp.status_code in (400, 422)


def test_create_share_rejects_a_why_line_containing_a_bare_domain(
    client, shares_collection, share_payload
):
    share_payload["picks"][0]["why"] = "Go to evil.example now"

    resp = client.post("/api/shares", json=share_payload)

    assert resp.status_code in (400, 422)


def test_create_share_keeps_an_ordinary_why_line(client, shares_collection, share_payload):
    """The engine's real output must survive the filter unchanged."""
    real = "Saves anytime, so you can stop when your 30 minutes are up."
    share_payload["picks"][0]["why"] = real

    share_id = client.post("/api/shares", json=share_payload).json()["share_id"]

    body = client.get(f"/api/shares/{share_id}").json()
    assert body["picks"][0]["why"] == real


# --- Security: the link filter must not be bypassable with lookalike dots ---


@pytest.mark.parametrize(
    "dot,name",
    [
        ("．", "fullwidth full stop"),
        ("。", "ideographic full stop"),
        ("｡", "halfwidth ideographic full stop"),
    ],
)
def test_create_share_rejects_a_domain_built_from_a_lookalike_dot(
    client, shares_collection, share_payload, dot, name
):
    """A denylist with a trivial bypass is worse than none -- it invites
    false confidence. These render as a domain to a reader."""
    share_payload["picks"][0]["why"] = f"Go to evil{dot}example now"

    resp = client.post("/api/shares", json=share_payload)

    assert resp.status_code in (400, 422), f"{name} bypassed the filter"


def test_create_share_rejects_a_bare_ip_address(client, shares_collection, share_payload):
    share_payload["picks"][0]["why"] = "Visit 192.168.1.1 for your prize"

    resp = client.post("/api/shares", json=share_payload)

    assert resp.status_code in (400, 422)


def test_create_share_keeps_accented_prose(client, shares_collection, share_payload):
    """The filter must not reject real titles: Pokemon, Okami, cafe sims."""
    real = "A cozy café sim with Pokémon energy that's fun within minutes."
    share_payload["picks"][0]["why"] = real

    share_id = client.post("/api/shares", json=share_payload).json()["share_id"]

    body = client.get(f"/api/shares/{share_id}").json()
    assert body["picks"][0]["why"] == real


@pytest.mark.parametrize(
    "ch,name",
    [
        ("​", "zero width space"),
        ("‌", "zero width non-joiner"),
        ("‍", "zero width joiner"),
        ("­", "soft hyphen"),
        ("﻿", "byte order mark"),
    ],
)
def test_create_share_rejects_invisible_characters_in_why(
    client, shares_collection, share_payload, ch, name
):
    """An invisible char between label and dot hides a domain from the regex
    while a reader still sees one. No engine output contains a format
    character -- 2354 catalog strings carry none -- so rejecting the whole
    Cf category is safe and closes the class, not one instance."""
    share_payload["picks"][0]["why"] = f"Go to evil{ch}.example now"

    resp = client.post("/api/shares", json=share_payload)

    assert resp.status_code in (400, 422), f"{name} bypassed the filter"


@pytest.mark.parametrize("ch", ["·", "•", "・", "⋅"])
def test_create_share_rejects_dot_lookalike_separators(
    client, shares_collection, share_payload, ch
):
    share_payload["picks"][0]["why"] = f"Go to evil{ch}example now"

    resp = client.post("/api/shares", json=share_payload)

    assert resp.status_code in (400, 422)


def test_create_share_keeps_an_en_dash(client, shares_collection, share_payload):
    """The real catalog contains an en dash; the filter must not reject it."""
    real = "A short, cozy adventure – fun within minutes."
    share_payload["picks"][0]["why"] = real

    share_id = client.post("/api/shares", json=share_payload).json()["share_id"]

    assert client.get(f"/api/shares/{share_id}").json()["picks"][0]["why"] == real


@pytest.mark.parametrize(
    "ch,name",
    [
        ("⠀", "braille pattern blank"),
        ("᠎", "mongolian vowel separator"),
        ("͏", "combining grapheme joiner"),
        ("️", "variation selector-16"),
        ("\U000e0101", "variation selector-18"),
        ("·", "middle dot"),
        ("\U0001f600", "emoji"),
        ("⁡", "function application"),
    ],
)
def test_create_share_rejects_characters_outside_the_allowed_set(
    client, shares_collection, share_payload, ch, name
):
    """`why` is restricted to letters, digits, space and plain punctuation.
    An allowlist ends the lookalike arms race: no invisible, symbol or
    dot-alike character can reach the matcher to dodge it."""
    share_payload["picks"][0]["why"] = f"Go to evil{ch}example now"

    resp = client.post("/api/shares", json=share_payload)

    assert resp.status_code == 422, f"{name} was accepted"


@pytest.mark.parametrize("ch", ["ㅤ", "ᅟ", "ᅠ", "ﾠ"])
def test_blank_rendering_letters_still_cannot_hide_a_domain(
    client, shares_collection, share_payload, ch
):
    """Hangul fillers render blank but are Unicode letters, so an allowlist
    keyed on category lets them through. They must not break the matcher."""
    share_payload["picks"][0]["why"] = f"Go to evil{ch}.example now"

    resp = client.post("/api/shares", json=share_payload)

    assert resp.status_code in (400, 422)


@pytest.mark.parametrize(
    "text",
    [
        "A cozy café sim with Pokémon energy.",
        "A short, cozy adventure – fun within minutes.",
        "Meditative — like Abzu, but calmer.",
        "It's a builder; stop anytime (no timers).",
        "Roughly 80% exploration, 20% combat.",
        "Co-op/solo: both work for a 30 minute run.",
        "Saves anytime, so you can stop when your 30 minutes are up.",
        "Short runs; stop anytime. No. 1 for wind-down.",
        "Quietly brilliant… and it respects your time.",
        "A ‘small’ game with a “big” heart.",
    ],
)
def test_real_prose_survives_the_allowlist(client, shares_collection, share_payload, text):
    """The filter must never reject what the engine actually writes."""
    share_payload["picks"][0]["why"] = text

    share_id = client.post("/api/shares", json=share_payload).json()["share_id"]

    assert client.get(f"/api/shares/{share_id}").json()["picks"][0]["why"] == text


# --- The link check must not break real games with dotted titles ---


def test_a_dotted_game_title_is_not_mistaken_for_a_domain():
    """Chess.com, BeamNG.drive, Survivor.io and BIT.TRIP are real titles the
    engine writes into its explanations. Rejecting them would make those
    games unshareable."""
    from src.models.share import contains_link

    why = "Saves anytime, so you can put Chess.com down when your 30 minutes are up."

    assert contains_link(why, ("Chess.com",)) is False
    # Without the exemption it looks exactly like a domain -- which is why
    # the check has to know the share's real titles.
    assert contains_link(why, ()) is True


def test_a_real_domain_is_still_caught_alongside_a_dotted_title():
    from src.models.share import contains_link

    why = "Play Chess.com, then claim your prize at evil.example"

    assert contains_link(why, ("Chess.com",)) is True


# --- The title exemption must not become a hiding place ---


def test_a_domain_glued_to_a_title_is_not_exempted():
    """Removing a title as a bare substring lets a domain hide inside one:
    "evilChess.com" reads as a domain but vanished with the title."""
    from src.models.share import contains_link

    assert contains_link("Visit evilChess.com now", ("Chess.com",)) is True


def test_a_title_cannot_be_used_to_split_a_domain():
    from src.models.share import contains_link

    assert contains_link("goto evilDirt Rally 2.0.example", ("Dirt Rally 2.0",)) is True


def test_a_whole_token_title_is_still_exempt():
    """The real case this exemption exists for must keep working."""
    from src.models.share import contains_link

    why = "Saves anytime, so you can put Chess.com down when your 30 minutes are up."
    assert contains_link(why, ("Chess.com",)) is False


def test_a_title_at_the_end_of_a_sentence_is_still_exempt():
    from src.models.share import contains_link

    assert contains_link("A quick round of Chess.com.", ("Chess.com",)) is False


# --- What we validate must be what we store ---


def test_the_stored_why_is_the_text_the_allowlist_approved():
    """Validating the NFC form but storing the original means storing a
    combining mark the allowlist would have rejected on its own."""
    import unicodedata
    from src.models.share import SharePickCreate

    pick = SharePickCreate(game_id="g", why="café sim")

    assert pick.why == "café sim"
    assert not any(unicodedata.category(c) == "Mn" for c in pick.why)


@pytest.mark.parametrize("ch", ["ᅟ", "ᅠ", "ㅤ", "ﾠ"])
def test_blank_rendering_filler_letters_are_rejected(ch):
    """These are Unicode letters, so the category allowlist passes them, but
    they render as nothing -- stored text should match what a reader sees."""
    from src.models.share import SharePickCreate
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        SharePickCreate(game_id="g", why=f"Chess{ch} is fun")


def test_a_longer_domain_built_onto_a_title_is_not_exempt():
    """A sentence period after a title is fine; another label is not."""
    from src.models.share import contains_link

    assert contains_link("Play Chess.com.evil now", ("Chess.com",)) is True


# --- Letters that render as a bare dot ---


@pytest.mark.parametrize(
    "ch,name",
    [
        ("ᐧ", "canadian syllabics final middle dot"),
        ("ᣟ", "canadian syllabics final raised dot"),
        ("ꞏ", "latin letter sinological dot"),
        ("ࢇ", "arabic baseline round dot"),
        ("ॱ", "devanagari sign high spacing dot"),
        ("ꓸ", "lisu letter tone mya ti"),
        ("\U0001bc84", "duployan affix high dot"),
        ("\U0001bc94", "duployan affix low dot"),
    ],
)
def test_letters_that_render_as_a_bare_dot_are_treated_as_dots(ch, name):
    """These are Unicode letters, so the category allowlist admits them, but
    they draw a standalone dot -- "evil<x>com" reads as a domain. Folding
    them to '.' turns a bypass into a detection."""
    from src.models.share import contains_link

    assert contains_link(f"Claim at evil{ch}com now", ()) is True, name


@pytest.mark.parametrize(
    "text",
    [
        "A calm trip to Hạ Long.",          # a with dot below
        "İstanbul at dusk.",                 # I with dot above
        "A ṣand-swept ruin.",                # s with dot below
        "Explore Bailé Átha Cliath.",   # accented Irish
    ],
)
def test_letters_that_merely_carry_a_dot_are_not_treated_as_dots(text):
    """179 of the 187 letter-category characters whose Unicode name mentions
    DOT are ordinary accented letters. Folding those would break Vietnamese,
    Turkish and Irish titles, so the dot set is curated, not name-derived."""
    from src.models.share import contains_link, _reject_links

    _reject_links(text)                      # must not raise
    assert contains_link(text, ()) is False
