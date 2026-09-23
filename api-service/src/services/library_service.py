"""
PlayNext Library Service

Syncs a user's Steam library and matches it against the game catalog.
The free tier uses the sync to stop recommending games the user has
already played; Backlog Mode (premium, future) restricts picks to it.
"""

import logging
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from ..db.firebase import get_collection, GAMES_COLLECTION, LIBRARIES_COLLECTION
from ..models import SteamSyncResult, SteamLibraryStatus
from ..core.config import settings

logger = logging.getLogger("playnext-api.library")

STEAM_API_BASE = "https://api.steampowered.com"

# A matched library game with at least this much playtime is treated as
# "played" and excluded from standard recommendations, mirroring the
# Not For Me exclusion. Below it the user barely touched the game and it
# stays eligible. recommendation_service imports this constant.
LIBRARY_PLAYED_THRESHOLD_MINUTES = 120

# Successful syncs are rate-limited per user; a failed sync (private
# profile, Steam down) writes nothing and can be retried immediately.
SYNC_COOLDOWN_MINUTES = 60

# How long the appid -> game_id catalog map is cached in-process.
APPID_MAP_TTL_SECONDS = 3600

# store_links.steam URLs look like https://store.steampowered.com/app/1145360/Hades/
STEAM_APP_URL_RE = re.compile(r"/app/(\d+)")

STEAM_ID_RE = re.compile(r"^7656\d{13}$")
PROFILE_URL_RE = re.compile(
    r"steamcommunity\.com/(profiles|id)/([^/?#]+)", re.IGNORECASE
)
VANITY_RE = re.compile(r"^[A-Za-z0-9_-]{2,32}$")


class SteamApiError(Exception):
    """Steam Web API unavailable or misconfigured."""


class SteamProfileNotFoundError(ValueError):
    """The given profile URL / vanity name doesn't resolve to a Steam account."""


class SteamPrivateProfileError(ValueError):
    """The profile's game details are private."""


class SyncCooldownError(ValueError):
    """Library was synced too recently."""


def parse_profile_input(profile: str) -> tuple[str, str]:
    """Parse user input into ("steamid" | "vanity", value).

    Accepts a full steamcommunity.com URL (/profiles/<id> or /id/<vanity>),
    a bare 64-bit SteamID, or a bare vanity name.

    Raises ValueError for input that can't be any of those.
    """
    text = profile.strip()

    match = PROFILE_URL_RE.search(text)
    if match:
        kind, value = match.group(1).lower(), match.group(2)
        if kind == "profiles":
            if not STEAM_ID_RE.match(value):
                raise ValueError("That profile URL doesn't contain a valid Steam ID")
            return "steamid", value
        return "vanity", value

    if STEAM_ID_RE.match(text):
        return "steamid", text

    if VANITY_RE.match(text):
        return "vanity", text

    raise ValueError(
        "Enter your Steam profile URL (steamcommunity.com/id/yourname) "
        "or your 64-bit Steam ID"
    )


def extract_steam_appid(game: dict) -> Optional[int]:
    """Get a game's Steam appid from its steam_appid field or steam store link."""
    appid = game.get("steam_appid")
    if isinstance(appid, int):
        return appid

    store_links = game.get("store_links") or {}
    steam_url = store_links.get("steam") if isinstance(store_links, dict) else None
    if steam_url:
        match = STEAM_APP_URL_RE.search(steam_url)
        if match:
            return int(match.group(1))
    return None


