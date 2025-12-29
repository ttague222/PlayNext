"""
PlayNext Recommendation Models

Pydantic models for recommendation requests and responses.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

from .game import Platform, PlayStyle, MultiplayerMode, TimeToFun, StopFriendliness


class EnergyMood(str, Enum):
    """User's current energy/mood state."""
    WIND_DOWN = "wind_down"
    CASUAL = "casual"
    FOCUSED = "focused"
    INTENSE = "intense"


class SessionType(str, Enum):
    """Type of gaming session."""
    SOLO = "solo"
    COUCH_COOP = "couch_coop"
    ONLINE_FRIENDS = "online_friends"
    ANY = "any"


class DiscoveryMode(str, Enum):
    """Discovery preference."""
    FAMILIAR = "familiar"
    SURPRISE = "surprise"


class RecommendationRequest(BaseModel):
    """Request model for getting recommendations."""

    # Required inputs
    time_available: int = Field(
        ...,
        description="Available time in minutes",
        ge=15,
        le=240
    )
    energy_mood: EnergyMood = Field(
        ...,
        description="Current energy/mood state"
    )

    # Optional inputs - support both single values and lists for backwards compatibility
    play_style: Optional[PlayStyle] = Field(
        default=None,
        description="Preferred play style (single, deprecated - use play_styles)"
    )
    play_styles: Optional[list[PlayStyle]] = Field(
        default=None,
        description="Preferred play styles (multiple allowed)"
    )
    platform: Optional[Platform] = Field(
        default=None,
        description="Target platform (single, deprecated - use platforms)"
    )
    platforms: Optional[list[Platform]] = Field(
        default=None,
        description="Target platforms (multiple allowed)"
    )
    session_type: SessionType = Field(
        default=SessionType.SOLO,
        description="Type of gaming session"
    )
    discovery_mode: DiscoveryMode = Field(
        default=DiscoveryMode.FAMILIAR,
        description="Familiar games or surprises"
    )

    # Session tracking
    session_id: Optional[str] = Field(
        default=None,
        description="Session ID for tracking rerolls"
    )
    excluded_game_ids: list[str] = Field(
        default_factory=list,
        description="Games to exclude (already shown)"
    )


class RecommendationExplanation(BaseModel):
    """Explanation for why a game was recommended."""
    summary: str = Field(..., description="Full explanation text")
    time_fit: Optional[str] = None
    mood_fit: Optional[str] = None
    stop_fit: Optional[str] = None
    style_fit: Optional[str] = None
    session_fit: Optional[str] = None


class GameRecommendation(BaseModel):
    """A single game recommendation."""
    game_id: str
    title: str
    platforms: list[Platform]
    description_short: str
    explanation: RecommendationExplanation
    time_to_fun: TimeToFun
    stop_friendliness: StopFriendliness
    subscription_services: list[str] = Field(default_factory=list)
    fun_fact: Optional[str] = Field(default=None, description="Interesting trivia about the game")
    match_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="How well this game matches the request"
    )


class RecommendationResponse(BaseModel):
    """Response model for recommendations."""
    recommendations: list[GameRecommendation] = Field(
        ...,
        max_length=3,
        description="1-3 game recommendations"
    )
    session_id: str = Field(
        ...,
        description="Session ID for tracking"
    )
    fallback_applied: bool = Field(
        default=False,
        description="Whether fallback logic was used"
    )
    fallback_message: Optional[str] = Field(
        default=None,
        description="Explanation if fallback was applied"
    )
    generated_at: datetime = Field(default_factory=datetime.utcnow)
