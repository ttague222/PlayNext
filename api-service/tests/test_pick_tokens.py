"""Tests for signed pick tokens.

A pick token is the engine's signed record of one recommendation: game id,
the "why this fits" line it wrote, the match percentage, and the scenario
(time + mood) it was written for. `create_share` verifies the signature and
reads `why` from the token instead of the request body, so a caller can never
put chosen text on a playnxt.io share page.

The HMAC key is SHARE_TOKEN_SALT, domain-separated from the sharer-token use
by a message prefix, so one production secret lights up both attribution and
pick signing.
"""

from unittest.mock import patch

import pytest

from src.services.pick_token import issue_pick_token, verify_pick_token


def _issue(**overrides):
    kwargs = {
        "game_id": "game-001",
        "why": "Saves anytime, so you can stop when your 30 minutes are up.",
        "match_percentage": 92,
        "time_available": 30,
        "energy_mood": "wind_down",
    }
    kwargs.update(overrides)
    return issue_pick_token(**kwargs)


def test_a_token_round_trips_to_the_payload_it_was_issued_for():
    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        token = _issue()
        payload = verify_pick_token(token)

    assert payload is not None
    assert payload.game_id == "game-001"
    assert payload.why == "Saves anytime, so you can stop when your 30 minutes are up."
    assert payload.match_percentage == 92
    assert payload.time_available == 30
    assert payload.energy_mood == "wind_down"


def test_a_tampered_payload_is_rejected():
    import base64
    import json

    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        token = _issue()
        payload_b64, sig = token.rsplit(".", 1)
        decoded = json.loads(base64.urlsafe_b64decode(payload_b64 + "=="))
        decoded["w"] = "Visit evil.example for free keys"
        forged = (
            base64.urlsafe_b64encode(json.dumps(decoded).encode()).rstrip(b"=").decode()
            + "."
            + sig
        )

        with pytest.raises(ValueError):
            verify_pick_token(forged)


def test_a_token_signed_with_a_different_key_is_rejected():
    with patch("src.core.config.settings.share_token_salt", "key-one"):
        token = _issue()
    with patch("src.core.config.settings.share_token_salt", "key-two"):
        with pytest.raises(ValueError):
            verify_pick_token(token)


def test_garbage_is_rejected_not_crashed_on():
    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        for garbage in ("", "no-dot", "a.b", "!!!.???", "aGVsbG8."):
            with pytest.raises(ValueError):
                verify_pick_token(garbage)


def test_no_token_is_issued_without_a_key():
    with patch("src.core.config.settings.share_token_salt", ""):
        assert _issue() is None


def test_verification_is_unavailable_without_a_key():
    """No key means we cannot tell engine text from forged text, so the
    verifier reports "cannot verify" (None) rather than vouching for it."""
    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        token = _issue()
    with patch("src.core.config.settings.share_token_salt", ""):
        assert verify_pick_token(token) is None


def test_the_why_line_is_capped_at_the_share_limit():
    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        token = _issue(why="x" * 400)
        payload = verify_pick_token(token)
    assert len(payload.why) == 300


def test_a_sharer_token_can_never_verify_as_a_pick_token():
    """Domain separation: the two HMAC uses share a key but not a message
    space, so a value from one can't be replayed into the other."""
    from src.services.share_service import sharer_token

    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        stray = sharer_token("uid:someone")
        with pytest.raises(ValueError):
            verify_pick_token(f"{stray}.{stray}")


# --- The engine issues tokens with its recommendations ---


@pytest.fixture
def recommend_request():
    return {"time_available": 30, "energy_mood": "wind_down"}


def test_recommendations_carry_a_verifiable_pick_token(client, recommend_request):
    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        resp = client.post("/api/recommend", json=recommend_request)
        assert resp.status_code == 200
        recs = resp.json()["recommendations"]
        assert recs, "fixture catalog should produce recommendations"

        for rec in recs:
            payload = verify_pick_token(rec["pick_token"])
            assert payload.game_id == rec["game_id"]
            assert payload.time_available == 30
            assert payload.energy_mood == "wind_down"
            assert payload.match_percentage == round(rec["match_score"] * 100)


def test_the_signed_why_is_a_line_the_sharer_actually_sees(client, recommend_request):
    """The token's why must be one of the explanation lines the clients
    render: the highest-priority fit line, or the summary's first sentence."""
    with patch("src.core.config.settings.share_token_salt", "a-real-key"):
        resp = client.post("/api/recommend", json=recommend_request)
        for rec in resp.json()["recommendations"]:
            payload = verify_pick_token(rec["pick_token"])
            explanation = rec["explanation"]
            fit_lines = [
                explanation.get(f)
                for f in ("style_fit", "stop_fit", "mood_fit", "session_fit", "time_fit")
                if explanation.get(f)
            ]
            summary_first = (explanation.get("summary") or "").split(". ")[0]
            allowed = set(fit_lines) | {summary_first, summary_first + "."}
            assert payload.why in allowed


def test_no_pick_token_rides_along_when_no_key_is_configured(client, recommend_request):
    with patch("src.core.config.settings.share_token_salt", ""):
        resp = client.post("/api/recommend", json=recommend_request)
        for rec in resp.json()["recommendations"]:
            assert rec["pick_token"] is None
