"""Tests for the notifications API (cron-secret guard).

Uses the `client` fixture from conftest.py (mocks Firebase). The send-weekly
service is replaced with a fake so no real Firestore/Expo calls happen.
"""

from unittest.mock import patch, MagicMock, AsyncMock


def test_send_weekly_rejects_missing_secret(client):
    resp = client.post("/api/notifications/send-weekly")
    assert resp.status_code == 403


def test_send_weekly_rejects_wrong_secret(client):
    resp = client.post("/api/notifications/send-weekly", headers={"X-Cron-Secret": "nope"})
    assert resp.status_code == 403


def test_send_weekly_accepts_correct_secret(client):
    fake = MagicMock()
    fake.run_weekly_send = AsyncMock(return_value={"digest_sent": 0, "reengagement_sent": 0})
    with patch("src.core.config.settings.cron_secret", "s3cret"), \
         patch("src.api.routes_notifications.get_notification_service", return_value=fake):
        resp = client.post("/api/notifications/send-weekly", headers={"X-Cron-Secret": "s3cret"})
    assert resp.status_code == 200
    assert resp.json() == {"digest_sent": 0, "reengagement_sent": 0}
