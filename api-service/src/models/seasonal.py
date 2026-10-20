"""
Seasonal content models (design spec 4.1).

One validated file of seasons (dates, palette, collections of quiz parameters)
served to the mobile app. Every model forbids unknown fields, so premium-gated
filters (on_subscriptions, stop_friendliness, ...) and library_only can never be
smuggled into a collection.
"""

from datetime import date
from typing import Annotated, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from src.models.recommendation import DiscoveryMode, EnergyMood, SessionType

HEX_COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"
MIN_TIME_AVAILABLE = 15
MAX_TIME_AVAILABLE = 240
GRADIENT_STOPS = 3

HexColor = Annotated[str, Field(pattern=HEX_COLOR_PATTERN)]


class CollectionParams(BaseModel):
    """Free-tier recommendation request fields a collection may set."""

    model_config = ConfigDict(extra="forbid")

    time_available: int = Field(..., ge=MIN_TIME_AVAILABLE, le=MAX_TIME_AVAILABLE)
    energy_mood: EnergyMood
    genres: Optional[List[str]] = None
    session_type: SessionType = SessionType.ANY
    discovery_mode: DiscoveryMode = DiscoveryMode.FAMILIAR


class Collection(BaseModel):
    """A titled set of quiz parameters, optionally limited to a micro-moment window."""

    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    blurb: str
    params: CollectionParams
    starts: Optional[date] = None
    ends: Optional[date] = None


class Palette(BaseModel):
    """Seasonal color roles only (spec 6.2). The guardrail lives in palette_check."""

    model_config = ConfigDict(extra="forbid")

    bg_gradient: List[HexColor] = Field(
        ..., min_length=GRADIENT_STOPS, max_length=GRADIENT_STOPS
    )
    bg_decor: HexColor
    accent_season: HexColor
    on_accent_season: HexColor


class HeaderImage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: HttpUrl
    alt: str


class Season(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    starts: date
    ends: date
    palette: Palette
    header_image: Optional[HeaderImage] = None
    collections: List[Collection]


class SeasonalContent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1]
    seasons: List[Season]
