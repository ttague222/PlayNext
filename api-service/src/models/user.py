"""
PlayNxt User Models

Pydantic models for user data and preference signals.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class SignalType(str, Enum):
    """Types of user signals."""
    WORKED = "worked"
    NOT_GOOD_FIT = "not_good_fit"
    PLAYED_LOVED = "played_loved"
    PLAYED_NEUTRAL = "played_neutral"
    PLAYED_DIDNT_STICK = "played_didnt_stick"
    SKIPPED = "skipped"
    ACCEPTED = "accepted"
    ALREADY_PLAYED = "already_played"  # User already played this game recently


class UserBase(BaseModel):
    """Base user model."""
    display_name: Optional[str] = None
    email: Optional[str] = None


class UserCreate(UserBase):
    """Model for creating a new user."""
    uid: str


class PremiumTier(str, Enum):
    """User premium tier."""
    FREE = "free"
    PREMIUM = "premium"


class PremiumFeatures(BaseModel):
    """Premium feature flags."""
    smart_history: bool = False
    unlimited_rerolls: bool = False
    advanced_filters: bool = False
    cross_device_sync: bool = False


class User(UserBase):
    """Complete user model."""
    uid: str
    is_anonymous: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_active: datetime = Field(default_factory=datetime.utcnow)
    total_sessions: int = 0
    total_accepts: int = 0
    total_worked_signals: int = 0

    # Premium status
    premium_tier: PremiumTier = PremiumTier.FREE
    premium_since: Optional[datetime] = None
    premium_features: PremiumFeatures = Field(default_factory=PremiumFeatures)

    # Reroll limits (for free tier)
    daily_rerolls_used: int = 0
    daily_rerolls_reset: Optional[datetime] = None

    class Config:
        from_attributes = True


class SignalContext(BaseModel):
    """Context in which a signal was recorded."""
    time_selected: Optional[int] = None
    mood_selected: Optional[str] = None
    play_style_selected: Optional[str] = None
    platform_selected: Optional[str] = None
    session_type_selected: Optional[str] = None


class UserSignalCreate(BaseModel):
    """Model for creating a user signal."""
    game_id: str
    signal_type: SignalType
    context: Optional[SignalContext] = None


class UserSignal(BaseModel):
    """Complete user signal model."""
    signal_id: str
    user_id: Optional[str] = None
    session_id: str
    game_id: str
    game_title: Optional[str] = None  # Game title for display in history
    signal_type: SignalType
    context: Optional[SignalContext] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    worked: Optional[bool] = None  # Whether the recommendation worked

    class Config:
        from_attributes = True


class SessionCreate(BaseModel):
    """Model for creating a session."""
    user_id: Optional[str] = None


class Session(BaseModel):
    """Session tracking model."""
    session_id: str
    user_id: Optional[str] = None
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = None
    games_shown: list[str] = Field(default_factory=list)
    reroll_count: int = 0
    accepted_game_id: Optional[str] = None

    class Config:
        from_attributes = True


class FeedbackRequest(BaseModel):
    """Request model for submitting feedback."""
    game_id: str
    signal_type: SignalType
    session_id: str
    context: Optional[SignalContext] = None
    game_title: Optional[str] = None  # Game title for display in history
