"""
PlayNxt Seasonal Routes

Serves the seasonal themes content file so the mobile app can pick up new
seasons and collections without a release.
"""

import logging

from fastapi import APIRouter, HTTPException, Response

from ..models.seasonal import SeasonalContent
from ..services.seasonal_service import get_seasonal

logger = logging.getLogger("playnext-api.seasonal")

router = APIRouter(prefix="/seasonal", tags=["Seasonal"])

CACHE_CONTROL = "public, max-age=3600"


@router.get("", response_model=SeasonalContent)
async def get_seasonal_content(response: Response):
    """Get all seasons, palettes and collections (validated at startup)."""
    try:
        content = get_seasonal()
    except Exception as e:
        logger.error(f"Failed to load seasonal content: {e}")
        raise HTTPException(status_code=500, detail="Failed to load seasonal content")

    response.headers["Cache-Control"] = CACHE_CONTROL
    return content
