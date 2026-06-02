"""
PlayNxt Notification Service.

Pure functions (token validation, digest copy, recipient selection, invalid-token
pruning) are unit-tested. Firestore/HTTP I/O is thin around them.
"""

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger("playnext-api.notifications")

_EXPO_TOKEN_RE = re.compile(r"^ExponentPushToken\[[^\]]+\]$")


def is_valid_expo_token(token: Optional[str]) -> bool:
    """True only for well-formed Expo push tokens."""
    return bool(token and _EXPO_TOKEN_RE.match(token))


def build_digest_message(recent_games: list[dict]) -> Optional[dict]:
    """Return {title, body} for the weekly 'what's new' digest, or None if empty."""
    n = len(recent_games)
    if n == 0:
        return None
    titles = [g.get("title", "") for g in recent_games[:3] if g.get("title")]
    sample = ", ".join(titles)
    body = f"Including {sample} and more." if n > len(titles) else f"Including {sample}."
    plural = "s" if n != 1 else ""
    return {"title": f"\U0001F3AE {n} new game{plural} this week", "body": body}


def select_recipients(
    devices: list[dict],
    now: datetime,
    has_new_games: bool,
    inactive_days: int = 7,
    cap_days: int = 7,
) -> dict:
    """Split enabled, not-recently-notified devices into digest vs re-engagement.

    - Skip disabled devices and any notified within `cap_days` (enforces <=1/week).
    - If there are new games, all eligible devices get the digest.
    - If not, only devices inactive >= `inactive_days` get a re-engagement nudge.
    A device is never in both lists.
    """
    cap_cutoff = now - timedelta(days=cap_days)
    inactive_cutoff = now - timedelta(days=inactive_days)
    digest, reengagement = [], []
    for d in devices:
        if not d.get("notifications_enabled"):
            continue
        last_notified = d.get("last_notified_at")
        if last_notified and last_notified > cap_cutoff:
            continue
        if has_new_games:
            digest.append(d)
            continue
        last_active = d.get("last_active_at")
        if last_active and last_active < inactive_cutoff:
            reengagement.append(d)
    return {"digest": digest, "reengagement": reengagement}


def tokens_to_prune(messages: list[dict], tickets: list[dict]) -> list[str]:
    """Tokens whose Expo ticket says DeviceNotRegistered (delete these)."""
    out = []
    for msg, ticket in zip(messages, tickets):
        if ticket.get("status") == "error" and (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
            token = msg.get("to")
            if token:
                out.append(token)
    return out
