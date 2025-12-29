"""
PlayNext Signal Routes

API endpoints for recording user preference signals.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from ..models import (
    UserSignal,
    UserSignalCreate,
    FeedbackRequest,
    SignalType,
    Session,
)
from ..services import get_signal_service
from .auth import get_user_id, require_authenticated_user

logger = logging.getLogger("playnext-api.routes.signals")

router = APIRouter(prefix="/signals", tags=["Signals"])


@router.post("/feedback", response_model=UserSignal)
async def submit_feedback(
    feedback: FeedbackRequest,
    user_id: Optional[str] = Depends(get_user_id)
):
    """
    Submit feedback on a recommendation.

    Use this endpoint when a user provides feedback on a game recommendation:
    - `worked`: The recommendation was a good fit
    - `not_good_fit`: The recommendation didn't work out
    - `played_loved`: User has played and loved this game
    - `played_neutral`: User has played, it was okay
    - `played_didnt_stick`: User has played but it didn't stick
    - `accepted`: User chose to play this game
    - `skipped`: User skipped this recommendation
    """
    try:
        service = get_signal_service()

        signal = UserSignalCreate(
            game_id=feedback.game_id,
            signal_type=feedback.signal_type,
            context=feedback.context
        )

        return await service.record_signal(
            signal=signal,
            session_id=feedback.session_id,
            user_id=user_id,
            game_title=feedback.game_title
        )
    except Exception as e:
        logger.error(f"Error recording feedback: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to record feedback"
        )


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

        return {"message": "Acceptance recorded", "game_id": game_id}
    except Exception as e:
        logger.error(f"Error recording acceptance: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to record acceptance"
        )


@router.get("/history", response_model=list[UserSignal])
async def get_signal_history(
    user: dict = Depends(require_authenticated_user),
    limit: int = 50
):
    """
    Get a user's signal history.

    Returns the user's recent feedback and acceptance signals.
    Requires authentication.
    """
    logger.info(f"History request: user_id={user['uid']}, limit={limit}")
    service = get_signal_service()
    signals = await service.get_user_signals(user["uid"], limit=limit)
    logger.info(f"History response: user_id={user['uid']}, count={len(signals)}")
    return signals


@router.get("/game/{game_id}")
async def get_game_signals(game_id: str):
    """
    Get aggregated signal counts for a game.

    Returns counts of each signal type for the specified game.
    Useful for understanding how well a game is being received.
    """
    service = get_signal_service()
    return await service.get_game_signals(game_id)


@router.post("/session", response_model=Session)
async def create_session(
    user_id: Optional[str] = Depends(get_user_id)
):
    """
    Create a new recommendation session.

    Call this at the start of a user's recommendation flow.
    The returned session_id should be included in subsequent requests.
    """
    service = get_signal_service()
    return await service.create_session(user_id)


@router.get("/session/{session_id}", response_model=Session)
async def get_session(session_id: str):
    """
    Get information about a session.

    Returns session details including games shown and reroll count.
    """
    service = get_signal_service()
    session = await service.get_session(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return session


@router.delete("/history/{signal_id}")
async def delete_signal(
    signal_id: str,
    user: dict = Depends(require_authenticated_user)
):
    """
    Delete a signal from user's history.

    Requires authentication. User can only delete their own signals.
    """
    try:
        service = get_signal_service()
        success = await service.delete_signal(signal_id, user["uid"])

        if not success:
            raise HTTPException(status_code=404, detail="Signal not found or unauthorized")

        return {"message": "Signal deleted", "signal_id": signal_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting signal: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete signal")


@router.delete("/history")
async def clear_history(
    user: dict = Depends(require_authenticated_user)
):
    """
    Clear all signals from user's history.

    Requires authentication. Deletes all signals for the authenticated user.
    """
    try:
        service = get_signal_service()
        count = await service.clear_user_history(user["uid"])

        return {"message": "History cleared", "deleted_count": count}
    except Exception as e:
        logger.error(f"Error clearing history: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear history")


@router.patch("/history/{signal_id}/worked")
async def update_worked_status(
    signal_id: str,
    worked: bool,
    user: dict = Depends(require_authenticated_user)
):
    """
    Update the 'worked' status of a signal.

    Sets whether the recommendation worked for the user.
    Requires authentication. User can only update their own signals.
    """
    try:
        service = get_signal_service()
        success = await service.update_signal_worked(signal_id, user["uid"], worked)

        if not success:
            raise HTTPException(status_code=404, detail="Signal not found or unauthorized")

        return {"message": "Worked status updated", "signal_id": signal_id, "worked": worked}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating worked status: {e}")
        raise HTTPException(status_code=500, detail="Failed to update worked status")


@router.delete("/user/data")
async def delete_user_data(
    user: dict = Depends(require_authenticated_user)
):
    """
    Delete all data for the authenticated user.

    Deletes all signals, sessions, and user document.
    This action cannot be undone.
    """
    try:
        service = get_signal_service()
        result = await service.delete_user_data(user["uid"])

        return {
            "message": "All user data deleted",
            "deleted": result
        }
    except Exception as e:
        logger.error(f"Error deleting user data: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete user data")
