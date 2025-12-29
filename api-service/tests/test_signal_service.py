"""
Tests for SignalService.

These tests verify signal recording, history management, and user data operations.
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime

from src.models import SignalType, UserSignalCreate


class TestSignalService:
    """Test SignalService methods."""

    @pytest.fixture
    def service(self, mock_firebase):
        """Create a SignalService instance with mocked Firebase."""
        with patch('src.services.signal_service.get_collection') as mock_get_collection:
            mock_signals_collection = MagicMock()
            mock_sessions_collection = MagicMock()
            mock_users_collection = MagicMock()

            mock_get_collection.side_effect = lambda name: {
                'signals': mock_signals_collection,
                'sessions': mock_sessions_collection,
                'users': mock_users_collection,
            }.get(name, MagicMock())

            from src.services.signal_service import SignalService
            svc = SignalService()
            svc.signals_collection = mock_signals_collection
            svc.sessions_collection = mock_sessions_collection
            svc.users_collection = mock_users_collection
            return svc

    @pytest.mark.asyncio
    async def test_delete_signal_success(self, service, mock_user, sample_signal):
        """Test successful signal deletion."""
        # Mock document exists and belongs to user
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = sample_signal

        mock_doc_ref = MagicMock()
        mock_doc_ref.get.return_value = mock_doc
        mock_doc_ref.delete.return_value = None

        service.signals_collection.document.return_value = mock_doc_ref

        result = await service.delete_signal("signal-001", mock_user["uid"])

        assert result is True
        mock_doc_ref.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_signal_not_found(self, service, mock_user):
        """Test deletion of non-existent signal."""
        mock_doc = MagicMock()
        mock_doc.exists = False

        mock_doc_ref = MagicMock()
        mock_doc_ref.get.return_value = mock_doc

        service.signals_collection.document.return_value = mock_doc_ref

        result = await service.delete_signal("nonexistent", mock_user["uid"])

        assert result is False

    @pytest.mark.asyncio
    async def test_delete_signal_unauthorized(self, service, sample_signal):
        """Test deletion by unauthorized user."""
        # Signal belongs to different user
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = sample_signal

        mock_doc_ref = MagicMock()
        mock_doc_ref.get.return_value = mock_doc

        service.signals_collection.document.return_value = mock_doc_ref

        # Try to delete with different user
        result = await service.delete_signal("signal-001", "different-user")

        assert result is False
        mock_doc_ref.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_clear_user_history(self, service, mock_user):
        """Test clearing all user signals."""
        # Mock 3 signals for the user
        mock_docs = [MagicMock() for _ in range(3)]
        for i, doc in enumerate(mock_docs):
            doc.reference = MagicMock()
            doc.reference.delete = MagicMock()

        mock_query = MagicMock()
        mock_query.stream.return_value = mock_docs
        service.signals_collection.where.return_value = mock_query

        count = await service.clear_user_history(mock_user["uid"])

        assert count == 3
        for doc in mock_docs:
            doc.reference.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_clear_user_history_empty(self, service, mock_user):
        """Test clearing history with no signals."""
        mock_query = MagicMock()
        mock_query.stream.return_value = []
        service.signals_collection.where.return_value = mock_query

        count = await service.clear_user_history(mock_user["uid"])

        assert count == 0

    @pytest.mark.asyncio
    async def test_update_signal_worked_success(self, service, mock_user, sample_signal):
        """Test successful worked status update."""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = sample_signal

        mock_doc_ref = MagicMock()
        mock_doc_ref.get.return_value = mock_doc
        mock_doc_ref.update.return_value = None

        service.signals_collection.document.return_value = mock_doc_ref

        result = await service.update_signal_worked("signal-001", mock_user["uid"], True)

        assert result is True
        mock_doc_ref.update.assert_called_once()
        # Verify worked status and timestamp were updated
        call_args = mock_doc_ref.update.call_args[0][0]
        assert call_args["worked"] is True
        assert "worked_updated_at" in call_args

    @pytest.mark.asyncio
    async def test_update_signal_worked_unauthorized(self, service, sample_signal):
        """Test worked status update by unauthorized user."""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = sample_signal

        mock_doc_ref = MagicMock()
        mock_doc_ref.get.return_value = mock_doc

        service.signals_collection.document.return_value = mock_doc_ref

        result = await service.update_signal_worked("signal-001", "different-user", True)

        assert result is False
        mock_doc_ref.update.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_user_data(self, service, mock_user):
        """Test deleting all user data."""
        # Mock signals
        mock_signals = [MagicMock() for _ in range(5)]
        for doc in mock_signals:
            doc.reference = MagicMock()

        mock_signals_query = MagicMock()
        mock_signals_query.stream.return_value = mock_signals

        # Mock sessions
        mock_sessions = [MagicMock() for _ in range(2)]
        for doc in mock_sessions:
            doc.reference = MagicMock()

        mock_sessions_query = MagicMock()
        mock_sessions_query.stream.return_value = mock_sessions

        # Mock user document
        mock_user_doc_data = MagicMock()
        mock_user_doc_data.exists = True

        mock_user_doc = MagicMock()
        mock_user_doc.get.return_value = mock_user_doc_data

        # Set up query responses
        def where_side_effect(*args, **kwargs):
            if args[0] == "user_id":
                return mock_signals_query
            return MagicMock(stream=MagicMock(return_value=[]))

        service.signals_collection.where.side_effect = where_side_effect
        service.sessions_collection.where.return_value = mock_sessions_query
        service.users_collection.document.return_value = mock_user_doc

        result = await service.delete_user_data(mock_user["uid"])

        assert result["signals"] == 5
        assert result["sessions"] == 2
        assert result["user"] is True


class TestSessionManagement:
    """Test session creation and retrieval."""

    @pytest.fixture
    def service(self, mock_firebase):
        """Create a SignalService instance."""
        with patch('src.services.signal_service.get_collection') as mock_get_collection:
            mock_sessions_collection = MagicMock()
            mock_get_collection.return_value = mock_sessions_collection

            from src.services.signal_service import SignalService
            svc = SignalService()
            svc.sessions_collection = mock_sessions_collection
            return svc

    @pytest.mark.asyncio
    async def test_create_session_authenticated(self, service, mock_user):
        """Test creating a session for authenticated user."""
        mock_doc_ref = MagicMock()
        mock_doc_ref.set.return_value = None
        service.sessions_collection.document.return_value = mock_doc_ref

        session = await service.create_session(mock_user["uid"])

        assert session.session_id is not None
        assert session.user_id == mock_user["uid"]
        assert session.reroll_count == 0
        assert session.games_shown == []

    @pytest.mark.asyncio
    async def test_create_session_anonymous(self, service):
        """Test creating a session for anonymous user."""
        mock_doc_ref = MagicMock()
        mock_doc_ref.set.return_value = None
        service.sessions_collection.document.return_value = mock_doc_ref

        session = await service.create_session(None)

        assert session.session_id is not None
        assert session.user_id is None

    @pytest.mark.asyncio
    async def test_get_session_exists(self, service, sample_session):
        """Test retrieving existing session."""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = sample_session

        mock_doc_ref = MagicMock()
        mock_doc_ref.get.return_value = mock_doc

        service.sessions_collection.document.return_value = mock_doc_ref

        session = await service.get_session("session-001")

        assert session is not None
        assert session.session_id == sample_session["session_id"]

    @pytest.mark.asyncio
    async def test_get_session_not_found(self, service):
        """Test retrieving non-existent session."""
        mock_doc = MagicMock()
        mock_doc.exists = False

        mock_doc_ref = MagicMock()
        mock_doc_ref.get.return_value = mock_doc

        service.sessions_collection.document.return_value = mock_doc_ref

        session = await service.get_session("nonexistent")

        assert session is None


class TestSignalRecording:
    """Test signal recording functionality."""

    @pytest.fixture
    def service(self, mock_firebase):
        """Create service instance."""
        with patch('src.services.signal_service.get_collection') as mock_get_collection:
            mock_signals_collection = MagicMock()
            mock_users_collection = MagicMock()
            mock_sessions_collection = MagicMock()

            mock_get_collection.side_effect = lambda name: {
                'signals': mock_signals_collection,
                'users': mock_users_collection,
                'sessions': mock_sessions_collection,
            }.get(name, MagicMock())

            from src.services.signal_service import SignalService
            svc = SignalService()
            svc.signals_collection = mock_signals_collection
            svc.users_collection = mock_users_collection
            svc.sessions_collection = mock_sessions_collection
            return svc

    @pytest.mark.asyncio
    async def test_record_signal_accepted(self, service, mock_user):
        """Test recording an accepted signal."""
        mock_doc_ref = MagicMock()
        mock_doc_ref.set.return_value = None
        service.signals_collection.document.return_value = mock_doc_ref

        signal = UserSignalCreate(
            game_id="game-001",
            signal_type=SignalType.ACCEPTED
        )

        result = await service.record_signal(
            signal=signal,
            session_id="session-001",
            user_id=mock_user["uid"]
        )

        assert result is not None
        assert result.game_id == "game-001"
        assert result.signal_type == SignalType.ACCEPTED
        mock_doc_ref.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_record_signal_anonymous(self, service):
        """Test recording a signal for anonymous user."""
        mock_doc_ref = MagicMock()
        mock_doc_ref.set.return_value = None
        service.signals_collection.document.return_value = mock_doc_ref

        signal = UserSignalCreate(
            game_id="game-001",
            signal_type=SignalType.SKIPPED
        )

        result = await service.record_signal(
            signal=signal,
            session_id="session-001",
            user_id=None
        )

        assert result is not None
        assert result.user_id is None