class LibraryService:
    """Service for syncing and querying user game libraries."""

    def __init__(self):
        self.games_collection = get_collection(GAMES_COLLECTION)
        self.libraries_collection = get_collection(LIBRARIES_COLLECTION)
        self._appid_map: Optional[dict[int, str]] = None
        self._appid_map_at: float = 0.0

    async def sync_steam_library(self, user_id: str, profile: str) -> SteamSyncResult:
        """Resolve the profile, fetch owned games, match against the catalog,
        and store the result. Raises the module's error types on failure."""
        if not settings.steam_web_api_key:
            raise SteamApiError("Steam sync is not configured on this server")

        self._check_cooldown(user_id)

        kind, value = parse_profile_input(profile)
        if kind == "steamid":
            steam_id = value
        else:
            steam_id = await self._resolve_vanity(value)

        owned = await self._fetch_owned_games(steam_id)

        appid_map = self._get_appid_map()
        games = []
        matched_count = 0
        played_game_ids = []
        owned_unplayed_game_ids = []
        for entry in owned:
            appid = entry.get("appid")
            if appid is None:
                continue
            playtime = int(entry.get("playtime_forever") or 0)
            game_id = appid_map.get(appid)
            games.append({
                "appid": appid,
                "game_id": game_id,
                "playtime_minutes": playtime,
            })
            if game_id:
                matched_count += 1
                if playtime >= LIBRARY_PLAYED_THRESHOLD_MINUTES:
                    played_game_ids.append(game_id)
                else:
                    owned_unplayed_game_ids.append(game_id)

        synced_at = datetime.now(timezone.utc)
        self.libraries_collection.document(user_id).set({
            "source": "steam",
            "steam_id": steam_id,
            "synced_at": synced_at,
            "games": games,
            "total_count": len(games),
            "matched_count": matched_count,
            # Derived arrays so the recommendation engine gets what it
            # needs from a single document read, no recomputation.
            "played_game_ids": played_game_ids,
            "owned_unplayed_game_ids": owned_unplayed_game_ids,
        })
        logger.info(
            f"Synced Steam library for user {user_id}: "
            f"{matched_count}/{len(games)} matched, {len(played_game_ids)} played"
        )

        return SteamSyncResult(
            steam_id=steam_id,
            synced_at=synced_at,
            total_count=len(games),
            matched_count=matched_count,
            played_count=len(played_game_ids),
        )

    async def get_status(self, user_id: str) -> SteamLibraryStatus:
        """Get the user's current library connection status."""
        doc = self.libraries_collection.document(user_id).get()
        if not doc.exists:
            return SteamLibraryStatus(connected=False)

        data = doc.to_dict()
        return SteamLibraryStatus(
            connected=True,
            steam_id=data.get("steam_id"),
            synced_at=data.get("synced_at"),
            total_count=data.get("total_count", 0),
            matched_count=data.get("matched_count", 0),
            played_count=len(data.get("played_game_ids") or []),
        )

    async def disconnect(self, user_id: str) -> bool:
        """Delete the user's synced library entirely.

        Returns True if a library existed.
        """
        doc_ref = self.libraries_collection.document(user_id)
        existed = doc_ref.get().exists
        doc_ref.delete()
        if existed:
            logger.info(f"Deleted Steam library for user {user_id}")
        return existed

    def _check_cooldown(self, user_id: str) -> None:
        """Reject a re-sync within SYNC_COOLDOWN_MINUTES of the last one."""
        try:
            doc = self.libraries_collection.document(user_id).get()
        except Exception as e:
            logger.error(f"Error checking sync cooldown: {e}")
            return
        if not doc.exists:
            return
        synced_at = doc.to_dict().get("synced_at")
        if synced_at is None:
            return
        if not isinstance(synced_at, datetime):
            if hasattr(synced_at, "timestamp"):
                synced_at = datetime.fromtimestamp(
                    synced_at.timestamp(), tz=timezone.utc
                )
            else:
                logger.warning(
                    f"Unexpected synced_at type {type(synced_at).__name__} "
                    f"for user {user_id}; skipping cooldown check"
                )
                return
        if synced_at.tzinfo is None:
            # Naive datetimes in this collection are stored as UTC
            synced_at = synced_at.replace(tzinfo=timezone.utc)
        else:
            synced_at = synced_at.astimezone(timezone.utc)
        if datetime.now(timezone.utc) - synced_at < timedelta(
            minutes=SYNC_COOLDOWN_MINUTES
        ):
            raise SyncCooldownError(
                "Library was synced recently — try again in a bit"
            )

    async def _resolve_vanity(self, vanity: str) -> str:
        """Resolve a vanity name to a 64-bit SteamID via the Steam Web API."""
        data = await self._steam_get(
            "/ISteamUser/ResolveVanityURL/v1/",
            {"vanityurl": vanity},
        )
        response = data.get("response") or {}
        if response.get("success") == 1 and response.get("steamid"):
            return response["steamid"]
        raise SteamProfileNotFoundError(
            f'No Steam profile found for "{vanity}" — check the spelling '
            "or paste your full profile URL"
        )

    async def _fetch_owned_games(self, steam_id: str) -> list[dict]:
        """Fetch owned games. An empty response means the profile (or its
        game details) is private — Steam returns {} rather than an error."""
        data = await self._steam_get(
            "/IPlayerService/GetOwnedGames/v1/",
            {
                "steamid": steam_id,
                "include_played_free_games": 1,
                "include_appinfo": 0,
            },
        )
        response = data.get("response") or {}
        if "game_count" not in response:
            raise SteamPrivateProfileError(
                "This Steam profile is private. In Steam, set Privacy Settings "
                '→ "Game details" to Public, then try again'
            )
        return response.get("games") or []

    async def _steam_get(self, path: str, params: dict) -> dict:
        """GET a Steam Web API endpoint with the server-side key attached."""
        url = f"{STEAM_API_BASE}{path}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    url,
                    params={"key": settings.steam_web_api_key, **params},
                )
        except httpx.HTTPError as e:
            logger.error(f"Steam API request failed: {e}")
            raise SteamApiError("Steam is unreachable right now")
        if resp.status_code != 200:
            logger.error(f"Steam API returned {resp.status_code} for {path}")
            raise SteamApiError("Steam is unavailable right now")
        try:
            return resp.json()
        except ValueError:
            logger.error(f"Steam API returned non-JSON for {path}")
            raise SteamApiError("Steam returned an unexpected response")

    def _get_appid_map(self) -> dict[int, str]:
        """Map of Steam appid -> catalog game_id, cached in-process.

        Built by parsing each game's steam store link (or a steam_appid
        field when present), so no catalog backfill is required.
        """
        now = time.monotonic()
        if self._appid_map is not None and now - self._appid_map_at < APPID_MAP_TTL_SECONDS:
            return self._appid_map

        mapping: dict[int, str] = {}
        try:
            for doc in self.games_collection.stream():
                game = doc.to_dict() | {"game_id": doc.id}
                appid = extract_steam_appid(game)
                if appid is not None:
                    mapping[appid] = game["game_id"]
        except Exception as e:
            logger.error(f"Error building appid map: {e}")
            if self._appid_map is not None:
                logger.warning("Serving stale appid map after fetch failure")
                return self._appid_map
            return {}

        self._appid_map = mapping
        self._appid_map_at = now
        logger.info(f"Built Steam appid map: {len(mapping)} catalog games have appids")
        return mapping


# Singleton instance
_library_service: Optional[LibraryService] = None


def get_library_service() -> LibraryService:
    """Get the library service instance."""
    global _library_service
    if _library_service is None:
        _library_service = LibraryService()
    return _library_service
