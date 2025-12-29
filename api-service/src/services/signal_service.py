"""
PlayNext Signal Service

Service for managing user preference signals.
"""

import logging
import uuid
from datetime import datetime
from typing import Optional

from ..db.firebase import get_collection, SIGNALS_COLLECTION, SESSIONS_COLLECTION, USERS_COLLECTION
from ..models import (
    UserSignal,
    UserSignalCreate,
    SignalType,
    SignalContext,
    Session,
    SessionCreate,
)

logger = logging.getLogger("playnext-api.signals")


class SignalService:
    """Service for recording and retrieving user signals."""

    def __init__(self):
        self.signals_collection = get_collection(SIGNALS_COLLECTION)
        self.sessions_collection = get_collection(SESSIONS_COLLECTION)
        self.users_collection = get_collection(USERS_COLLECTION)

    async def record_signal(
        self,
        signal: UserSignalCreate,
        session_id: str,
        user_id: Optional[str] = None,
        game_title: Optional[str] = None
    ) -> UserSignal:
        """Record a user signal."""
        try:
            signal_id = str(uuid.uuid4())

            data = {
                "signal_id": signal_id,
                "user_id": user_id,
                "session_id": session_id,
                "game_id": signal.game_id,
                "game_title": game_title,
                "signal_type": signal.signal_type.value,
                "context": signal.context.model_dump() if signal.context else None,
                "timestamp": datetime.utcnow(),
            }

            self.signals_collection.document(signal_id).set(data)
            logger.info(f"Recorded signal: {signal.signal_type.value} for game {signal.game_id}")

            # Update session if this is an acceptance
            if signal.signal_type == SignalType.ACCEPTED:
                await self._update_session_acceptance(session_id, signal.game_id)

            # Update user stats
            if user_id:
                await self._update_user_stats(user_id, signal.signal_type)

            return UserSignal(**data)
        except Exception as e:
            logger.error(f"Error recording signal: {e}")
            raise

    async def get_user_signals(
        self,
        user_id: str,
        game_id: Optional[str] = None,
        signal_types: Optional[list[SignalType]] = None,
        limit: int = 100
    ) -> list[UserSignal]:
        """Get signals for a user."""
        try:
            query = self.signals_collection.where("user_id", "==", user_id)

            if game_id:
                query = query.where("game_id", "==", game_id)

            if signal_types:
                type_values = [st.value for st in signal_types]
                query = query.where("signal_type", "in", type_values)

            # Fetch all matching documents (no order_by to avoid needing composite index)
            docs = list(query.stream())
            signals = [UserSignal(**doc.to_dict()) for doc in docs]

            # Sort by timestamp descending in Python
            signals.sort(key=lambda s: s.timestamp, reverse=True)

            # Apply limit after sorting
            return signals[:limit]
        except Exception as e:
            logger.error(f"Error fetching user signals: {e}")
            return []

    async def get_game_signals(
        self,
        game_id: str,
        signal_types: Optional[list[SignalType]] = None
    ) -> dict[str, int]:
        """Get aggregated signals for a game."""
        try:
            query = self.signals_collection.where("game_id", "==", game_id)
            docs = list(query.stream())

            counts = {}
            for doc in docs:
                signal_type = doc.to_dict().get("signal_type")
                if signal_types is None or signal_type in [st.value for st in signal_types]:
                    counts[signal_type] = counts.get(signal_type, 0) + 1

            return counts
        except Exception as e:
            logger.error(f"Error fetching game signals: {e}")
            return {}

    async def create_session(
        self,
        user_id: Optional[str] = None
    ) -> Session:
        """Create a new recommendation session."""
        try:
            session_id = str(uuid.uuid4())

            data = {
                "session_id": session_id,
                "user_id": user_id,
                "started_at": datetime.utcnow(),
                "ended_at": None,
                "games_shown": [],
                "reroll_count": 0,
                "accepted_game_id": None,
            }

            self.sessions_collection.document(session_id).set(data)
            logger.info(f"Created session: {session_id}")

            return Session(**data)
        except Exception as e:
            logger.error(f"Error creating session: {e}")
            raise

    async def update_session_games_shown(
        self,
        session_id: str,
        game_ids: list[str]
    ) -> None:
        """Update the games shown in a session."""
        try:
            doc_ref = self.sessions_collection.document(session_id)
            doc = doc_ref.get()

            if doc.exists:
                current_games = doc.to_dict().get("games_shown", [])
                updated_games = list(set(current_games + game_ids))
                reroll_count = doc.to_dict().get("reroll_count", 0) + 1

                doc_ref.update({
                    "games_shown": updated_games,
                    "reroll_count": reroll_count,
                })
        except Exception as e:
            logger.error(f"Error updating session: {e}")

    async def _update_session_acceptance(
        self,
        session_id: str,
        game_id: str
    ) -> None:
        """Mark a session as having an accepted game."""
        try:
            self.sessions_collection.document(session_id).update({
                "accepted_game_id": game_id,
                "ended_at": datetime.utcnow(),
            })
        except Exception as e:
            logger.error(f"Error updating session acceptance: {e}")

    async def _update_user_stats(
        self,
        user_id: str,
        signal_type: SignalType
    ) -> None:
        """Update user statistics based on signal."""
        try:
            doc_ref = self.users_collection.document(user_id)
            doc = doc_ref.get()

            if doc.exists:
                updates = {"last_active": datetime.utcnow()}

                if signal_type == SignalType.ACCEPTED:
                    current_accepts = doc.to_dict().get("total_accepts", 0)
                    updates["total_accepts"] = current_accepts + 1

                doc_ref.update(updates)
        except Exception as e:
            logger.error(f"Error updating user stats: {e}")

    async def get_session(self, session_id: str) -> Optional[Session]:
        """Get a session by ID."""
        try:
            doc = self.sessions_collection.document(session_id).get()
            if doc.exists:
                return Session(**doc.to_dict())
            return None
        except Exception as e:
            logger.error(f"Error fetching session: {e}")
            return None

    async def delete_signal(self, signal_id: str, user_id: str) -> bool:
        """
        Delete a signal from user's history.

        Returns True if deleted, False if not found or unauthorized.
        """
        try:
            doc_ref = self.signals_collection.document(signal_id)
            doc = doc_ref.get()

            if not doc.exists:
                return False

            # Verify the signal belongs to the user
            signal_data = doc.to_dict()
            if signal_data.get("user_id") != user_id:
                logger.warning(f"User {user_id} attempted to delete signal {signal_id} owned by another user")
                return False

            doc_ref.delete()
            logger.info(f"Deleted signal {signal_id} for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting signal: {e}")
            return False

    async def clear_user_history(self, user_id: str) -> int:
        """
        Clear all signals for a user.

        Returns the number of signals deleted.
        """
        try:
            query = self.signals_collection.where("user_id", "==", user_id)
            docs = list(query.stream())

            count = 0
            for doc in docs:
                doc.reference.delete()
                count += 1

            logger.info(f"Cleared {count} signals for user {user_id}")
            return count
        except Exception as e:
            logger.error(f"Error clearing user history: {e}")
            return 0

    async def update_signal_worked(self, signal_id: str, user_id: str, worked: bool) -> bool:
        """
        Update the 'worked' status of a signal.

        Returns True if updated, False if not found or unauthorized.
        """
        try:
            doc_ref = self.signals_collection.document(signal_id)
            doc = doc_ref.get()

            if not doc.exists:
                return False

            # Verify the signal belongs to the user
            signal_data = doc.to_dict()
            if signal_data.get("user_id") != user_id:
                logger.warning(f"User {user_id} attempted to update signal {signal_id} owned by another user")
                return False

            # Update the worked status
            doc_ref.update({"worked": worked, "worked_updated_at": datetime.utcnow()})
            logger.info(f"Updated worked status for signal {signal_id}: {worked}")
            return True
        except Exception as e:
            logger.error(f"Error updating signal worked status: {e}")
            return False

    async def delete_user_data(self, user_id: str) -> dict:
        """
        Delete all user data (signals, sessions, and user document).

        Returns a dict with counts of deleted items.
        """
        try:
            deleted = {"signals": 0, "sessions": 0, "user": False}

            # Delete all signals
            signals_query = self.signals_collection.where("user_id", "==", user_id)
            for doc in signals_query.stream():
                doc.reference.delete()
                deleted["signals"] += 1

            # Delete all sessions
            sessions_query = self.sessions_collection.where("user_id", "==", user_id)
            for doc in sessions_query.stream():
                doc.reference.delete()
                deleted["sessions"] += 1

            # Delete user document
            user_doc = self.users_collection.document(user_id)
            if user_doc.get().exists:
                user_doc.delete()
                deleted["user"] = True

            logger.info(f"Deleted all data for user {user_id}: {deleted}")
            return deleted
        except Exception as e:
            logger.error(f"Error deleting user data: {e}")
            raise


# Singleton instance
_signal_service: Optional[SignalService] = None


def get_signal_service() -> SignalService:
    """Get the signal service instance."""
    global _signal_service
    if _signal_service is None:
        _signal_service = SignalService()
    return _signal_service
