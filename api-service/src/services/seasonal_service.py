"""
Seasonal content loading and rule validation (design spec 4, 4.1a, 4.2).

Pydantic enforces the schema; validate_rules enforces the calendar and
content rules a schema cannot express. A bad file raises SeasonalContentError
so CI fails before it can deploy. Services raise plain exceptions; the route
layer decides how to turn them into HTTP responses.
"""

import json
import logging
from datetime import date
from functools import lru_cache
from itertools import combinations
from pathlib import Path
from typing import List, Tuple

from pydantic import ValidationError

from src.models.seasonal import Collection, SeasonalContent, Season
from src.services.palette_check import palette_violations

logger = logging.getLogger("playnext-api.seasonal_service")

DEFAULT_PATH = Path(__file__).resolve().parent.parent / "content" / "seasonal.json"

# The app shows at most this many collections at once.
MAX_VISIBLE_COLLECTIONS = 2


class SeasonalContentError(Exception):
    """The seasonal content file is unreadable, malformed or breaks a rule."""

    def __init__(self, errors: List[str]):
        self.errors = list(errors)
        super().__init__("Invalid seasonal content: " + "; ".join(self.errors))


def _window(collection: Collection, season: Season) -> Tuple[date, date]:
    """Dates a collection can be visible: its own window, else the whole season."""
    return (collection.starts or season.starts, collection.ends or season.ends)


def _is_windowed(collection: Collection) -> bool:
    return collection.starts is not None or collection.ends is not None


def _season_errors(season: Season) -> List[str]:
    errors: List[str] = []
    sid = season.id

    if season.ends < season.starts:
        errors.append(f"{sid}: season ends before it starts ({season.starts}..{season.ends})")

    for violation in palette_violations(season.palette.model_dump()):
        errors.append(f"{sid}: palette: {violation}")

    # Only collections with a sane window take part in the date-based checks,
    # so one bad window is reported once rather than as a cascade.
    usable: List[Collection] = []
    for collection in season.collections:
        start, end = _window(collection, season)
        if end < start:
            errors.append(f"{sid}: collection {collection.id} ends before it starts ({start}..{end})")
        elif start < season.starts or end > season.ends:
            errors.append(
                f"{sid}: collection {collection.id} window {start}..{end} is outside "
                f"the season {season.starts}..{season.ends}"
            )
        else:
            usable.append(collection)

    unwindowed = [c for c in season.collections if not _is_windowed(c)]
    if len(unwindowed) > MAX_VISIBLE_COLLECTIONS:
        errors.append(
            f"{sid}: more than {MAX_VISIBLE_COLLECTIONS} collections without their own "
            f"window ({len(unwindowed)})"
        )

    # Peak overlap of windowed collections occurs on some window's start date.
    windowed = [c for c in usable if _is_windowed(c)]
    for probe in sorted({_window(c, season)[0] for c in windowed}):
        active = [c.id for c in windowed if _window(c, season)[0] <= probe <= _window(c, season)[1]]
        if len(active) > MAX_VISIBLE_COLLECTIONS:
            errors.append(
                f"{sid}: more than {MAX_VISIBLE_COLLECTIONS} windowed collections active "
                f"on {probe} ({', '.join(active)})"
            )
            break

    # Collections that can be visible on the same date must not show the same games.
    for first, second in combinations(usable, 2):
        (a_start, a_end), (b_start, b_end) = _window(first, season), _window(second, season)
        concurrent = a_start <= b_end and b_start <= a_end
        if concurrent and first.params.model_dump() == second.params.model_dump():
            errors.append(
                f"{sid}: collections {first.id} and {second.id} can be visible together "
                f"but have identical params"
            )

    return errors


def validate_rules(content: SeasonalContent) -> List[str]:
    """Return every rule violation in the content (empty list = valid)."""
    errors: List[str] = []

    seen_seasons: set = set()
    seen_collections: set = set()
    for season in content.seasons:
        if season.id in seen_seasons:
            errors.append(f"duplicate season id {season.id}")
        seen_seasons.add(season.id)
        for collection in season.collections:
            if collection.id in seen_collections:
                errors.append(f"duplicate collection id {collection.id}")
            seen_collections.add(collection.id)

    for season in content.seasons:
        errors.extend(_season_errors(season))

    for first, second in combinations(content.seasons, 2):
        if first.starts <= second.ends and second.starts <= first.ends:
            errors.append(
                f"seasons {first.id} ({first.starts}..{first.ends}) and {second.id} "
                f"({second.starts}..{second.ends}) overlap"
            )

    return errors


def load_seasonal(path: Path = DEFAULT_PATH) -> SeasonalContent:
    """Read, schema-validate and rule-validate the content file."""
    try:
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise SeasonalContentError([f"cannot read {path}: {exc}"]) from exc

    try:
        content = SeasonalContent.model_validate(raw)
    except ValidationError as exc:
        raise SeasonalContentError(
            [f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in exc.errors()]
        ) from exc

    errors = validate_rules(content)
    if errors:
        raise SeasonalContentError(errors)

    logger.info("Loaded %d seasons from %s", len(content.seasons), path)
    return content


@lru_cache(maxsize=1)
def get_seasonal() -> SeasonalContent:
    """Load the shipped content once per process. Tests reset with get_seasonal.cache_clear()."""
    return load_seasonal()
