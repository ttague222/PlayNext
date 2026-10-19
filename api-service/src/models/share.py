"""
PlayNxt Share Models

A share is the record behind a /s/<share-id> landing page. It stores the picks
the user actually saw -- title, match percentage and the "why this fits" line
the engine generated for their scenario -- because re-running the engine later
could return different games, and a share must never show anything but the
sharer's real picks.

Two things the client sends are not trusted:

- **Titles and cover art.** The landing page is first-party content on
  playnxt.io, so `title` is resolved from the game catalog by `game_id`, and
  cover art is looked up by the page itself rather than accepted as a URL.
  A caller cannot put arbitrary text or a third-party image in front of a
  viewer.
- **Identity.** `sharer_id` is self-asserted for anonymous web sharers, so it
  never leaves the server: the public model exposes only `sharer_token`, an
  opaque digest that groups a sharer's shares without naming them.

`why` stays as the client sent it -- the engine generates it per request and
it exists nowhere else -- so it is length-capped here and HTML-escaped by the
page that renders it.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from .recommendation import EnergyMood


class ShareSurface(str, Enum):
    """Where the share was created."""
    WEB = "web"
    APP = "app"


class SharePickCreate(BaseModel):
    """One pick as the client reports it.

    `title` is accepted but ignored -- the catalog is the source of truth.
    It stays in the schema so a caller sending it isn't rejected.
    """
    game_id: str = Field(..., min_length=1, max_length=200)
    title: Optional[str] = Field(default=None, max_length=200)
    match_percentage: Optional[int] = Field(
        default=None,
        ge=0,
        le=100,
        description="Match percentage as shown to the sharer",
    )
    why: Optional[str] = Field(
        default=None,
        max_length=300,
        description="The 'why this fits' line the sharer saw",
    )


class SharePick(BaseModel):
    """One pick as stored and served, with its title resolved from the catalog."""
    game_id: str
    title: str
    match_percentage: Optional[int] = Field(default=None, ge=0, le=100)
    why: Optional[str] = Field(default=None, max_length=300)


class ShareCreate(BaseModel):
    """Request body for creating a share."""
    surface: ShareSurface
    sharer_id: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description=(
            "Anonymous sharer identity (web local id). Self-asserted, so it is "
            "never served publicly, and a verified uid takes precedence."
        ),
    )
    time_available: int = Field(..., ge=1, le=600)
    energy_mood: EnergyMood
    picks: list[SharePickCreate] = Field(
        ...,
        min_length=1,
        max_length=3,
        description="The picks shown, at most 3 (PRD 3.2)",
    )


class Share(BaseModel):
    """A stored share. Server-side only -- it carries the raw sharer id."""
    share_id: str
    created_at: datetime
    surface: ShareSurface
    sharer_id: str
    time_available: int
    energy_mood: EnergyMood
    picks: list[SharePick]


class SharePublic(BaseModel):
    """What a share link serves. Deliberately omits `sharer_id`."""
    share_id: str
    created_at: datetime
    surface: ShareSurface
    sharer_token: str = Field(
        ...,
        description="Opaque and stable per sharer -- groups shares without naming anyone",
    )
    time_available: int
    energy_mood: EnergyMood
    picks: list[SharePick]


class ShareCreateResponse(BaseModel):
    """Response for a created share. The caller builds its own share URL."""
    share_id: str
