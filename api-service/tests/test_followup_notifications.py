"""Tests for follow-up push notification logic."""

from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

import pytest

from src.services.notification_service import build_followup_message


# --- Pure function tests ---

def test_build_followup_message_includes_title():
    msg = build_followup_message("Hades II")
    assert "Hades II" in msg["title"]
    assert "body" in msg


def test_build_followup_message_fallback_for_empty_title():
    msg = build_followup_message("")
    assert isinstance(msg["title"], str)
    assert len(msg["title"]) > 0


# --- Integration tests (mocked) ---

def _make_svc_with_mocks(due_items, user_token):
    """Return (svc, mock_followup_svc) with all Firestore/HTTP mocked."""
    from src.services.notification_service import NotificationService
    svc = NotificationService.__new__(NotificationService)
    svc.collection = MagicMock()
    svc._get_user_token = MagicMock(return_value=user_token)
    svc.delete_devices = MagicMock()

    async def fake_send(messages):
        return [{"status": "ok"} for _ in messages]
    svc._send_messages = fake_send

    mock_followup = MagicMock()
    mock_followup.get_due_followups.return_value = due_items
    mock_followup.mark_sent = MagicMock()
    mock_followup.mark_no_device = MagicMock()

    return svc, mock_followup


@pytest.mark.asyncio
async def test_send_followup_no_due_items():
    svc, mock_fup = _make_svc_with_mocks([], None)
    with patch("src.services.get_followup_service", return_value=mock_fup):
        result = await svc.send_followup_notifications()
    assert result == {"sent": 0, "no_device": 0, "total": 0}


@pytest.mark.asyncio
async def test_send_followup_no_device():
    due = [{"signal_id": "s1", "user_id": "u1", "game_id": "g1", "game_title": "Hades"}]
    svc, mock_fup = _make_svc_with_mocks(due, user_token=None)
    with patch("src.services.get_followup_service", return_value=mock_fup):
        result = await svc.send_followup_notifications()
    assert result["no_device"] == 1
    assert result["sent"] == 0
    mock_fup.mark_no_device.assert_called_once_with("s1")


@pytest.mark.asyncio
async def test_send_followup_sends_message():
    due = [{"signal_id": "s1", "user_id": "u1", "game_id": "g1", "game_title": "Hades"}]
    svc, mock_fup = _make_svc_with_mocks(due, user_token="ExponentPushToken[abc]")
    with patch("src.services.get_followup_service", return_value=mock_fup):
        result = await svc.send_followup_notifications()
    assert result["sent"] == 1
    assert result["no_device"] == 0
    mock_fup.mark_sent.assert_called_once()
    args = mock_fup.mark_sent.call_args[0]
    assert args[0] == "s1"
