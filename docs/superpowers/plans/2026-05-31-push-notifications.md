# Push Notifications (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a low-frequency push channel — a weekly "new games this week" digest plus a re-engagement nudge for lapsed devices, capped at ≤1 push/device/7 days — to bring users back.

**Architecture:** Expo Push Notifications. Mobile registers an Expo push token stored in Firestore (`devices`). A weekly Google Cloud Scheduler job hits a secret-protected FastAPI endpoint that builds the digest, selects recipients (enforcing the 7-day cap), and sends via the Expo Push API. Backend logic is factored into **pure functions** (token validation, digest copy, recipient selection, invalid-token pruning) that are unit-tested in the codebase's existing style; Firestore/HTTP I/O is thin around them.

**Tech Stack:** Python 3.14 / FastAPI / firebase-admin / httpx / pytest (`asyncio_mode = auto`); React Native + Expo SDK 54 / expo-notifications / jest.

**Working dirs:** backend commands from `C:\Users\ttagu\Projects\PlayNxt\api-service`; mobile from `C:\Users\ttagu\Projects\PlayNxt\mobile-app`. All work on a feature branch; commit per task; do not push.

**Spec:** `docs/superpowers/specs/2026-05-31-push-notifications-design.md`

---

## Phase 1 — Backend

### Task 1: Config, collection constant, and Expo-token validation

**Files:**
- Modify: `src/db/firebase.py` (collection constants block, ~line 74-78)
- Modify: `src/core/config.py` (Settings class)
- Create: `src/services/notification_service.py`
- Create: `tests/test_notification_service.py`

- [ ] **Step 1: Add the devices collection constant**

In `src/db/firebase.py`, after `BUCKETS_COLLECTION = "user_buckets"` add:

```python
DEVICES_COLLECTION = "devices"
```

- [ ] **Step 2: Add the cron secret setting**

In `src/core/config.py`, inside `Settings`, after the `sentry_dsn` line add:

```python
    # Push notifications
    cron_secret: Optional[str] = None
```

- [ ] **Step 3: Write the failing test for token validation**

Create `tests/test_notification_service.py`:

```python
"""Unit tests for notification pure logic."""

from src.services.notification_service import is_valid_expo_token


def test_valid_expo_token():
    assert is_valid_expo_token("ExponentPushToken[abc123XYZ]") is True


def test_invalid_expo_tokens():
    assert is_valid_expo_token("") is False
    assert is_valid_expo_token(None) is False
    assert is_valid_expo_token("not-a-token") is False
    assert is_valid_expo_token("ExponentPushToken[]") is False
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `python -m pytest tests/test_notification_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'src.services.notification_service'`.

- [ ] **Step 5: Create the module with the pure helper**

Create `src/services/notification_service.py`:

```python
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
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `python -m pytest tests/test_notification_service.py -v`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/db/firebase.py src/core/config.py src/services/notification_service.py tests/test_notification_service.py
git commit -m "feat(notifications): add devices collection, cron secret, token validation"
```

---

### Task 2: Digest message builder (pure)

**Files:**
- Modify: `src/services/notification_service.py`
- Modify: `tests/test_notification_service.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_notification_service.py`:

```python
from src.services.notification_service import build_digest_message


def test_digest_message_lists_titles():
    games = [{"title": "Grand Theft Auto V"}, {"title": "Hollow Knight: Silksong"},
             {"title": "Hades II"}, {"title": "Balatro"}]
    msg = build_digest_message(games)
    assert msg["title"] == "🎮 4 new games this week"
    assert "Grand Theft Auto V" in msg["body"]
    assert msg["body"].endswith("and more.")


def test_digest_message_singular_and_no_more():
    msg = build_digest_message([{"title": "Solo Game"}])
    assert msg["title"] == "🎮 1 new game this week"
    assert msg["body"] == "Including Solo Game."


