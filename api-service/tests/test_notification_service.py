"""Unit tests for notification pure logic.

Note: NotificationService.run_weekly_send() (the announced-only-window /
first-7-days-of-month gating for the "coming soon" digest) is untested
I/O -- it pulls from get_game_service() and the device store directly.
No test here exercises it; covered instead by the unit tests below for
its pure building blocks (build_digest_message, select_recipients).
"""

from datetime import datetime, timedelta, timezone

from src.services.notification_service import (
    is_valid_expo_token,
    build_digest_message,
    select_recipients,
    tokens_to_prune,
)


# ---------- is_valid_expo_token ----------

def test_valid_expo_token():
    assert is_valid_expo_token("ExponentPushToken[abc123XYZ]") is True


def test_invalid_expo_tokens():
    assert is_valid_expo_token("") is False
    assert is_valid_expo_token(None) is False
    assert is_valid_expo_token("not-a-token") is False
    assert is_valid_expo_token("ExponentPushToken[]") is False


# ---------- build_digest_message ----------

def test_digest_message_lists_titles():
    games = [{"title": "Grand Theft Auto V"}, {"title": "Hollow Knight: Silksong"},
             {"title": "Hades II"}, {"title": "Balatro"}]
    msg = build_digest_message(games)
    assert "4 new games this week" in msg["title"]
    assert "Grand Theft Auto V" in msg["body"]
    assert msg["body"].endswith("and more.")


def test_digest_message_singular_and_no_more():
    msg = build_digest_message([{"title": "Solo Game"}])
    assert "1 new game this week" in msg["title"]
    assert msg["body"] == "Including Solo Game."


def test_digest_message_empty_returns_none():
    assert build_digest_message([]) is None


# ---------- select_recipients ----------

NOW = datetime(2026, 5, 31, tzinfo=timezone.utc)


def _device(**kw):
    base = {"expo_push_token": "ExponentPushToken[x]", "notifications_enabled": True,
            "last_active_at": NOW, "last_notified_at": None}
    base.update(kw)
    return base


def test_disabled_devices_never_selected():
    devices = [_device(notifications_enabled=False)]
    r = select_recipients(devices, NOW, has_new_games=True)
    assert r["digest"] == [] and r["reengagement"] == []


def test_recently_notified_excluded_by_cap():
    devices = [_device(last_notified_at=NOW - timedelta(days=3))]
    r = select_recipients(devices, NOW, has_new_games=True)
    assert r["digest"] == []


def test_new_games_go_to_digest():
    devices = [_device(last_notified_at=NOW - timedelta(days=8))]
    r = select_recipients(devices, NOW, has_new_games=True)
    assert len(r["digest"]) == 1 and r["reengagement"] == []


def test_no_new_games_only_inactive_get_reengagement():
    active = _device(last_active_at=NOW - timedelta(days=1))
    inactive = _device(last_active_at=NOW - timedelta(days=10))
    r = select_recipients([active, inactive], NOW, has_new_games=False)
    assert r["digest"] == []
    assert r["reengagement"] == [inactive]


def test_device_never_in_both_lists():
    devices = [_device(last_active_at=NOW - timedelta(days=20))]
    r = select_recipients(devices, NOW, has_new_games=True)
    assert len(r["digest"]) == 1 and r["reengagement"] == []


# ---------- tokens_to_prune ----------

def test_prune_device_not_registered():
    messages = [{"to": "ExponentPushToken[a]"}, {"to": "ExponentPushToken[b]"}]
    tickets = [
        {"status": "ok", "id": "1"},
        {"status": "error", "details": {"error": "DeviceNotRegistered"}},
    ]
    assert tokens_to_prune(messages, tickets) == ["ExponentPushToken[b]"]


def test_prune_ignores_other_errors():
    messages = [{"to": "ExponentPushToken[a]"}]
    tickets = [{"status": "error", "details": {"error": "MessageTooBig"}}]
    assert tokens_to_prune(messages, tickets) == []


# ---------- build_digest_message: upcoming games ----------

class TestDigestUpcoming:
    def test_upcoming_appended_to_body(self):
        msg = build_digest_message(
            [{"title": "Game A"}, {"title": "Game B"}],
            upcoming_games=[{"title": "Future 1"}, {"title": "Future 2"}, {"title": "Future 3"}],
        )
        assert "3 more coming soon" in msg["body"]

    def test_no_upcoming_keeps_old_copy(self):
        msg = build_digest_message([{"title": "Game A"}], upcoming_games=[])
        assert "coming soon" not in msg["body"]

    def test_upcoming_alone_still_sends(self):
        # New-release week with nothing added but games announced: still a digest.
        msg = build_digest_message([], upcoming_games=[{"title": "Future 1"}])
        assert msg is not None
        assert "coming soon" in msg["body"].lower() or "coming soon" in msg["title"].lower()

    def test_nothing_at_all_returns_none(self):
        assert build_digest_message([], upcoming_games=[]) is None

    def test_backward_compatible_single_arg(self):
        # Existing callers/tests pass only recent_games.
        msg = build_digest_message([{"title": "Game A"}])
        assert msg is not None and "coming soon" not in msg["body"]
