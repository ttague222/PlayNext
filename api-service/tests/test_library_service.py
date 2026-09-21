"""
Tests for the library service (Steam sync).

Steam Web API calls are mocked; Firestore is mocked per the repo pattern.
"""
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.library_service import (
    LibraryService,
    SteamApiError,
    SteamPrivateProfileError,
    SteamProfileNotFoundError,
    SyncCooldownError,
    LIBRARY_PLAYED_THRESHOLD_MINUTES,
    extract_steam_appid,
    parse_profile_input,
)


# ---------------------------------------------------------------------------
# parse_profile_input
# ---------------------------------------------------------------------------

class TestParseProfileInput:
    def test_full_profiles_url(self):
        kind, value = parse_profile_input(
            "https://steamcommunity.com/profiles/76561198000000001"
        )
        assert (kind, value) == ("steamid", "76561198000000001")

    def test_full_vanity_url(self):
        kind, value = parse_profile_input("https://steamcommunity.com/id/gaben/")
        assert (kind, value) == ("vanity", "gaben")

    def test_vanity_url_without_scheme(self):
        kind, value = parse_profile_input("steamcommunity.com/id/some_name")
        assert (kind, value) == ("vanity", "some_name")

    def test_bare_steamid(self):
        kind, value = parse_profile_input("76561198000000001")
        assert (kind, value) == ("steamid", "76561198000000001")

    def test_bare_vanity(self):
        kind, value = parse_profile_input("gaben")
        assert (kind, value) == ("vanity", "gaben")

    def test_whitespace_stripped(self):
        kind, value = parse_profile_input("  gaben  ")
        assert (kind, value) == ("vanity", "gaben")

    def test_profiles_url_with_bad_id_rejected(self):
        with pytest.raises(ValueError):
            parse_profile_input("https://steamcommunity.com/profiles/12345")

    def test_garbage_rejected(self):
        with pytest.raises(ValueError):
            parse_profile_input("not a profile!!!")

    def test_empty_rejected(self):
        with pytest.raises(ValueError):
            parse_profile_input("   ")


# ---------------------------------------------------------------------------
# extract_steam_appid
# ---------------------------------------------------------------------------

class TestExtractSteamAppid:
    def test_from_steam_appid_field(self):
        assert extract_steam_appid({"steam_appid": 1145360}) == 1145360

    def test_from_store_link(self):
        game = {"store_links": {"steam": "https://store.steampowered.com/app/1145360/Hades/"}}
        assert extract_steam_appid(game) == 1145360

    def test_field_wins_over_link(self):
        game = {
            "steam_appid": 999,
            "store_links": {"steam": "https://store.steampowered.com/app/111/X/"},
        }
        assert extract_steam_appid(game) == 999

    def test_no_steam_data(self):
        assert extract_steam_appid({"store_links": {"xbox": "https://xbox.com/x"}}) is None
        assert extract_steam_appid({}) is None

    def test_malformed_link(self):
        assert extract_steam_appid({"store_links": {"steam": "https://store.steampowered.com/"}}) is None


# ---------------------------------------------------------------------------
# LibraryService
# ---------------------------------------------------------------------------

def _make_service(games=None, library_doc=None):
    """Build a LibraryService with mocked Firestore collections."""
    games = games or []
    games_collection = MagicMock()
    docs = []
    for g in games:
        d = MagicMock()
        d.id = g["game_id"]
        d.to_dict.return_value = dict(g)
        docs.append(d)
    games_collection.stream.return_value = docs

    libraries_collection = MagicMock()
    lib_doc = MagicMock()
    if library_doc is None:
        lib_doc.exists = False
    else:
        lib_doc.exists = True
        lib_doc.to_dict.return_value = library_doc
    libraries_collection.document.return_value.get.return_value = lib_doc

    def fake_get_collection(name):
        return games_collection if name == "games" else libraries_collection

    with patch("src.services.library_service.get_collection", side_effect=fake_get_collection):
        service = LibraryService()
    return service, libraries_collection


SAMPLE_GAMES = [
    {"game_id": "hades", "store_links": {"steam": "https://store.steampowered.com/app/1145360/Hades/"}},
    {"game_id": "celeste", "steam_appid": 504230},
    {"game_id": "no-steam", "store_links": {"xbox": "https://xbox.com/x"}},
]


@pytest.fixture
def steam_key():
    with patch("src.services.library_service.settings") as mock_settings:
        mock_settings.steam_web_api_key = "test-key"
        yield mock_settings