def test_digest_message_empty_returns_none():
    assert build_digest_message([]) is None
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_notification_service.py -v`
Expected: FAIL — `cannot import name 'build_digest_message'`.

- [ ] **Step 3: Implement `build_digest_message`**

Append to `src/services/notification_service.py`:

```python
def build_digest_message(recent_games: list[dict]) -> Optional[dict]:
    """Return {title, body} for the weekly 'what's new' digest, or None if empty."""
    n = len(recent_games)
    if n == 0:
        return None
    titles = [g.get("title", "") for g in recent_games[:3] if g.get("title")]
    sample = ", ".join(titles)
    body = f"Including {sample} and more." if n > len(titles) else f"Including {sample}."
    plural = "s" if n != 1 else ""
    return {"title": f"🎮 {n} new game{plural} this week", "body": body}
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_notification_service.py -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/notification_service.py tests/test_notification_service.py
git commit -m "feat(notifications): digest message builder"
```

---

### Task 3: Recipient selection with the 7-day cap (pure)

**Files:**
- Modify: `src/services/notification_service.py`
- Modify: `tests/test_notification_service.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_notification_service.py`:

```python
from datetime import datetime, timedelta, timezone
from src.services.notification_service import select_recipients

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
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_notification_service.py -v`
Expected: FAIL — `cannot import name 'select_recipients'`.

- [ ] **Step 3: Implement `select_recipients`**

Append to `src/services/notification_service.py`:

```python
def select_recipients(
    devices: list[dict],
    now: datetime,
    has_new_games: bool,
    inactive_days: int = 7,
    cap_days: int = 7,
) -> dict:
    """Split enabled, not-recently-notified devices into digest vs re-engagement.

    - Skip disabled devices and any notified within `cap_days` (enforces ≤1/week).
    - If there are new games, all eligible devices get the digest.
    - If not, only devices inactive ≥ `inactive_days` get a re-engagement nudge.
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
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_notification_service.py -v`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/notification_service.py tests/test_notification_service.py
git commit -m "feat(notifications): recipient selection with 7-day cap"
```

---

### Task 4: Invalid-token pruning from Expo tickets (pure)

**Files:**
- Modify: `src/services/notification_service.py`
- Modify: `tests/test_notification_service.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_notification_service.py`:

```python
from src.services.notification_service import tokens_to_prune


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
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_notification_service.py -v`
Expected: FAIL — `cannot import name 'tokens_to_prune'`.

- [ ] **Step 3: Implement `tokens_to_prune`**

Append to `src/services/notification_service.py`:

```python
def tokens_to_prune(messages: list[dict], tickets: list[dict]) -> list[str]:
    """Tokens whose Expo ticket says DeviceNotRegistered (delete these)."""
    out = []
    for msg, ticket in zip(messages, tickets):
        if ticket.get("status") == "error" and (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
            token = msg.get("to")
            if token:
                out.append(token)
    return out
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_notification_service.py -v`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/notification_service.py tests/test_notification_service.py
git commit -m "feat(notifications): prune DeviceNotRegistered tokens"
```

---

### Task 5: GameService.list_recent_games + GET /games/recent

**Files:**
- Modify: `src/services/game_service.py`
- Modify: `src/api/routes_games.py` (add `/recent` BEFORE the `/{game_id}` route)

- [ ] **Step 1: Add `list_recent_games` to GameService**

In `src/services/game_service.py`, update the imports at the top to include datetime + firestore:

```python
from datetime import datetime, timedelta, timezone
from firebase_admin import firestore
```

Then add this method to the `GameService` class (after `list_games`):

```python
    async def list_recent_games(self, days: int = 7, limit: int = 20) -> list[GameSummary]:
        """List games added within the last `days`, newest first."""
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            query = (
                self.collection
                .where("created_at", ">=", cutoff)
                .order_by("created_at", direction=firestore.Query.DESCENDING)
                .limit(limit)
            )
            games = []
            for doc in query.stream():
                data = doc.to_dict()
                games.append(GameSummary(
                    game_id=doc.id,
                    title=data.get("title", ""),
                    platforms=[Platform(p) for p in data.get("platforms", [])],
                    description_short=data.get("description_short", ""),
                    time_to_fun=data.get("time_to_fun", "medium"),
                    stop_friendliness=data.get("stop_friendliness", "checkpoints"),
                ))
            return games
        except Exception as e:
            logger.error(f"Error listing recent games: {e}")
            return []
```

- [ ] **Step 2: Add the `/recent` route BEFORE `/{game_id}`**

In `src/api/routes_games.py`, insert this **between** the `/stats` route (ends ~line 45) and the `/{game_id}` route (starts ~line 48). Placement matters: if `/recent` comes after `/{game_id}`, FastAPI matches `game_id="recent"`.

```python
@router.get("/recent", response_model=list[GameSummary])
async def list_recent_games(
    days: int = Query(default=7, ge=1, le=90),
    limit: int = Query(default=20, ge=1, le=50),
):
    """List recently-added games (for 'What's New' and the weekly digest)."""
    service = get_game_service()
    return await service.list_recent_games(days=days, limit=limit)
```

- [ ] **Step 3: Verify against the real catalog**

Recently-added games exist with `created_at` (the 2025/26 + classics batches). Verify the query works:

```bash
python -c "
import asyncio, sys
sys.path.insert(0, '.')
import firebase_admin
from firebase_admin import credentials
firebase_admin.initialize_app(credentials.Certificate('serviceAccountKey.json'), {'projectId':'playnxt-1a2c6'})
from src.services.game_service import get_game_service
games = asyncio.run(get_game_service().list_recent_games(days=30, limit=10))
print('recent (30d):', len(games))
for g in games[:5]: print(' -', g.title)
" 2>&1 | grep -vi "warn\|google.auth"
```
Expected: prints several recently-added games (e.g. the classics/2026 batches). If Firestore asks for an index, create the single-field index it links (where+order_by on `created_at` usually needs none, but follow the link if shown).

- [ ] **Step 4: Commit**

```bash
git add src/services/game_service.py src/api/routes_games.py
git commit -m "feat(games): add list_recent_games + GET /games/recent"
```

---

### Task 6: NotificationService I/O + weekly-send orchestration

**Files:**
- Modify: `src/services/notification_service.py`
- Modify: `src/services/__init__.py`

- [ ] **Step 1: Add the service class, singleton, and exports**

Append to `src/services/notification_service.py`:

```python
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
        reengage_msg = {"title": "Your next game is waiting 🎮",
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
```

In `src/services/__init__.py`, add the import and exports:

```python
from .notification_service import NotificationService, get_notification_service
```
and add `"NotificationService"` and `"get_notification_service"` to `__all__`.

- [ ] **Step 2: Verify the module imports cleanly and pure tests still pass**

Run: `python -m pytest tests/test_notification_service.py -v`
Expected: PASS (12 tests — the I/O additions don't break the pure tests; importing the module must not connect to Firestore because `NotificationService()` is only constructed lazily via the singleton).

- [ ] **Step 3: Commit**

```bash
git add src/services/notification_service.py src/services/__init__.py
git commit -m "feat(notifications): device storage + weekly-send orchestration"
```

---

### Task 7: Routes + app wiring + cron-secret guard

**Files:**
- Create: `src/api/routes_notifications.py`
- Modify: `src/api/__init__.py`
- Modify: `src/main.py`
- Modify: `tests/test_notifications_api.py` (new)

- [ ] **Step 1: Create the router**

Create `src/api/routes_notifications.py`:

```python
"""
PlayNxt Notification Routes — device registration + weekly send trigger.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from ..core.config import settings
from ..services import get_notification_service
from .auth import get_user_id

logger = logging.getLogger("playnext-api.routes.notifications")

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class RegisterRequest(BaseModel):
    expo_push_token: str
    platform: str


class UnregisterRequest(BaseModel):
    expo_push_token: str


@router.post("/register")
async def register(body: RegisterRequest, user_id: Optional[str] = Depends(get_user_id)):
    """Register or refresh a device's push token (anonymous devices allowed)."""
    service = get_notification_service()
    if not service.register_device(body.expo_push_token, body.platform, user_id):
        raise HTTPException(status_code=400, detail="Invalid push token")
    return {"message": "registered"}


@router.post("/unregister")
async def unregister(body: UnregisterRequest):
    """Disable notifications for a device."""
    get_notification_service().unregister_device(body.expo_push_token)
    return {"message": "unregistered"}


@router.post("/send-weekly")
async def send_weekly(x_cron_secret: Optional[str] = Header(default=None)):
    """Trigger the weekly send. Protected by a shared secret (Cloud Scheduler)."""
    if not settings.cron_secret or x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=403, detail="Forbidden")
    result = await get_notification_service().run_weekly_send()
    return result
```

- [ ] **Step 2: Wire into the API package and app**

In `src/api/__init__.py` add:
```python
from .routes_notifications import router as notifications_router
```
and add `"notifications_router"` to `__all__`.

In `src/main.py`, update the import on line 21 to include `notifications_router`, and after the other `include_router` calls add:
```python
app.include_router(notifications_router, prefix="/api")
```

- [ ] **Step 3: Write the failing test for the cron guard**

Create `tests/test_notifications_api.py`:

```python
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
```

- [ ] **Step 4: Run to verify it fails**

Run: `python -m pytest tests/test_notifications_api.py -v`
Expected: FAIL — route not registered yet / 404, then once wired the guard tests drive correctness.

- [ ] **Step 5: Make tests pass**

The router and wiring from Steps 1-2 implement this. Re-run:

Run: `python -m pytest tests/test_notifications_api.py -v`
Expected: PASS (3 tests). If `test_send_weekly_accepts_correct_secret` 500s, ensure `run_weekly_send` is patched at the class path shown.

- [ ] **Step 6: Run the full backend suite for regressions**

Run: `python -m pytest tests/test_notification_service.py tests/test_notifications_api.py -v`
Expected: all PASS (15 tests). (The pre-existing `test_signal_service` / endpoint failures are unrelated and out of scope.)

- [ ] **Step 7: Add `cron_secret` to env example and commit**

If `.env.example` exists, add `CRON_SECRET=` to it. Then:

```bash
git add src/api/routes_notifications.py src/api/__init__.py src/main.py tests/test_notifications_api.py
git commit -m "feat(notifications): register/unregister/send-weekly routes + cron guard"
```

---

## Phase 2 — Mobile

### Task 8: Install deps + API client methods

**Files:**
- Modify: `mobile-app/package.json` (via `npx expo install`)
- Modify: `mobile-app/src/services/api.js`

- [ ] **Step 1: Install Expo notification deps**

Run (from `mobile-app`): `npx expo install expo-notifications expo-device`
Expected: both added to `package.json` dependencies.

- [ ] **Step 2: Add API client methods**

In `mobile-app/src/services/api.js`, inside the `api` object (e.g. after the Games section), add:

```js
  /**
   * Register this device's Expo push token
   */
  registerPushToken: async (expoPushToken, platform) => {
    const response = await apiClient.post('/notifications/register', {
      expo_push_token: expoPushToken,
      platform,
    });
    return response.data;
  },

  /**
   * Disable notifications for this device
   */
  unregisterPushToken: async (expoPushToken) => {
    const response = await apiClient.post('/notifications/unregister', {
      expo_push_token: expoPushToken,
    });
    return response.data;
  },

  /**
   * Get recently-added games (for the What's New screen)
   */
  getRecentGames: async (days = 7, limit = 20) => {
    const response = await apiClient.get('/games/recent', { params: { days, limit } });
    return response.data;
  },
```

- [ ] **Step 3: Commit**

```bash
git add mobile-app/package.json mobile-app/package-lock.json mobile-app/src/services/api.js
git commit -m "feat(mobile): expo-notifications deps + push API client methods"
```

---

### Task 9: notificationService.js (registration + tap handling)

**Files:**
- Create: `mobile-app/src/services/notificationService.js`

- [ ] **Step 1: Implement the service**

Create `mobile-app/src/services/notificationService.js`:

```js
/**
 * PlayNxt push-notification registration and handling (Expo).
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import api from './api';

const EAS_PROJECT_ID = '268e6152-b422-47f9-b6c3-2b6811100ba6';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Request OS permission, get the Expo token, and register it with the API.
 * Returns the token on success, or null.
 */
export async function registerForPushNotifications() {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
  const token = tokenResponse.data;
  try {
    await api.registerPushToken(token, Platform.OS);
  } catch (e) {
    // Registration failed — token still valid locally; will retry on next foreground
  }
  return token;
}

/**
 * Wire a tap handler. `navigate(deepLink)` receives 'whats_new' | 'play'.
 */
export function addNotificationResponseListener(navigate) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const deepLink = response?.notification?.request?.content?.data?.deep_link;
    if (deepLink) navigate(deepLink);
  });
}
```

- [ ] **Step 2: Manual verification note**

Expo push registration requires a physical device and an EAS dev/preview build (it does not work in Expo Go for SDK 53+ remote push). Verification happens at build time in Task 12; no unit test here.

- [ ] **Step 3: Commit**

```bash
git add mobile-app/src/services/notificationService.js
git commit -m "feat(mobile): notificationService for Expo push registration + tap handling"
```

---

### Task 10: Soft pre-prompt gating (TDD pure helper) + modal

**Files:**
- Create: `mobile-app/src/utils/pushPrompt.js`
- Create: `mobile-app/src/utils/__tests__/pushPrompt.test.js`
- Modify: the accept handler (search for where `acceptRecommendation` is called — `src/screens/ResultsScreen.js` or `src/context/RecommendationContext.js`)

- [ ] **Step 1: Write the failing test for the gating rule**

Create `mobile-app/src/utils/__tests__/pushPrompt.test.js`:

```js
import { shouldShowPushPrompt } from '../pushPrompt';

