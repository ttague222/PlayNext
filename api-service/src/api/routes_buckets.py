"""
PlayNext Bucket Routes

API endpoints for managing save buckets (game collections).
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from ..models import (
    BucketType,
    BucketWithGames,
    BucketSummary,
    UserBucketsResponse,
    AddGameToBucketRequest,
    MoveGameRequest,
    BucketGame,
)
from ..services import get_bucket_service
from .auth import get_user_id, require_authenticated_user

logger = logging.getLogger("playnext-api.routes.buckets")

router = APIRouter(prefix="/buckets", tags=["Buckets"])


@router.get("", response_model=UserBucketsResponse)
async def get_user_buckets(
    user: dict = Depends(require_authenticated_user)
):
    """
    Get all buckets for the authenticated user.

    Creates default buckets if they don't exist.
    """
    try:
        service = get_bucket_service()
        return await service.get_user_buckets(user["uid"])
    except Exception as e:
        logger.error(f"Error getting buckets: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get buckets"
        )


@router.get("/{bucket_type}", response_model=BucketWithGames)
async def get_bucket(
    bucket_type: BucketType,
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(require_authenticated_user)
):
    """
    Get a specific bucket with its games.
    """
    try:
        service = get_bucket_service()
        return await service.get_bucket_with_games(
            user_id=user["uid"],
            bucket_type=bucket_type,
            limit=limit,
            offset=offset,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting bucket: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get bucket"
        )


@router.post("/{bucket_type}/games", response_model=BucketGame)
async def add_game_to_bucket(
    bucket_type: BucketType,
    request: AddGameToBucketRequest,
    user: dict = Depends(require_authenticated_user)
):
    """
    Add a game to a bucket.

    If the game exists in another bucket, it will be moved.
    """
    try:
        service = get_bucket_service()
        return await service.add_game_to_bucket(
            user_id=user["uid"],
            bucket_type=bucket_type,
            request=request,
        )
    except Exception as e:
        logger.error(f"Error adding game to bucket: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to add game to bucket"
        )


@router.delete("/{bucket_type}/games/{game_id}")
async def remove_game_from_bucket(
    bucket_type: BucketType,
    game_id: str,
    user: dict = Depends(require_authenticated_user)
):
    """
    Remove a game from a bucket.
    """
    try:
        service = get_bucket_service()
        await service.remove_game_from_bucket(
            user_id=user["uid"],
            bucket_type=bucket_type,
            game_id=game_id,
        )
        return {"message": "Game removed from bucket", "game_id": game_id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error removing game from bucket: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to remove game from bucket"
        )


@router.post("/move", response_model=BucketGame)
async def move_game_between_buckets(
    request: MoveGameRequest,
    user: dict = Depends(require_authenticated_user)
):
    """
    Move a game from one bucket to another.
    """
    try:
        service = get_bucket_service()
        return await service.move_game(
            user_id=user["uid"],
            from_bucket_type=request.from_bucket_type,
            to_bucket_type=request.to_bucket_type,
            game_id=request.game_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error moving game: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to move game"
        )


@router.get("/game/{game_id}/bucket")
async def get_game_bucket(
    game_id: str,
    user: dict = Depends(require_authenticated_user)
):
    """
    Find which bucket a game is in.

    Returns the bucket type or null if not in any bucket.
    """
    try:
        service = get_bucket_service()
        bucket_type = await service.get_game_bucket(
            user_id=user["uid"],
            game_id=game_id,
        )
        return {
            "game_id": game_id,
            "bucket_type": bucket_type.value if bucket_type else None,
        }
    except Exception as e:
        logger.error(f"Error finding game bucket: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to find game bucket"
        )
