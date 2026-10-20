"""
Seasonal content models (design spec 4.1).

One validated file of seasons (dates, palette, collections of quiz parameters)
served to the mobile app. Every model forbids unknown fields, so premium-gated
filters (on_subscriptions, stop_friendliness, ...) and library_only can never be
smuggled into a collection.
"""

import re
from datetime import date, datetime
from typing import Annotated, Any, List, Literal, Optional

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, HttpUrl, model_validator

from src.models.recommendation import DiscoveryMode, EnergyMood, SessionType

HEX_COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"
MIN_TIME_AVAILABLE = 15
MAX_TIME_AVAILABLE = 240
GRADIENT_STOPS = 3

HexColor = Annotated[str, Field(pattern=HEX_COLOR_PATTERN)]

ISO_DATE_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")


def _require_iso_date(value: Any) -> Any:
    """Accept only a 'YYYY-MM-DD' string (or a real date, which the route's own
    response re-validation passes). Pydantic's lax mode would also take a
    datetime string or a Unix timestamp; the API would normalize those, but the
    app's bundled copy of the raw file would not, and the app compares dates
    as strings."""
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, str) and ISO_DATE_RE.fullmatch(value):
        return value
    raise ValueError(f"must be a YYYY-MM-DD date string, got {value!r}")


IsoDate = Annotated[date, BeforeValidator(_require_iso_date)]


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
    starts: Optional[IsoDate] = None
    ends: Optional[IsoDate] = None

    @model_validator(mode="after")
    def _window_has_both_bounds(self) -> "Collection":
        # The app treats a collection as windowed only when both bounds are set,
        # so a half window would be served here but never shown there.
        if (self.starts is None) != (self.ends is None):
            raise ValueError(
                f"collection {self.id}: set both starts and ends, or neither"
            )
        return self


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
    starts: IsoDate
    ends: IsoDate
    palette: Palette
    header_image: Optional[HeaderImage] = None
    collections: List[Collection]


class SeasonalContent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1]
    seasons: List[Season]
