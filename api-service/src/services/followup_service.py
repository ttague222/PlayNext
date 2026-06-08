"""
PlayNxt Follow-up Queue Service.

Pure functions at the top (unit-testable without Firestore).
FollowUpService class below handles Firestore I/O.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

FOLLOWUP_DELAY_HOURS = 22  # Send 22h after acceptance


def is_due_for_followup(accepted_at: datetime, now: datetime, delay_hours: int = FOLLOWUP_DELAY_HOURS) -> bool:
    """True when enough time has passed since acceptance to send the followup push."""
    return (now - accepted_at) >= timedelta(hours=delay_hours)


from ..db.firebase import get_collection, FOLLOWUP_QUEUE_COLLECTION


class FollowUpService:
    """Manages the followup_queue Firestore collection."""

    def __init__(self):
        self.collection = get_collection(FOLLOWUP_QUEUE_COLLECTION)

    def enqueue(self, signal_id: str, user_id: str, game_id: str, game_title: str) -> None:
        """Write a pending followup doc for an accepted recommendation."""
        now = datetime.now(timezone.utc)
        self.collection.document(signal_id).set({
            "signal_id": signal_id,
            "user_id": user_id,
            "game_id": game_id,
            "game_title": game_title,
            "accepted_at": now,
            "status": "pending",
            "sent_at": None,
        })

    def get_due_followups(self, now: datetime, delay_hours: int = FOLLOWUP_DELAY_HOURS) -> list[dict]:
        """Return all pending followup docs whose accepted_at is old enough."""
        cutoff = now - timedelta(hours=delay_hours)
        docs = self.collection.where("status", "==", "pending").stream()
        result = []
        for d in docs:
            doc_dict = d.to_dict()
            if doc_dict.get("accepted_at") and doc_dict["accepted_at"] <= cutoff:
                result.append(doc_dict)
        return result

    def mark_sent(self, signal_id: str, now: datetime) -> None:
        self.collection.document(signal_id).update({"status": "sent", "sent_at": now})

    def mark_no_device(self, signal_id: str) -> None:
        self.collection.document(signal_id).update({"status": "no_device"})


_followup_service: Optional["FollowUpService"] = None


def get_followup_service() -> "FollowUpService":
    global _followup_service
    if _followup_service is None:
        _followup_service = FollowUpService()
    return _followup_service
