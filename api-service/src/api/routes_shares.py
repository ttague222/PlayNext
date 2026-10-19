"""
PlayNxt Share Routes

Endpoints behind shareable results: create a share when someone shares their
picks, read it back when the /s/<share-id> landing page renders.

Shares work anonymously -- the web quiz has no login, and the app's PRD
requires recommendations to work without an account.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from ..models import ShareCreate, ShareCreateResponse, SharePublic
from ..services import get_share_service
from .auth import get_user_id

logger = logging.getLogger("playnext-api.routes.shares")

router = APIRouter(prefix="/shares", tags=["Shares"])


@router.post("", response_model=ShareCreateResponse, status_code=201)
async def create_share(
    request: ShareCreate,
    user_id: Optional[str] = Depends(get_user_id)
):
    """
    Store the picks behind a share link.

    Called when a user shares their results from the web quiz or the app. The
    picks are stored as shown -- title, match percentage and the "why this
    fits" line -- so the landing page can render the sharer's real picks.

    Returns the share id; the caller builds its own `/s/<share-id>` URL.
    """
    try:
        service = get_share_service()
        share = await service.create_share(request, user_id)
        return ShareCreateResponse(share_id=share.share_id)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating share: {e}")
        raise HTTPException(status_code=500, detail="Failed to create share")


@router.get("/{share_id}", response_model=SharePublic)
async def get_share(
    share_id: str,
    user_id: Optional[str] = Depends(get_user_id)
):
    """
    Fetch the picks behind a share link.

    Used by the /s/<share-id> landing page, which is server-rendered so link
    unfurls carry the picks in their OpenGraph tags.
    """
    try:
        service = get_share_service()
        share = service.get_share(share_id)

        if share is None:
            raise HTTPException(status_code=404, detail="Share not found")

        return share

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching share {share_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch share")
