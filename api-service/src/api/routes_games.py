"""
PlayNext Game Routes

API endpoints for game catalog management.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..core.rate_limiter import limiter
from ..models import Game, GameCreate, GameSummary, Platform, check_store_links
from ..services import get_game_service
from .auth import require_admin

logger = logging.getLogger("playnext-api.routes.games")

router = APIRouter(prefix="/games", tags=["Games"])


@router.get("", response_model=list[GameSummary])
async def list_games(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    platform: Optional[Platform] = Query(default=None)
):
    """
    List games in the catalog.

    Returns a paginated list of games with basic information.
    Use the `platform` filter to show only games available on a specific platform.
    """
    service = get_game_service()
    return await service.list_games(limit=limit, offset=offset, platform=platform)


@router.get("/stats")
@limiter.limit("10/minute")
async def get_catalog_stats(request: Request):
    """
    Get statistics about the game catalog.

    Returns counts of games by platform, play style, and energy level.
    Rate limited because an uncached call reads the whole catalog.
    """
    service = get_game_service()
    return await service.get_catalog_stats()


@router.get("/recent", response_model=list[GameSummary])
async def list_recent_games(
    days: int = Query(default=7, ge=1, le=90),
    limit: int = Query(default=20, ge=1, le=50),
):
    """List recently-added games (for 'What's New' and the weekly digest)."""
    service = get_game_service()
    return await service.list_recent_games(days=days, limit=limit)


@router.get("/upcoming", response_model=list[GameSummary])
async def list_upcoming_games(
    limit: int = Query(default=10, ge=1, le=25),
):
    """List unreleased games, soonest first (for the Coming Soon section)."""
    service = get_game_service()
    return await service.list_upcoming_games(limit=limit)


@router.get("/{game_id}", response_model=Game)
async def get_game(game_id: str):
    """
    Get detailed information about a specific game.
    """
    service = get_game_service()
    game = await service.get_game(game_id)

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    return game


@router.post("", response_model=Game)
async def create_game(
    game: GameCreate,
    user: dict = Depends(require_admin)
):
    """
    Add a new game to the catalog.

    Admin only (`admin` custom claim).
    """
    service = get_game_service()

    # Check if game already exists
    existing = await service.get_game(game.game_id)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Game with ID '{game.game_id}' already exists"
        )

    return await service.create_game(game)


@router.put("/{game_id}", response_model=Game)
async def update_game(
    game_id: str,
    updates: dict,
    user: dict = Depends(require_admin)
):
    """
    Update an existing game.

    Admin only (`admin` custom claim).
    """
    _check_links_or_422(updates)

    service = get_game_service()
    game = await service.update_game(game_id, updates)

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    return game


@router.delete("/{game_id}")
async def delete_game(
    game_id: str,
    user: dict = Depends(require_admin)
):
    """
    Delete a game from the catalog.

    Admin only (`admin` custom claim).
    """
    service = get_game_service()
    success = await service.delete_game(game_id)

    if not success:
        raise HTTPException(status_code=404, detail="Game not found")

    return {"message": f"Game '{game_id}' deleted"}


@router.post("/seed")
async def seed_games(
    games: list[dict],
    user: dict = Depends(require_admin)
):
    """
    Bulk seed games into the catalog.

    Admin only (`admin` custom claim). Accepts a list of game objects and
    writes them to Firestore, replacing any existing record with the same ID.
    """
    for game_data in games:
        _check_links_or_422(game_data)

    service = get_game_service()
    success_count = 0
    failed = []

    for game_data in games:
        if await service.seed_game(game_data):
            success_count += 1
        else:
            failed.append(game_data.get("game_id", "unknown"))

    return {
        "message": f"Seeded {success_count} games",
        "total": len(games),
        "success": success_count,
        "failed": failed
    }


def _check_links_or_422(game_data: dict) -> None:
    """Reject a raw game payload whose store links aren't http(s) URLs."""
    if "store_links" not in game_data:
        return
    try:
        check_store_links(game_data["store_links"])
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
