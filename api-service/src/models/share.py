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

import re
import unicodedata
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from .recommendation import EnergyMood

# Characters a reader sees as a dot. NFKC folds the fullwidth stop to "."
# but NOT the two CJK ones, so they are translated explicitly -- otherwise
# "evil。example" reads as a domain and walks straight past an ASCII `\.`.
_DOT_LOOKALIKES = {
    "．": ".",  # FULLWIDTH FULL STOP
    "。": ".",  # IDEOGRAPHIC FULL STOP
    "｡": ".",  # HALFWIDTH IDEOGRAPHIC FULL STOP
    "․": ".",  # ONE DOT LEADER
    "﹒": ".",  # SMALL FULL STOP
}
_DOT_TRANSLATION = str.maketrans(_DOT_LOOKALIKES)


def _fold_for_matching(value: str) -> str:
    """Normalise away the ways a domain can be spelled to dodge a filter.

    Used only for the check; the stored text is whatever the engine wrote.
    """
    return unicodedata.normalize("NFKC", value).translate(_DOT_TRANSLATION)


# `why` is the one field a caller still controls, so it must not be able to
# carry a destination onto a playnxt.io page. The engine's own output is plain
# prose and never contains a link, so rejecting one costs nothing real.
# Short TLD-like fragments ("e.g.", "i.e.") are left alone by the 2+ char TLD,
# and letters are matched Unicode-aware so "café" and "Pokémon" are fine.
_LINK_PATTERNS = (
    re.compile(r"://"),
    re.compile(r"\bwww\.", re.IGNORECASE),
    re.compile(r"\bmailto:", re.IGNORECASE),
    # label.tld, whatever the TLD. Engine prose never puts a letter straight
    # after a full stop, so real "why" lines don't trip this.
    re.compile(r"\w[\w-]*\.[^\W\d_]{2,24}\b"),
    # Bare IPv4, which the letters-only TLD above deliberately misses.
    re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}\b"),
)


def _reject_links(value: Optional[str]) -> Optional[str]:
    if value and any(p.search(_fold_for_matching(value)) for p in _LINK_PATTERNS):
        raise ValueError("why must not contain a link or domain")
    return value


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

    @field_validator("why")
    @classmethod
    def why_has_no_link(cls, value: Optional[str]) -> Optional[str]:
        return _reject_links(value)


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
