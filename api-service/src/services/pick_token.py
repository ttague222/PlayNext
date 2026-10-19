"""
PlayNxt Pick Tokens

A pick token is the engine's signed record of one recommendation: the game,
the "why this fits" line it wrote, the match percentage, and the scenario
(time + mood) it was written for. It rides to the client inside the
recommendation response and comes back when the user shares, so `create_share`
can put engine-authored text on a share page without trusting the request
body. This replaced the `why` link filter -- with no client-owned text field,
there is nothing to filter.

Stateless on purpose: the HMAC makes the record verifiable without storing a
recommendation per request. Tokens are issued per pick, not per response,
because a card swap can leave the user's final set spanning two responses.

The key is SHARE_TOKEN_SALT -- the secret that already keys sharer tokens --
domain-separated by a message prefix so neither HMAC use can be replayed into
the other. With no key configured, no tokens are issued and none can be
verified; shares still work, they just carry no engine text.
"""

import base64
import binascii
import hashlib
import hmac
import json
import logging
from typing import Optional

from pydantic import BaseModel

from ..core.config import settings

logger = logging.getLogger("playnext-api.services.pick_token")

# Matches SharePick.why's cap, enforced at issue time so a verified token is
# always storable as-is.
WHY_MAX_LENGTH = 300

_TOKEN_VERSION = 1
_HMAC_PREFIX = b"pick-token-v1:"


class PickTokenPayload(BaseModel):
    """What a verified token vouches for."""
    game_id: str
    why: Optional[str] = None
    match_percentage: Optional[int] = None
    time_available: int
    energy_mood: str


def _signing_key() -> str:
    return getattr(settings, "share_token_salt", "") or ""


def _sign(payload_b64: bytes, key: str) -> str:
    return hmac.new(
        key.encode("utf-8"), _HMAC_PREFIX + payload_b64, hashlib.sha256
    ).hexdigest()


def issue_pick_token(
    game_id: str,
    why: Optional[str],
    match_percentage: Optional[int],
    time_available: int,
    energy_mood: str,
) -> Optional[str]:
    """Sign one pick, or return None when no key is configured."""
    key = _signing_key()
    if not key:
        return None

    payload = {
        "v": _TOKEN_VERSION,
        "g": game_id,
        "w": (why or "")[:WHY_MAX_LENGTH] or None,
        "p": match_percentage,
        "t": time_available,
        "m": energy_mood,
    }
    payload_b64 = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    ).rstrip(b"=")
    return f"{payload_b64.decode('ascii')}.{_sign(payload_b64, key)}"


def verify_pick_token(token: str) -> Optional[PickTokenPayload]:
    """The payload a token vouches for.

    Returns None when no key is configured -- nothing can be verified then,
    which callers treat as "no token" rather than an error, so a share never
    fails because a key is missing. Raises ValueError for a token that is
    malformed or fails verification: that is tamper evidence, not degradation.
    """
    key = _signing_key()
    if not key:
        logger.warning(
            "SHARE_TOKEN_SALT is unset; pick tokens cannot be verified. "
            "Shares will carry no engine text until it is configured."
        )
        return None

    try:
        payload_b64, sig = token.rsplit(".", 1)
        if not payload_b64 or not sig:
            raise ValueError
        # Verify before decoding: nothing unauthenticated gets parsed.
        if not hmac.compare_digest(sig, _sign(payload_b64.encode("ascii"), key)):
            raise ValueError
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded))
        if data.get("v") != _TOKEN_VERSION:
            raise ValueError
        return PickTokenPayload(
            game_id=data["g"],
            why=data.get("w"),
            match_percentage=data.get("p"),
            time_available=data["t"],
            energy_mood=data["m"],
        )
    except (ValueError, KeyError, TypeError, UnicodeError, binascii.Error):
        raise ValueError("invalid pick token") from None
