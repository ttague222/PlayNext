"""
PlayNxt Share Models

A share is the record behind a /s/<share-id> landing page. It stores the picks
the user actually saw -- title, match percentage and the "why this fits" line
the engine generated for their scenario -- because re-running the engine later
could return different games, and a share must never show anything but the
sharer's real picks.

Nothing the client sends decides what a share page displays:

- **Titles and cover art.** The landing page is first-party content on
  playnxt.io, so `title` is resolved from the game catalog by `game_id`, and
  cover art is looked up by the page itself rather than accepted as a URL.
- **`why` and `match_percentage`.** These come from the pick token -- the
  engine's signed record of the recommendation (see services/pick_token.py) --
  never from the request body. This replaced the `why` link filter: with no
  client-owned text field, there is nothing to filter.
- **Identity.** `sharer_id` is self-asserted for anonymous web sharers, so it
  never leaves the server: the public model exposes only `sharer_token`, an
  opaque digest that groups a sharer's shares without naming them.
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

    Carries only the game id and the engine's signed pick token. Anything a
    viewer reads -- title, why line, match -- is resolved server-side from the
    catalog and the token. Unknown extra fields (a legacy `title` or `why`)
    are ignored by the model, not read.
    """
    game_id: str = Field(..., min_length=1, max_length=200)
    pick_token: Optional[str] = Field(
        default=None,
        max_length=2048,
        description=(
            "The signed pick record issued with the recommendation. Absent "
            "for shares made outside a fresh engine run; the share then "
            "carries no why line or match percentage."
        ),
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
    sharer_token: Optional[str] = Field(
        default=None,
        description=(
            "Opaque and stable per sharer -- groups shares without naming anyone. "
            "None when no SHARE_TOKEN_SALT is configured, since a keyless digest "
            "would let anyone holding a candidate id confirm who shared."
        ),
    )
    time_available: int
    energy_mood: EnergyMood
    picks: list[SharePick]


class ShareCreateResponse(BaseModel):
    """Response for a created share. The caller builds its own share URL."""
    share_id: str
