# "How Was It?" Follow-up Push Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 22 hours after a user accepts a recommendation, send a push notification asking "How did {game} go?" with 👍/👎. The response is stored as a `worked` signal on the original acceptance signal, feeding future recommendation quality.

**Architecture:** Backend adds a `followup_queue` Firestore collection. When an authenticated user accepts a recommendation, a followup doc is written. A Cloud Scheduler job calls `POST /notifications/send-followups` every 2 hours; that endpoint finds due docs, sends Expo pushes, and marks them sent. On tap, the deep link carries `signal_id` + `game_title`. Mobile shows a `FollowUpModal`; the user's 👍/👎 calls the existing `PATCH /signals/history/{signal_id}/worked` endpoint.

**Scope:** Only authenticated users get followup pushes. Anonymous users have no auth token so they can't call the worked endpoint — we skip them at enqueue time.

**Tech Stack:** Python/FastAPI, Firestore, Expo Push API (already wired), React Native, AsyncStorage.

---

### Task 1: Add followup_queue collection name to firebase.py

**Files:**
- Modify: `api-service/src/db/firebase.py`

- [ ] **Step 1: Add the constant**

In `api-service/src/db/firebase.py`, after the `DEVICES_COLLECTION = "devices"` line, add:

```python
FOLLOWUP_QUEUE_COLLECTION = "followup_queue"
```

- [ ] **Step 2: Commit**

```bash
git add api-service/src/db/firebase.py
git commit -m "feat: add FOLLOWUP_QUEUE_COLLECTION constant"
```

---

### Task 2: FollowUpService — pure functions + service class

**Files:**
- Create: `api-service/src/services/followup_service.py`
- Create: `api-service/tests/test_followup_service.py`

- [ ] **Step 1: Write the failing tests**

Create `api-service/tests/test_followup_service.py`:

```python
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```
cd api-service && python -m pytest tests/test_followup_service.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'src.services.followup_service'`

- [ ] **Step 3: Implement FollowUpService**

Create `api-service/src/services/followup_service.py`:

```python
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
        return [
            d.to_dict()
            for d in docs
            if d.to_dict().get("accepted_at") and d.to_dict()["accepted_at"] <= cutoff
        ]

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
```

- [ ] **Step 4: Run tests to confirm they pass**

```
cd api-service && python -m pytest tests/test_followup_service.py -v
```

Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add api-service/src/services/followup_service.py api-service/tests/test_followup_service.py
git commit -m "feat: add FollowUpService for post-acceptance push queue"
```

---

### Task 3: Enqueue followup on acceptance

**Files:**
- Modify: `api-service/src/api/routes_signals.py`
- Modify: `api-service/src/services/__init__.py` (add get_followup_service export)

- [ ] **Step 1: Export get_followup_service from services __init__**

Open `api-service/src/services/__init__.py`. Add:

```python
from .followup_service import get_followup_service
```

(Add it alongside the other `get_*_service` imports already there.)

- [ ] **Step 2: Update accept_recommendation in routes_signals.py**

In `api-service/src/api/routes_signals.py`, add the import at the top:

```python
from ..services import get_followup_service
```

Then update the `accept_recommendation` endpoint. The existing endpoint ends with `return {"message": "Acceptance recorded", "game_id": game_id}`. Add followup enqueue before that return, only when `user_id` is present and `game_title` is present:

```python
@router.post("/accept")
async def accept_recommendation(
    game_id: str,
    session_id: str,
    game_title: Optional[str] = None,
    user_id: Optional[str] = Depends(get_user_id)
):
    """
    Record that a user accepted a recommendation.

    Use this when the user clicks "I'll play this".
    """
    logger.info(f"Accept request: game_id={game_id}, session_id={session_id}, game_title={game_title}, user_id={user_id}")
    try:
        service = get_signal_service()

        signal = UserSignalCreate(
            game_id=game_id,
            signal_type=SignalType.ACCEPTED
        )

        result = await service.record_signal(
            signal=signal,
            session_id=session_id,
            user_id=user_id,
            game_title=game_title
        )
        logger.info(f"Accept success: signal_id={result.signal_id}, user_id={result.user_id}")

        # Enqueue a follow-up push for authenticated users (anonymous users can't
        # respond since the worked endpoint requires auth).
        if user_id and game_title:
            try:
                get_followup_service().enqueue(
                    signal_id=result.signal_id,
                    user_id=user_id,
                    game_id=game_id,
                    game_title=game_title,
                )
            except Exception as e:
                logger.warning(f"Failed to enqueue followup for signal {result.signal_id}: {e}")

        return {"message": "Acceptance recorded", "game_id": game_id}
    except Exception as e:
        logger.error(f"Error recording acceptance: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to record acceptance"
        )
```

