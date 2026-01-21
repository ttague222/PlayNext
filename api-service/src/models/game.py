"""
PlayNxt Game Models

Pydantic models for game data and metadata.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class EnergyLevel(str, Enum):
    """Energy level required for a game."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class TimeToFun(str, Enum):
    """How quickly the game becomes enjoyable."""
    SHORT = "short"
    MEDIUM = "medium"
    LONG = "long"


class StopFriendliness(str, Enum):
    """How easy it is to stop playing."""
    ANYTIME = "anytime"
    CHECKPOINTS = "checkpoints"
    COMMITMENT = "commitment"


class Platform(str, Enum):
    """Supported gaming platforms."""
    PC = "pc"
    PLAYSTATION = "playstation"
    XBOX = "xbox"
    SWITCH = "switch"
    MOBILE = "mobile"
    # Legacy value - kept for backwards compatibility during migration
    CONSOLE = "console"
    HANDHELD = "handheld"


class PlayStyle(str, Enum):
    """Game play styles."""
    NARRATIVE = "narrative"
    ACTION = "action"
    PUZZLE = "puzzle"  # True puzzle games (Portal, Tetris, Baba Is You)
    STRATEGY = "strategy"  # RTS, 4X, grand strategy (Age of Empires, Civilization, Stellaris)
    TACTICS = "tactics"  # Turn-based tactics (Fire Emblem, XCOM, Into the Breach)
    CARD_GAME = "card_game"  # Card/deck games (Hearthstone, Slay the Spire, Marvel Snap)
    SANDBOX_CREATIVE = "sandbox_creative"
    # Deprecated - keeping for backwards compatibility during migration
    PUZZLE_STRATEGY = "puzzle_strategy"


class MultiplayerMode(str, Enum):
    """Multiplayer modes supported."""
    SOLO = "solo"
    LOCAL_COOP = "local_coop"
    ONLINE_COOP = "online_coop"
    COMPETITIVE = "competitive"


class ExplanationTemplates(BaseModel):
    """Templates for generating recommendation explanations."""
    time_fit: Optional[str] = None
    mood_fit: Optional[str] = None
    stop_fit: Optional[str] = None
    style_fit: Optional[str] = None
    session_fit: Optional[str] = None


class StoreLinks(BaseModel):
    """Store/platform links for affiliate revenue (Phase 3)."""
    steam: Optional[str] = None
    xbox: Optional[str] = None
    playstation: Optional[str] = None
    nintendo: Optional[str] = None
    epic: Optional[str] = None
    gog: Optional[str] = None
    ios: Optional[str] = None  # Apple App Store
    android: Optional[str] = None  # Google Play Store
    other: Optional[dict[str, str]] = None


class GameBase(BaseModel):
    """Base game model with common fields."""
    title: str
    platforms: list[Platform]
    release_year: int
    genre_tags: list[str] = Field(default_factory=list)
    time_tags: list[int] = Field(default_factory=list, description="Compatible session lengths in minutes")
    energy_level: EnergyLevel
    mood_tags: list[str] = Field(default_factory=list)
    play_style: list[PlayStyle] = Field(default_factory=list)
    time_to_fun: TimeToFun
    stop_friendliness: StopFriendliness
    multiplayer_modes: list[MultiplayerMode] = Field(default_factory=list)
    description_short: str
    fun_fact: Optional[str] = Field(default=None, description="Interesting trivia about the game")


class GameCreate(GameBase):
    """Model for creating a new game."""
    game_id: str
    explanation_templates: ExplanationTemplates = Field(default_factory=ExplanationTemplates)
    avg_session_length: Optional[int] = None
    subscription_services: list[str] = Field(default_factory=list)
    content_warnings: list[str] = Field(default_factory=list)
    store_links: StoreLinks = Field(default_factory=StoreLinks)


class Game(GameBase):
    """Complete game model with all fields."""
    game_id: str
    explanation_templates: ExplanationTemplates = Field(default_factory=ExplanationTemplates)
    avg_session_length: Optional[int] = None
    subscription_services: list[str] = Field(default_factory=list)
    content_warnings: list[str] = Field(default_factory=list)
    store_links: StoreLinks = Field(default_factory=StoreLinks)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class GameSummary(BaseModel):
    """Lightweight game model for lists."""
    game_id: str
    title: str
    platforms: list[Platform]
    description_short: str
    time_to_fun: TimeToFun
    stop_friendliness: StopFriendliness
