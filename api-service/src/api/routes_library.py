"""
PlayNext Library Routes

API endpoints for syncing platform libraries (Steam).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException

from ..models import SteamSyncRequest, SteamSyncResult, SteamLibraryStatus
from ..services import get_library_service
from ..services.library_service import SteamApiError, SyncCooldownError
from .auth import require_authenticated_user

logger = logging.getLogger("playnext-api.routes.library")

router = APIRouter(prefix="/library", tags=["Library"])


@router.post("/steam/sync", response_model=SteamSyncResult)
async def sync_steam_library(
    request: SteamSyncRequest,
    user: dict = Depends(require_authenticated_user)
):
    """
    Sync the user's Steam library.

    Accepts a Steam profile URL, vanity name, or 64-bit SteamID. The
    profile's game details must be public. Matched games with significant
    playtime are excluded from future recommendations.
    """
    try:
        service = get_library_service()
        return await service.sync_steam_library(user["uid"], request.profile)
    except SyncCooldownError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except ValueError as e:
        # Bad input, unresolvable profile, or private profile — the message
        # tells the user exactly what to fix.
        raise HTTPException(status_code=400, detail=str(e))
    except SteamApiError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Error syncing Steam library: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to sync Steam library"
        )


@router.get("/steam", response_model=SteamLibraryStatus)
async def get_steam_library_status(
    user: dict = Depends(require_authenticated_user)
):
    """
    Get the user's Steam library connection status.
    """
    try:
        service = get_library_service()
        return await service.get_status(user["uid"])
    except Exception as e:
        logger.error(f"Error getting library status: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get library status"
        )


@router.delete("/steam")
async def disconnect_steam_library(
    user: dict = Depends(require_authenticated_user)
):
    """
    Disconnect Steam and delete the synced library data entirely.
    """
    try:
        service = get_library_service()
        existed = await service.disconnect(user["uid"])
        return {"message": "Steam library disconnected", "existed": existed}
    except Exception as e:
        logger.error(f"Error disconnecting library: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to disconnect Steam library"
        )