- [ ] **Step 3: Run all existing backend tests to confirm nothing broke**

```
cd api-service && python -m pytest tests/ -v
```

Expected: All previously passing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add api-service/src/api/routes_signals.py api-service/src/services/__init__.py
git commit -m "feat: enqueue followup push when authenticated user accepts recommendation"
```

---

### Task 4: send-followups endpoint + NotificationService method

**Files:**
- Modify: `api-service/src/services/notification_service.py`
- Modify: `api-service/src/api/routes_notifications.py`
- Modify: `api-service/tests/test_notification_service.py`

- [ ] **Step 1: Write the failing test for send_followup_notifications**

In `api-service/tests/test_notification_service.py`, add this test at the bottom:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta, timezone
from src.services.notification_service import NotificationService
from src.services.followup_service import FOLLOWUP_DELAY_HOURS


@pytest.mark.asyncio
async def test_send_followup_notifications_sends_to_registered_device():
    now = datetime(2026, 6, 8, 12, 0, tzinfo=timezone.utc)

    # Due followup
    followup = {
        "signal_id": "sig-001",
        "user_id": "user-123",
        "game_title": "Hades",
        "accepted_at": now - timedelta(hours=FOLLOWUP_DELAY_HOURS + 1),
        "status": "pending",
    }

    # Mock FollowUpService
    mock_followup_service = MagicMock()
    mock_followup_service.get_due_followups.return_value = [followup]

    # Mock devices collection — one enabled device for user-123
    device_doc = MagicMock()
    device_doc.to_dict.return_value = {
        "expo_push_token": "ExponentPushToken[abc]",
        "user_id": "user-123",
        "notifications_enabled": True,
    }
    mock_device_query = MagicMock()
    mock_device_query.stream.return_value = [device_doc]
    mock_device_query.where.return_value = mock_device_query

    mock_collection = MagicMock()
    mock_collection.where.return_value = mock_device_query

    service = NotificationService.__new__(NotificationService)
    service.collection = mock_collection
    service._send_messages = AsyncMock(return_value=[{"status": "ok"}])

    result = await service.send_followup_notifications(mock_followup_service, now)

    assert result["sent"] == 1
    assert result["skipped"] == 0
    service._send_messages.assert_called_once()
    sent_msg = service._send_messages.call_args[0][0][0]
    assert sent_msg["to"] == "ExponentPushToken[abc]"
    assert "Hades" in sent_msg["title"]
    assert sent_msg["data"]["deep_link"] == "followup"
    assert sent_msg["data"]["signal_id"] == "sig-001"
```

- [ ] **Step 2: Run the test to confirm it fails**

```
cd api-service && python -m pytest tests/test_notification_service.py::test_send_followup_notifications_sends_to_registered_device -v
```

Expected: FAIL — `AttributeError: 'NotificationService' object has no attribute 'send_followup_notifications'`

- [ ] **Step 3: Add send_followup_notifications to NotificationService**

In `api-service/src/services/notification_service.py`, add this method to the `NotificationService` class (after `run_weekly_send`):

```python
    async def send_followup_notifications(self, followup_service, now: Optional[datetime] = None) -> dict:
        """Send 'how was it?' pushes for all due followups and mark them sent."""
        if now is None:
            now = datetime.now(timezone.utc)
        due = followup_service.get_due_followups(now)
        sent = 0
        skipped = 0
        for item in due:
            user_id = item.get("user_id")
            game_title = item.get("game_title", "the game")
            signal_id = item["signal_id"]

            # Find enabled devices for this user
            devices = list(
                self.collection
                    .where("user_id", "==", user_id)
                    .where("notifications_enabled", "==", True)
                    .stream()
            )
            if not devices:
                followup_service.mark_no_device(signal_id)
                skipped += 1
                continue

            messages = [{
                "to": d.to_dict()["expo_push_token"],
                "title": f"How did {game_title} go?",
                "body": "Did the recommendation work out? Tap to let us know.",
                "sound": "default",
                "data": {
                    "deep_link": "followup",
                    "signal_id": signal_id,
                    "game_title": game_title,
                },
            } for d in devices]

            await self._send_messages(messages)
            followup_service.mark_sent(signal_id, now)
            sent += 1

        return {"sent": sent, "skipped": skipped}
```

- [ ] **Step 4: Run the new test to confirm it passes**

```
cd api-service && python -m pytest tests/test_notification_service.py::test_send_followup_notifications_sends_to_registered_device -v
```

Expected: PASS

- [ ] **Step 5: Add the send-followups route to routes_notifications.py**

In `api-service/src/api/routes_notifications.py`, add the following import at the top:

```python
from ..services import get_followup_service
```

