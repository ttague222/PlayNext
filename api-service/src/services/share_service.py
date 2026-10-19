"""
PlayNxt Share Service

Creates and reads the share records behind /s/<share-id> landing pages.

The share page is first-party content, so this service -- not the caller --
decides what appears on it: every pick is resolved against the game catalog,
and a pick whose game isn't in the catalog is rejected rather than shown.
"""

import hashlib
import hmac
import logging
import secrets
import string
from datetime import datetime, timezone
from typing import Optional

from ..core.config import settings
from ..db.firebase import get_collection, SHARES_COLLECTION
from ..models import Share, ShareCreate, SharePick, SharePublic
from .game_service import get_game_service

logger = logging.getLogger("playnext-api.services.share")

# Short enough to paste into a chat, random enough that shares aren't
# enumerable: 62^10 keyspace, generated with secrets rather than random.
SHARE_ID_ALPHABET = string.ascii_letters + string.digits
SHARE_ID_LENGTH = 10

# Enough digest to keep sharers distinct in analytics without being a handle
# anyone could work back to an id.
SHARER_TOKEN_LENGTH = 16


def generate_share_id() -> str:
    """Generate a URL-safe, non-sequential share id."""
    return "".join(secrets.choice(SHARE_ID_ALPHABET) for _ in range(SHARE_ID_LENGTH))


def namespaced_sharer_id(sharer_id: str, user_id: Optional[str]) -> str:
    """Tag an identity with how it was established.

    Without this, an anonymous caller could put a known Firebase uid in the
    body and produce a record -- and a token -- indistinguishable from that
    user's own shares, which is attribution forgery. A verified uid also wins
    outright over whatever the body claimed.
    """
    if user_id:
        return f"uid:{user_id}"
    return f"anon:{sharer_id}"


def sharer_token(sharer_id: str) -> Optional[str]:
    """Opaque, stable token for a sharer, or None when no key is configured.

    Share links are public, so the raw id -- a Firebase uid for app shares --
    must never be served. This is an HMAC rather than a salted digest: with no
    key, a plain hash is a confirmation oracle, since anyone holding a
    candidate id could recompute the token and prove who shared. With no key
    configured we serve no token at all rather than a weak one, which costs
    attribution but never leaks identity.
    """
    key = getattr(settings, "share_token_salt", "") or ""
    if not key:
        logger.warning(
            "SHARE_TOKEN_SALT is unset; serving no sharer_token. "
            "Share attribution is disabled until it is configured."
        )
        return None
    digest = hmac.new(
        key.encode("utf-8"), sharer_id.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return digest[:SHARER_TOKEN_LENGTH]


class ShareService:
    """Share persistence. Firestore access only through get_collection."""

    def __init__(self):
        self.shares_collection = get_collection(SHARES_COLLECTION)

    async def _resolve_picks(self, payload: ShareCreate) -> list[SharePick]:
        """Rebuild the picks from the catalog, keeping only what the client owns.

        Titles come from the catalog, so a share page can never display text a
        caller chose. `match_percentage` and `why` describe the sharer's own
        recommendation run and exist nowhere else, so they are kept as sent --
        capped by the model, escaped by the page that renders them.
        """
        game_service = get_game_service()
        resolved: list[SharePick] = []

        for pick in payload.picks:
            game = await game_service.get_game(pick.game_id)
            if game is None:
                raise ValueError(f"Unknown game: {pick.game_id}")
            resolved.append(
                SharePick(
                    game_id=game.game_id,
                    title=game.title,
                    match_percentage=pick.match_percentage,
                    why=pick.why,
                )
            )

        return resolved

    async def create_share(
        self, payload: ShareCreate, user_id: Optional[str] = None
    ) -> Share:
        """Store a share and return it with its generated id.

        A verified `user_id` wins over the body's `sharer_id`, which is
        self-asserted and could otherwise attribute a share to anyone.
        """
        share = Share(
            share_id=generate_share_id(),
            created_at=datetime.now(timezone.utc),
            surface=payload.surface,
            sharer_id=namespaced_sharer_id(payload.sharer_id, user_id),
            time_available=payload.time_available,
            energy_mood=payload.energy_mood,
            picks=await self._resolve_picks(payload),
        )
        self.shares_collection.document(share.share_id).set(share.model_dump(mode="json"))
        logger.info(f"Created share {share.share_id} from {share.surface.value}")
        return share

    def get_share(self, share_id: str) -> Optional[SharePublic]:
        """Fetch a share by id as it is served publicly, or None if missing."""
        snapshot = self.shares_collection.document(share_id).get()
        if not snapshot.exists:
            return None

        share = Share(**snapshot.to_dict())
        return SharePublic(
            share_id=share.share_id,
            created_at=share.created_at,
            surface=share.surface,
            sharer_token=sharer_token(share.sharer_id),
            time_available=share.time_available,
            energy_mood=share.energy_mood,
            picks=share.picks,
        )


_share_service = None


def get_share_service() -> ShareService:
    """Singleton accessor, matching the other services."""
    global _share_service
    if _share_service is None:
        _share_service = ShareService()
    return _share_service
