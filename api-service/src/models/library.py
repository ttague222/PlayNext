"""
PlayNext Library Models

Pydantic models for synced platform libraries (Steam first).
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class SteamSyncRequest(BaseModel):
    """Request to sync a Steam library."""

    profile: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Steam profile URL, vanity name, or 64-bit SteamID"
    )


class LibraryGameEntry(BaseModel):
    """A single game in a synced library."""

    appid: int
    game_id: Optional[str] = Field(
        default=None,
        description="Matched PlayNxt catalog game ID, if any"
    )
    playtime_minutes: int = 0


class SteamSyncResult(BaseModel):
    """Result of a Steam library sync."""

    steam_id: str
    synced_at: datetime
    total_count: int = Field(..., description="Games in the Steam library")
    matched_count: int = Field(..., description="Games matched to the PlayNxt catalog")
    played_count: int = Field(
        ...,
        description="Matched games with enough playtime to be excluded from picks"
    )


class SteamLibraryStatus(BaseModel):
    """Current Steam library connection status for a user."""

    connected: bool
    steam_id: Optional[str] = None
    synced_at: Optional[datetime] = None
    total_count: int = 0
    matched_count: int = 0
    played_count: int = 0
