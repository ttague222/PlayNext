"""
PlayNext Recommendation Routes

API endpoints for getting game recommendations.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from ..models import RecommendationRequest, RecommendationResponse
from ..services import get_recommendation_service
from .auth import get_user_id

logger = logging.getLogger("playnext-api.routes.recommend")

router = APIRouter(prefix="/recommend", tags=["Recommendations"])


@router.post("", response_model=RecommendationResponse)
async def get_recommendations(
    request: RecommendationRequest,
    user_id: Optional[str] = Depends(get_user_id)
):
    """
    Get game recommendations based on user preferences.

    This is the core endpoint of PlayNext. It returns 1-3 game recommendations
    based on the user's available time, energy/mood, and optional filters.

    **Required inputs:**
    - `time_available`: Available time in minutes (15, 30, 60, 90, 120+)
    - `energy_mood`: Current energy state (wind_down, casual, focused, intense)

    **Optional inputs:**
    - `play_style`: Preferred play style (narrative, action, puzzle_strategy, sandbox_creative)
    - `platform`: Target platform (pc, console, handheld)
    - `session_type`: Solo, couch_coop, online_friends, or any
    - `discovery_mode`: Familiar (default) or surprise

    **Response:**
    - 1-3 game recommendations with explanations
    - Session ID for tracking
    - Fallback information if exact matches weren't available
    """
    try:
        service = get_recommendation_service()
        response = await service.get_recommendations(request, user_id)

        if not response.recommendations:
            logger.warning(f"No recommendations generated for request: {request}")

        return response

    except Exception as e:
        logger.error(f"Error generating recommendations: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate recommendations"
        )


@router.post("/reroll", response_model=RecommendationResponse)
async def reroll_recommendations(
    request: RecommendationRequest,
    user_id: Optional[str] = Depends(get_user_id)
):
    """
    Get new recommendations, excluding previously shown games.

    Use this endpoint when the user wants different options. Pass the
    `session_id` from the previous response and the game IDs to exclude
    in `excluded_game_ids`.
    """
    if not request.session_id:
        raise HTTPException(
            status_code=400,
            detail="session_id is required for reroll"
        )

    try:
        service = get_recommendation_service()
        response = await service.get_recommendations(request, user_id)
        return response

    except Exception as e:
        logger.error(f"Error rerolling recommendations: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to reroll recommendations"
        )
