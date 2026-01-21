"""
PlayNxt Bucket Models

Pydantic models for save buckets (game collections).
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class BucketType(str, Enum):
    """Predefined bucket types."""
    BACKLOG = "backlog"
    PLAYING = "playing"
    PLAYED = "played"
    NOT_FOR_ME = "not_for_me"


# Bucket configuration with display info
BUCKET_CONFIG = {
    BucketType.BACKLOG: {
        "name": "Backlog",
        "icon": "bookmark-outline",
        "emoji": "📌",
        "color": "#f59e0b",
        "order": 0,
    },
    BucketType.PLAYING: {
        "name": "Playing",
        "icon": "game-controller",
        "emoji": "🎮",
        "color": "#22c55e",
        "order": 1,
    },
    BucketType.PLAYED: {
        "name": "Played",
        "icon": "checkmark-circle",
        "emoji": "✅",
        "color": "#3b82f6",
        "order": 2,
    },
    BucketType.NOT_FOR_ME: {
        "name": "Not For Me",
        "icon": "close-circle-outline",
        "emoji": "❌",
        "color": "#ef4444",
        "order": 3,
    },
}


class BucketGameBase(BaseModel):
    """Base model for a game in a bucket."""
    game_id: str = Field(..., description="Game ID")
    game_title: str = Field(..., description="Game title for display")


class BucketGameCreate(BucketGameBase):
    """Model for adding a game to a bucket."""
    pass


class BucketGame(BucketGameBase):
    """Full bucket game model with metadata."""
    added_at: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = Field(default=None, description="Optional user notes")

    class Config:
        from_attributes = True


class BucketBase(BaseModel):
    """Base bucket model."""
    bucket_type: BucketType = Field(..., description="Type of bucket")


class BucketCreate(BucketBase):
    """Model for creating a bucket (auto-created, but kept for consistency)."""
    pass


class Bucket(BucketBase):
    """Full bucket model."""
    bucket_id: str = Field(..., description="Unique bucket ID")
    user_id: str = Field(..., description="Owner user ID")
    name: str = Field(..., description="Display name")
    icon: str = Field(..., description="Ionicon name")
    emoji: str = Field(..., description="Emoji for display")
    color: str = Field(..., description="Hex color")
    game_count: int = Field(default=0, description="Number of games in bucket")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class BucketWithGames(Bucket):
    """Bucket with its games included."""
    games: list[BucketGame] = Field(default_factory=list)


class BucketSummary(BaseModel):
    """Summary of a bucket for list views."""
    bucket_id: str
    bucket_type: BucketType
    name: str
    icon: str
    emoji: str
    color: str
    game_count: int

    class Config:
        from_attributes = True


class UserBucketsResponse(BaseModel):
    """Response containing all user buckets."""
    buckets: list[BucketSummary] = Field(default_factory=list)
    total_games: int = Field(default=0, description="Total games across all buckets")


class AddGameToBucketRequest(BaseModel):
    """Request to add a game to a bucket."""
    game_id: str = Field(..., description="Game ID to add")
    game_title: str = Field(..., description="Game title for display")
    notes: Optional[str] = Field(default=None, description="Optional notes")


class MoveGameRequest(BaseModel):
    """Request to move a game between buckets."""
    from_bucket_type: BucketType = Field(..., description="Source bucket")
    to_bucket_type: BucketType = Field(..., description="Destination bucket")
    game_id: str = Field(..., description="Game to move")