class TestSyncSteamLibrary:
    @pytest.mark.asyncio
    async def test_sync_matches_and_splits_played_unplayed(self, steam_key):
        service, libraries_collection = _make_service(games=SAMPLE_GAMES)
        owned = [
            {"appid": 1145360, "playtime_forever": LIBRARY_PLAYED_THRESHOLD_MINUTES},
            {"appid": 504230, "playtime_forever": 0},
            {"appid": 999999, "playtime_forever": 5000},  # not in catalog
        ]
        service._fetch_owned_games = AsyncMock(return_value=owned)

        result = await service.sync_steam_library("user-1", "76561198000000001")

        assert result.steam_id == "76561198000000001"
        assert result.total_count == 3
        assert result.matched_count == 2
        assert result.played_count == 1

        written = libraries_collection.document.return_value.set.call_args[0][0]
        assert written["played_game_ids"] == ["hades"]
        assert written["owned_unplayed_game_ids"] == ["celeste"]
        assert written["source"] == "steam"

    @pytest.mark.asyncio
    async def test_sync_resolves_vanity(self, steam_key):
        service, _ = _make_service(games=SAMPLE_GAMES)
        service._resolve_vanity = AsyncMock(return_value="76561198000000002")
        service._fetch_owned_games = AsyncMock(return_value=[])

        result = await service.sync_steam_library("user-1", "gaben")

        service._resolve_vanity.assert_awaited_once_with("gaben")
        assert result.steam_id == "76561198000000002"
        assert result.total_count == 0

    @pytest.mark.asyncio
    async def test_sync_without_api_key_fails(self):
        service, _ = _make_service()
        with patch("src.services.library_service.settings") as mock_settings:
            mock_settings.steam_web_api_key = None
            with pytest.raises(SteamApiError):
                await service.sync_steam_library("user-1", "gaben")

    @pytest.mark.asyncio
    async def test_recent_sync_hits_cooldown(self, steam_key):
        service, _ = _make_service(
            library_doc={"synced_at": datetime.utcnow() - timedelta(minutes=5)}
        )
        with pytest.raises(SyncCooldownError):
            await service.sync_steam_library("user-1", "76561198000000001")

    @pytest.mark.asyncio
    async def test_old_sync_passes_cooldown(self, steam_key):
        service, _ = _make_service(
            games=SAMPLE_GAMES,
            library_doc={"synced_at": datetime.utcnow() - timedelta(hours=2)},
        )
        service._fetch_owned_games = AsyncMock(return_value=[])
        result = await service.sync_steam_library("user-1", "76561198000000001")
        assert result.total_count == 0

    @pytest.mark.asyncio
    async def test_private_profile_raises(self, steam_key):
        service, _ = _make_service(games=SAMPLE_GAMES)
        # Steam signals a private profile by omitting game_count entirely
        service._steam_get = AsyncMock(return_value={"response": {}})
        with pytest.raises(SteamPrivateProfileError):
            await service.sync_steam_library("user-1", "76561198000000001")

    @pytest.mark.asyncio
    async def test_unknown_vanity_raises(self, steam_key):
        service, _ = _make_service(games=SAMPLE_GAMES)
        service._steam_get = AsyncMock(return_value={"response": {"success": 42}})
        with pytest.raises(SteamProfileNotFoundError):
            await service.sync_steam_library("user-1", "nobody")


class TestStatusAndDisconnect:
    @pytest.mark.asyncio
    async def test_status_not_connected(self):
        service, _ = _make_service()
        status = await service.get_status("user-1")
        assert status.connected is False
        assert status.steam_id is None

    @pytest.mark.asyncio
    async def test_status_connected(self):
        service, _ = _make_service(library_doc={
            "steam_id": "76561198000000001",
            "synced_at": datetime.utcnow(),
            "total_count": 10,
            "matched_count": 4,
            "played_game_ids": ["a", "b"],
        })
        status = await service.get_status("user-1")
        assert status.connected is True
        assert status.total_count == 10
        assert status.matched_count == 4
        assert status.played_count == 2

    @pytest.mark.asyncio
    async def test_disconnect_deletes_doc(self):
        service, libraries_collection = _make_service(library_doc={"steam_id": "x"})
        existed = await service.disconnect("user-1")
        assert existed is True
        libraries_collection.document.return_value.delete.assert_called_once()
