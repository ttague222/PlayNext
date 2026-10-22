"""
PlayNxt Game Models

Pydantic models for game data and metadata.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from urllib.parse import urlparse
from pydantic import BaseModel, Field, field_validator


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
    battlenet: Optional[str] = None  # Blizzard Battle.net shop
    other: Optional[dict[str, str]] = None


def check_store_links(links: dict) -> None:
    """
    Raise ValueError unless every store link is an absolute http(s) URL.

    Store links are rendered as clickable links in the app and on playnxt.io,
    so a `javascript:` or `data:` value would run in the viewer's browser.
    Checked on writes only, so existing catalog records still load.
    """
    if not isinstance(links, dict):
        raise ValueError("store_links must be an object")

    urls = []
    for store, value in links.items():
        if value is None:
            continue
        if store == "other" and isinstance(value, dict):
            urls.extend((f"other.{k}", v) for k, v in value.items())
        else:
            urls.append((store, value))

    for store, url in urls:
        parsed = urlparse(url) if isinstance(url, str) else None
        if parsed is None or parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise ValueError(f"store_links.{store} must be an http(s) URL")


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
    release_date: Optional[str] = Field(
        default=None,
        description="ISO release date (YYYY-MM-DD). Future date = upcoming, excluded from recommendations.",
    )


class GameCreate(GameBase):
    """Model for creating a new game."""
    game_id: str
    explanation_templates: ExplanationTemplates = Field(default_factory=ExplanationTemplates)
    avg_session_length: Optional[int] = None
    subscription_services: list[str] = Field(default_factory=list)
    content_warnings: list[str] = Field(default_factory=list)
    store_links: StoreLinks = Field(default_factory=StoreLinks)

    @field_validator("store_links")
    @classmethod
    def store_links_must_be_http(cls, links: StoreLinks) -> StoreLinks:
        check_store_links(links.model_dump())
        return links


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
    release_date: Optional[str] = None
