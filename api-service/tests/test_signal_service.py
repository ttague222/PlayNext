"""
Tests for SignalService.

These tests verify signal recording, history management, and user data operations.
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime

from src.models import SignalType, UserSignalCreate
from src.services.signal_service import build_rating_summary, RATING_DISPLAY_THRESHOLD


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


class TestPositiveSignals:
    """Tests for the Smart History data source."""

    @pytest.fixture
    def service(self, mock_firebase):
        from unittest.mock import MagicMock, patch
        with patch('src.services.signal_service.get_collection') as mock_get_collection:
            mock_get_collection.side_effect = lambda name: MagicMock()
            from src.services.signal_service import SignalService
            return SignalService()

    @pytest.mark.asyncio
    async def test_get_positive_signals_filters_to_positive_types(self, service, mock_user):
        """Should call get_user_signals with the three positive signal types."""
        from src.models import SignalType
        from unittest.mock import AsyncMock

        service.get_user_signals = AsyncMock(return_value=[])
        await service.get_positive_signals(user_id=mock_user["uid"], limit=20)

        kwargs = service.get_user_signals.call_args.kwargs
        assert kwargs["user_id"] == mock_user["uid"]
        assert kwargs["limit"] == 20
        assert set(kwargs["signal_types"]) == {
            SignalType.WORKED, SignalType.PLAYED_LOVED, SignalType.ACCEPTED,
        }


class TestBuildRatingSummary:
    """Pure summary builder for thumbs ratings (spec 2026-09-22)."""

    def test_below_threshold_hides_percent(self):
        s = build_rating_summary({"rated_up": 3, "rated_down": 1}, user_rating="up")
        assert s["up"] == 3 and s["down"] == 1 and s["total"] == 4
        assert s["percent_liked"] is None            # cold-start protection
        assert s["user_rating"] == "up"

    def test_at_threshold_shows_percent(self):
        s = build_rating_summary({"rated_up": 9, "rated_down": 1}, user_rating=None)
        assert s["total"] == RATING_DISPLAY_THRESHOLD
        assert s["percent_liked"] == 90

    def test_no_ratings(self):
        s = build_rating_summary({}, user_rating=None)
        assert s == {"up": 0, "down": 0, "total": 0, "percent_liked": None, "user_rating": None}

    def test_ignores_other_signal_types(self):
        s = build_rating_summary({"rated_up": 2, "worked": 50, "accepted": 7}, user_rating=None)
        assert s["total"] == 2

    def test_percent_rounds_to_int(self):
        s = build_rating_summary({"rated_up": 7, "rated_down": 4}, user_rating="down")
        assert s["percent_liked"] == 64  # 7/11 = 63.6 -> round


class TestGameRating:
    """SignalService.set_game_rating / get_game_rating (spec 2026-09-22)."""

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

    def _mock_existing_signal_docs(self, service, docs):
        """Wire signals_collection.where(...).where(...).stream() to return docs."""
        mock_query = MagicMock()
        service.signals_collection.where.return_value = mock_query
        mock_query.where.return_value = mock_query
        mock_query.stream.return_value = docs
        return mock_query

    def _doc(self, signal_type):
        doc = MagicMock()
        doc.to_dict.return_value = {"signal_type": signal_type}
        doc.reference = MagicMock()
        return doc

    @pytest.mark.asyncio
    async def test_set_rating_deletes_prior_rated_docs_and_records_new(self, service, mock_user):
        """Setting a rating clears any existing rated_* docs then records the new one."""
        rated_up_doc = self._doc("rated_up")
        rated_down_doc = self._doc("rated_down")
        unrelated_doc = self._doc("accepted")  # not a rating signal; must survive
        self._mock_existing_signal_docs(service, [rated_up_doc, rated_down_doc, unrelated_doc])

        recorded = MagicMock()
        service.record_signal = AsyncMock(return_value=recorded)

        result = await service.set_game_rating(
            user_id=mock_user["uid"], game_id="game-001", rating="up", game_title="Adventure Land"
        )

        rated_up_doc.reference.delete.assert_called_once()
        rated_down_doc.reference.delete.assert_called_once()
        unrelated_doc.reference.delete.assert_not_called()

        service.record_signal.assert_awaited_once()
        call_kwargs = service.record_signal.call_args.kwargs
        assert call_kwargs["session_id"] == "game_detail_rating"
        assert call_kwargs["user_id"] == mock_user["uid"]
        assert call_kwargs["game_title"] == "Adventure Land"
        assert call_kwargs["signal"].game_id == "game-001"
        assert call_kwargs["signal"].signal_type == SignalType.RATED_UP
        assert result is recorded

    @pytest.mark.asyncio
    async def test_set_rating_none_clears_without_recording(self, service, mock_user):
        """rating=None deletes any existing rated_* docs and records nothing."""
        rated_down_doc = self._doc("rated_down")
        self._mock_existing_signal_docs(service, [rated_down_doc])

        service.record_signal = AsyncMock()

        result = await service.set_game_rating(
            user_id=mock_user["uid"], game_id="game-001", rating=None
        )

        rated_down_doc.reference.delete.assert_called_once()
        service.record_signal.assert_not_awaited()
        assert result is None

    @pytest.mark.asyncio
    async def test_get_game_rating_composes_counts_and_user_rating(self, service, mock_user):
        """get_game_rating aggregates counts via get_game_signals and finds the caller's own rating."""
        service.get_game_signals = AsyncMock(return_value={"rated_up": 9, "rated_down": 1})

        own_signal = MagicMock()
        own_signal.signal_type = SignalType.RATED_UP
        service.get_user_signals = AsyncMock(return_value=[own_signal])

        summary = await service.get_game_rating("game-001", mock_user["uid"])

        service.get_game_signals.assert_awaited_once_with(
            "game-001", signal_types=[SignalType.RATED_UP, SignalType.RATED_DOWN]
        )
        service.get_user_signals.assert_awaited_once_with(
            mock_user["uid"], game_id="game-001", limit=10
        )
        assert summary == {
            "up": 9, "down": 1, "total": 10, "percent_liked": 90, "user_rating": "up",
        }

    @pytest.mark.asyncio
    async def test_get_game_rating_anonymous_caller_has_no_user_rating(self, service):
        """No user_id means no lookup of the caller's own rating."""
        service.get_game_signals = AsyncMock(return_value={"rated_up": 2, "rated_down": 1})
        service.get_user_signals = AsyncMock(return_value=[])

        summary = await service.get_game_rating("game-001", None)

        service.get_user_signals.assert_not_awaited()
        assert summary["user_rating"] is None
