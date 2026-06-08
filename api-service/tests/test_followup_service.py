from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
import pytest
from src.services.followup_service import (
    is_due_for_followup,
    FOLLOWUP_DELAY_HOURS,
    FollowUpService,
)


def test_is_due_for_followup_not_yet():
    now = datetime(2026, 6, 8, 12, 0, tzinfo=timezone.utc)
    accepted_at = now - timedelta(hours=FOLLOWUP_DELAY_HOURS - 1)
    assert is_due_for_followup(accepted_at, now) is False


def test_is_due_for_followup_exactly_at_threshold():
    now = datetime(2026, 6, 8, 12, 0, tzinfo=timezone.utc)
    accepted_at = now - timedelta(hours=FOLLOWUP_DELAY_HOURS)
    assert is_due_for_followup(accepted_at, now) is True


def test_is_due_for_followup_past_threshold():
    now = datetime(2026, 6, 8, 12, 0, tzinfo=timezone.utc)
    accepted_at = now - timedelta(hours=FOLLOWUP_DELAY_HOURS + 5)
    assert is_due_for_followup(accepted_at, now) is True


def _make_followup_collection(docs):
    """Return a mock Firestore collection that streams the given doc dicts."""
    mock_docs = []
    for d in docs:
        doc = MagicMock()
        doc.to_dict.return_value = d
        mock_docs.append(doc)

    query = MagicMock()
    query.stream.return_value = mock_docs
    query.where.return_value = query

    collection = MagicMock()
    collection.where.return_value = query
    return collection


def test_get_due_followups_returns_only_due():
    now = datetime(2026, 6, 8, 12, 0, tzinfo=timezone.utc)
    pending_due = {
        "signal_id": "s1", "user_id": "u1", "game_title": "Hades",
        "status": "pending",
        "accepted_at": now - timedelta(hours=FOLLOWUP_DELAY_HOURS + 1),
    }
    pending_not_due = {
        "signal_id": "s2", "user_id": "u1", "game_title": "Celeste",
        "status": "pending",
        "accepted_at": now - timedelta(hours=1),
    }
    collection = _make_followup_collection([pending_due, pending_not_due])
    service = FollowUpService.__new__(FollowUpService)
    service.collection = collection
    due = service.get_due_followups(now)
    assert len(due) == 1
    assert due[0]["signal_id"] == "s1"


def test_enqueue_writes_pending_doc():
    collection = MagicMock()
    doc_ref = MagicMock()
    collection.document.return_value = doc_ref

    service = FollowUpService.__new__(FollowUpService)
    service.collection = collection

    service.enqueue("sig-123", "user-456", "game-789", "Hades")

    collection.document.assert_called_once_with("sig-123")
    call_args = doc_ref.set.call_args[0][0]
    assert call_args["signal_id"] == "sig-123"
    assert call_args["user_id"] == "user-456"
    assert call_args["game_title"] == "Hades"
    assert call_args["status"] == "pending"


def test_mark_sent_updates_status():
    collection = MagicMock()
    doc_ref = MagicMock()
    collection.document.return_value = doc_ref

    service = FollowUpService.__new__(FollowUpService)
    service.collection = collection

    now = datetime(2026, 6, 8, 12, 0, tzinfo=timezone.utc)
    service.mark_sent("sig-123", now)

    doc_ref.update.assert_called_once()
    update_args = doc_ref.update.call_args[0][0]
    assert update_args["status"] == "sent"
    assert update_args["sent_at"] == now


def test_mark_no_device_updates_status():
    collection = MagicMock()
    doc_ref = MagicMock()
    collection.document.return_value = doc_ref

    service = FollowUpService.__new__(FollowUpService)
    service.collection = collection

    service.mark_no_device("sig-456")

    doc_ref.update.assert_called_once_with({"status": "no_device"})