Then add the new endpoint after the existing `send_weekly` endpoint:

```python
@router.post("/send-followups")
async def send_followups(x_cron_secret: Optional[str] = Header(default=None)):
    """Send 'how was it?' pushes for accepted recommendations from ~22h ago.
    Protected by the same shared secret as send-weekly (Cloud Scheduler)."""
    if not settings.cron_secret or x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=403, detail="Forbidden")
    result = await get_notification_service().send_followup_notifications(get_followup_service())
    return result
```

- [ ] **Step 6: Run all backend tests to confirm nothing broke**

```
cd api-service && python -m pytest tests/ -v
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add api-service/src/services/notification_service.py api-service/src/api/routes_notifications.py api-service/tests/test_notification_service.py
git commit -m "feat: add send_followup_notifications and POST /notifications/send-followups endpoint"
```

---

### Task 5: Deploy backend + create Cloud Scheduler job

- [ ] **Step 1: Deploy the API to Cloud Run**

From `api-service/`:

```bash
cd api-service
git push origin main
# Wait for GitHub Actions api-deploy.yml to complete, OR deploy manually:
gcloud run deploy playnxt-api \
  --source . \
  --region us-central1 \
  --project playnxt-1a2c6
```

- [ ] **Step 2: Create the Cloud Scheduler job**

```bash
gcloud scheduler jobs create http playnxt-followup-push \
  --schedule="0 */2 * * *" \
  --uri="https://playnxt-api-167253232570.us-central1.run.app/api/notifications/send-followups" \
  --http-method=POST \
  --headers="X-Cron-Secret=$(gcloud secrets versions access latest --secret=CRON_SECRET --project=playnxt-1a2c6)" \
  --location=us-central1 \
  --project=playnxt-1a2c6 \
  --description="Send follow-up push notifications 22h after game acceptance"
```

- [ ] **Step 3: Verify the job runs**

```bash
gcloud scheduler jobs run playnxt-followup-push --location=us-central1 --project=playnxt-1a2c6
# Then check Cloud Run logs:
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=playnxt-api" \
  --project=playnxt-1a2c6 --limit=20 --format="value(textPayload)"
```

Expected: Log line showing `{"sent": 0, "skipped": 0}` (no followups queued yet).

---

### Task 6: updateSignalWorked in mobile api.js

**Files:**
- Modify: `mobile-app/src/services/api.js`

- [ ] **Step 1: Add updateSignalWorked after deleteSignal in api.js**

In `mobile-app/src/services/api.js`, find the `deleteSignal` method and add after it:

```js
  /**
   * Record whether a recommendation worked for the user.
   * Called from the follow-up push notification response.
   * @param {string} signalId - The signal ID from the acceptance signal
   * @param {boolean} worked - true = worked, false = didn't work
   */
  updateSignalWorked: async (signalId, worked) => {
    const response = await apiClient.patch(
      `/signals/history/${signalId}/worked`,
      null,
      { params: { worked } }
    );
    return response.data;
  },
```

- [ ] **Step 2: Verify with existing api tests**

```
cd mobile-app && npx jest --testPathPattern=api --no-coverage
```

Expected: All api tests pass.

- [ ] **Step 3: Commit**

```bash
git add mobile-app/src/services/api.js
git commit -m "feat: add updateSignalWorked to api client"
```

---

### Task 7: FollowUpModal component

**Files:**
- Create: `mobile-app/src/components/FollowUpModal.js`

- [ ] **Step 1: Create the component**

Create `mobile-app/src/components/FollowUpModal.js`:

```js
import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Shown when the user taps a follow-up push notification.
 * Props:
 *   visible: bool
 *   gameTitle: string
 *   onWorked: () => void   — user taps 👍
 *   onDidntWork: () => void — user taps 👎
 *   onDismiss: () => void
 *   isSubmitting: bool
 */
const FollowUpModal = ({ visible, gameTitle, onWorked, onDidntWork, onDismiss, isSubmitting }) => {
  const title = gameTitle || 'the game';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🎮</Text>
          <Text style={styles.title}>How did it go?</Text>
          <Text style={styles.body}>
            Did <Text style={styles.gameTitle}>{title}</Text> work out for you?
          </Text>

          {isSubmitting ? (
            <ActivityIndicator color="#f857a6" style={{ marginVertical: 24 }} />
          ) : (
            <View style={styles.buttons}>
              <Pressable
                style={({ pressed }) => [styles.thumbButton, pressed && styles.buttonPressed]}
                onPress={onWorked}
              >
                <LinearGradient
                  colors={['#10b981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.thumbGradient}
                >
                  <Text style={styles.thumbEmoji}>👍</Text>
                  <Text style={styles.thumbText}>It worked!</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.thumbButton, pressed && styles.buttonPressed]}
                onPress={onDidntWork}
              >
                <LinearGradient
                  colors={['#6b7280', '#4b5563']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.thumbGradient}
                >
                  <Text style={styles.thumbEmoji}>👎</Text>
                  <Text style={styles.thumbText}>Not really</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}

          <Pressable style={styles.skipButton} onPress={onDismiss}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 32,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(248, 87, 166, 0.2)',
  },
  emoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    color: '#a0a0b0',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  gameTitle: {
    color: '#f857a6',
    fontWeight: '700',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 16,
  },
  thumbButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  thumbGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  thumbEmoji: {
    fontSize: 24,
  },
  thumbText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 14,
    color: '#505060',
  },
});

export default FollowUpModal;
```