describe('shouldShowPushPrompt', () => {
  it('shows on first accept when not seen and not premium-disabled', () => {
    expect(shouldShowPushPrompt({ promptSeen: false, hasAccepted: true })).toBe(true);
  });
  it('does not show before the first accept', () => {
    expect(shouldShowPushPrompt({ promptSeen: false, hasAccepted: false })).toBe(false);
  });
  it('does not show again once seen', () => {
    expect(shouldShowPushPrompt({ promptSeen: true, hasAccepted: true })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (from `mobile-app`): `npx jest src/utils/__tests__/pushPrompt.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pure helper**

Create `mobile-app/src/utils/pushPrompt.js`:

```js
export const PUSH_PROMPT_SEEN_KEY = '@playnxt_push_prompt_seen';

/**
 * Whether to show the soft pre-prompt: only once, only after the first accept.
 */
export function shouldShowPushPrompt({ promptSeen, hasAccepted }) {
  return !promptSeen && !!hasAccepted;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/utils/__tests__/pushPrompt.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire the prompt into the accept flow**

Find where acceptance is recorded (grep `acceptRecommendation` in `src/`). After a successful accept, read the AsyncStorage flag and, if `shouldShowPushPrompt(...)` is true, present a confirmation that on "Enable" calls `registerForPushNotifications()` and on either choice writes `PUSH_PROMPT_SEEN_KEY='true'`:

```js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { shouldShowPushPrompt, PUSH_PROMPT_SEEN_KEY } from '../utils/pushPrompt';
import { registerForPushNotifications } from '../services/notificationService';

async function maybePromptForPush() {
  const promptSeen = (await AsyncStorage.getItem(PUSH_PROMPT_SEEN_KEY)) === 'true';
  if (!shouldShowPushPrompt({ promptSeen, hasAccepted: true })) return;
  await AsyncStorage.setItem(PUSH_PROMPT_SEEN_KEY, 'true');
  Alert.alert(
    'Stay in the loop?',
    "Want a heads-up when we add games you'd like? About once a week, never spammy.",
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Enable', onPress: () => registerForPushNotifications() },
    ],
  );
}
```
Call `maybePromptForPush()` right after the existing accept success (e.g. in the "I'll play this" handler, after `api.acceptRecommendation(...)` resolves).

- [ ] **Step 6: Run the jest test again + commit**

Run: `npx jest src/utils/__tests__/pushPrompt.test.js`
Expected: PASS.

```bash
git add mobile-app/src/utils/pushPrompt.js mobile-app/src/utils/__tests__/pushPrompt.test.js src/screens/ResultsScreen.js
git commit -m "feat(mobile): soft push pre-prompt after first accepted recommendation"
```
(Adjust the staged screen/context path to whichever file you wired.)

---

### Task 11: Profile toggle + What's New screen + tap routing

**Files:**
- Modify: `mobile-app/src/screens/ProfileScreen.js`
- Create: `mobile-app/src/screens/WhatsNewScreen.js`
- Modify: `mobile-app/src/navigation/AppNavigator.js`
- Modify: `mobile-app/App.js` (register the response listener)

- [ ] **Step 1: Profile notifications toggle**

In `ProfileScreen.js`, add a "Notifications" `Switch`. ON → `registerForPushNotifications()`. OFF → read the stored token (`Notifications.getExpoPushTokenAsync`) and call `api.unregisterPushToken(token)`. Persist the on/off intent in AsyncStorage key `@playnxt_notifications_enabled` and initialize the switch from it.

- [ ] **Step 2: What's New screen**

Create `mobile-app/src/screens/WhatsNewScreen.js` that calls `api.getRecentGames(7, 20)` on mount and renders the results with the existing `GameCard` component (mirror how `ResultsScreen`/`HistoryScreen` render cards). Empty state: "No new games this week — check back soon."

- [ ] **Step 3: Register the screen + tap routing**

Add `WhatsNewScreen` to `AppNavigator.js`. In `App.js`, after navigation is ready, call `addNotificationResponseListener((deepLink) => { if (deepLink === 'whats_new') navigation.navigate('WhatsNew'); else navigation.navigate('Play'); })` and remove the subscription on unmount.

- [ ] **Step 4: Manual verification**

`npx expo start`, open the app, confirm: the Profile toggle flips and calls register/unregister (watch the API logs), and the What's New screen loads recent games. Push delivery + tap routing are verified on a device build in Task 12.

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/screens/ProfileScreen.js mobile-app/src/screens/WhatsNewScreen.js mobile-app/src/navigation/AppNavigator.js mobile-app/App.js
git commit -m "feat(mobile): notifications toggle, What's New screen, tap routing"
```

---

## Phase 3 — Infra & end-to-end

### Task 12: Scheduler runbook + end-to-end verification

**Files:**
- Create: `docs/runbooks/push-notifications.md`

- [ ] **Step 1: Write the runbook**

Create `docs/runbooks/push-notifications.md` documenting:
- Set `CRON_SECRET` as a Cloud Run env var (and in `.env` for local).
- Create a **Google Cloud Scheduler** job: weekly cron (e.g. `0 17 * * 6` = Sat 17:00 UTC), HTTP POST to `https://<cloud-run-url>/api/notifications/send-weekly`, header `X-Cron-Secret: <CRON_SECRET>`.
- Fallback: a GitHub Actions scheduled workflow doing the same POST with the secret from repo secrets.
- How to test manually: `curl -X POST .../api/notifications/send-weekly -H "X-Cron-Secret: <secret>"` → expect `{digest_sent, reengagement_sent}`.

- [ ] **Step 2: End-to-end smoke test**

On an EAS dev/preview build on a physical device: accept a recommendation → soft prompt appears → Enable → confirm a `devices` doc is created in Firestore. Then trigger `send-weekly` with the secret and confirm the device receives the notification and tapping it opens the What's New screen.

- [ ] **Step 3: Commit**

```bash
git add docs/runbooks/push-notifications.md
git commit -m "docs(notifications): Cloud Scheduler runbook + e2e steps"
```

---

## Notes on commits & deployment
- Commit steps assume the user has approved committing on a feature branch (no push).
- The weekly send writes to production Firestore (`devices`) and sends real pushes — keep it gated behind the unguessable `CRON_SECRET` and verify with a single test device before enabling the scheduler.
