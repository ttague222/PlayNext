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
        # No new games this week: only nudge devices we KNOW are inactive.
        # Devices with last_active_at=None (registered but never seen used) are
        # intentionally skipped — we don't have evidence they're inactive.
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


# --------------------------------------------------------------------------
# Service class — Firestore + HTTP I/O around the pure functions above.
# --------------------------------------------------------------------------

import httpx
from ..db.firebase import get_collection, DEVICES_COLLECTION

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
_BATCH_SIZE = 100


class NotificationService:
    """Device token storage and weekly push sending."""

    def __init__(self):
        self.collection = get_collection(DEVICES_COLLECTION)

    def register_device(self, expo_push_token: str, platform: str, user_id: Optional[str] = None) -> bool:
        if not is_valid_expo_token(expo_push_token):
            return False
        now = datetime.now(timezone.utc)
        ref = self.collection.document(expo_push_token)
        snap = ref.get()
        data = {
            "expo_push_token": expo_push_token,
            "platform": platform,
            "user_id": user_id,
            "notifications_enabled": True,
            "last_active_at": now,
            "updated_at": now,
        }
        if not snap.exists:
            data["created_at"] = now
            data["last_notified_at"] = None
        ref.set(data, merge=True)
        return True

    def unregister_device(self, expo_push_token: str) -> None:
        self.collection.document(expo_push_token).set(
            {"notifications_enabled": False, "updated_at": datetime.now(timezone.utc)},
            merge=True,
        )

    def list_enabled_devices(self) -> list[dict]:
        return [d.to_dict() for d in self.collection.where("notifications_enabled", "==", True).stream()]

    def mark_notified(self, tokens: list[str], now: datetime) -> None:
        for token in tokens:
            self.collection.document(token).set({"last_notified_at": now}, merge=True)

    def delete_devices(self, tokens: list[str]) -> None:
        for token in tokens:
            self.collection.document(token).delete()

    async def _send_messages(self, messages: list[dict]) -> list[dict]:
        """POST messages to the Expo Push API in batches; return tickets in order."""
        tickets: list[dict] = []
        async with httpx.AsyncClient(timeout=30) as client:
            for i in range(0, len(messages), _BATCH_SIZE):
                batch = messages[i:i + _BATCH_SIZE]
                try:
                    resp = await client.post(EXPO_PUSH_URL, json=batch)
                    tickets.extend(resp.json().get("data", []))
                except Exception as e:
                    logger.error(f"Expo push batch failed: {e}")
                    tickets.extend([{"status": "error", "details": {}} for _ in batch])
        return tickets

    async def _send_to(self, devices: list[dict], message: Optional[dict], deep_link: str) -> int:
        if not message or not devices:
            return 0
        messages = [{
            "to": d["expo_push_token"],
            "title": message["title"],
            "body": message["body"],
            "sound": "default",
            "data": {"deep_link": deep_link},
        } for d in devices]
        tickets = await self._send_messages(messages)
        now = datetime.now(timezone.utc)
        self.mark_notified([m["to"] for m in messages], now)
        prune = tokens_to_prune(messages, tickets)
        if prune:
            self.delete_devices(prune)
        return len(messages) - len(prune)

    async def run_weekly_send(self) -> dict:
        from . import get_game_service
        recent = await get_game_service().list_recent_games(days=7, limit=20)
        recent_dicts = [{"title": g.title} for g in recent]
        has_new = len(recent_dicts) > 0
        digest_msg = build_digest_message(recent_dicts)
        reengage_msg = {"title": "Your next game is waiting \U0001F3AE",
                        "body": "Got 20 minutes? Find something to play."}
        devices = self.list_enabled_devices()
        targets = select_recipients(devices, datetime.now(timezone.utc), has_new)
        digest_sent = await self._send_to(targets["digest"], digest_msg, "whats_new")
        reengage_sent = await self._send_to(targets["reengagement"], reengage_msg, "play")
        return {"digest_sent": digest_sent, "reengagement_sent": reengage_sent}


_notification_service: Optional["NotificationService"] = None


def get_notification_service() -> "NotificationService":
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