- [ ] **Step 2: Run all mobile tests**

```
cd mobile-app && npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add mobile-app/src/components/FollowUpModal.js
git commit -m "feat: add FollowUpModal for post-acceptance feedback"
```

---

### Task 8: Wire FollowUpModal into App.js

**Files:**
- Modify: `mobile-app/src/services/notificationService.js`
- Modify: `mobile-app/App.js`

The notification listener currently passes a `deepLink` string. Extend it to pass the full notification `data` object so `App.js` can read `signal_id` and `game_title` for followup deep links.

- [ ] **Step 1: Update addNotificationResponseListener to pass full data**

In `mobile-app/src/services/notificationService.js`, replace the `addNotificationResponseListener` function:

```js
/**
 * Wire a tap handler. `onNotification(data)` receives the full notification
 * data payload: { deep_link: 'whats_new' | 'play' | 'followup', signal_id?, game_title? }.
 * Returns the subscription so callers can remove it on unmount.
 */
export function addNotificationResponseListener(onNotification) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data || {};
    onNotification(data);
  });
}
```

- [ ] **Step 2: Update App.js to handle the followup deep link**

In `mobile-app/App.js`:

Add to imports:
```js
import { useState } from 'react';
import FollowUpModal from './src/components/FollowUpModal';
import api from './src/services/api';
```

(Note: `useState` is already imported — just add the other two.)

Add state and handler inside the `App` component, after the existing `showWelcome` state:

```js
  const [followUpData, setFollowUpData] = useState(null); // { signalId, gameTitle }
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);

  const handleFollowUp = async (worked) => {
    if (!followUpData?.signalId) return;
    setIsSubmittingFollowUp(true);
    try {
      await api.updateSignalWorked(followUpData.signalId, worked);
    } catch {
      // Signal update failed — non-fatal, user already gave feedback
    } finally {
      setIsSubmittingFollowUp(false);
      setFollowUpData(null);
    }
  };
```

Update the notification listener `useEffect` to handle the new data shape:

```js
  useEffect(() => {
    const subscription = addNotificationResponseListener((data) => {
      if (!navigationRef.isReady()) return;
      if (data.deep_link === 'followup' && data.signal_id) {
        setFollowUpData({ signalId: data.signal_id, gameTitle: data.game_title });
      } else if (data.deep_link === 'whats_new') {
        navigationRef.navigate('WhatsNew');
      } else {
        navigationRef.navigate('Main', { screen: 'Play' });
      }
    });
    return () => subscription?.remove?.();
  }, []);
```

Add `<FollowUpModal>` just before the closing `</GestureHandlerRootView>` tag (outside providers so it renders over everything):

```jsx
      <FollowUpModal
        visible={!!followUpData}
        gameTitle={followUpData?.gameTitle}
        isSubmitting={isSubmittingFollowUp}
        onWorked={() => handleFollowUp(true)}
        onDidntWork={() => handleFollowUp(false)}
        onDismiss={() => setFollowUpData(null)}
      />
```

The full updated return block in App.js should look like:

```jsx
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AdProvider>
            <PremiumProvider>
              <SavedGamesProvider>
                <RecommendationProvider>
                  <StatusBar style="light" />
                  <AppNavigator />
                </RecommendationProvider>
              </SavedGamesProvider>
            </PremiumProvider>
          </AdProvider>
        </AuthProvider>
      </SafeAreaProvider>
      <FollowUpModal
        visible={!!followUpData}
        gameTitle={followUpData?.gameTitle}
        isSubmitting={isSubmittingFollowUp}
        onWorked={() => handleFollowUp(true)}
        onDidntWork={() => handleFollowUp(false)}
        onDismiss={() => setFollowUpData(null)}
      />
    </GestureHandlerRootView>
  );
```

- [ ] **Step 3: Run all mobile tests**

```
cd mobile-app && npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add mobile-app/src/services/notificationService.js mobile-app/App.js
git commit -m "feat: wire FollowUpModal to notification deep link in App.js"
```
