"""One-off catalog fix, 2026-11-09: Suika Game platforms and store links.

fix_steam_ids_2026_11.py removed Suika Game's Steam link as "not on Steam",
because Steam's store search for the title only returned clones. That was
wrong: Aladdin X released it on Steam (app 4572790, 2026-07-26, Windows) and
on PS5 (2026-07-27), so the record's pc and playstation platforms were right.
What was missing is mobile. It is on Apple Arcade as "Suika Game+" (App Store
id6741622025, Aladdin X, since 2025-07-03), which the record already tags as
apple_arcade, and on Google Play (com.aladdinx.suikagame, Aladdin X).

Writes: platforms gains "mobile"; store_links gains steam, ios and android;
cover_url from Steam's header_image. Other fields are untouched.

Pre-write document: catalog_fix_2026_11_09_suika_game_backup.json (same
folder). Refuses to write if the record changed since the review.

    python scripts/fix_suika_game_2026_11.py
"""

import json
import shutil
import subprocess
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = ("https://firestore.googleapis.com/v1/projects/playnxt-1a2c6/databases/(default)"
       "/documents/games/suika-game")
BACKUP = Path(__file__).parent / "catalog_fix_2026_11_09_suika_game_backup.json"

PLATFORMS = ["pc", "playstation", "switch", "mobile"]
LINKS = {
    "steam": "https://store.steampowered.com/app/4572790/",
    "ios": "https://apps.apple.com/us/app/suika-game/id6741622025",
    "android": "https://play.google.com/store/apps/details?id=com.aladdinx.suikagame",
}
COVER = ("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4572790/"
         "1fa97470e0addbc7e035d1cf87d72d26b8ff0002/header.jpg?t=1785081651")


def main():
    gcloud = shutil.which("gcloud") or "gcloud"
    token = subprocess.run(
        [gcloud, "auth", "print-access-token"], capture_output=True, text=True, check=True
    ).stdout.strip()
    headers = {"Authorization": f"Bearer {token}"}

    doc = json.load(urllib.request.urlopen(urllib.request.Request(URL, headers=headers)))
    f = doc["fields"]
    platforms = [v["stringValue"] for v in f["platforms"]["arrayValue"]["values"]]
    links = f.get("store_links", {}).get("mapValue", {}).get("fields", {})
    if (sorted(platforms) != ["pc", "playstation", "switch"]
            or any(links.get(k, {}).get("stringValue") for k in LINKS)
            or f.get("cover_url", {}).get("stringValue")):
        raise SystemExit(f"Record changed since the review (platforms={platforms}); not writing.")
    BACKUP.write_text(json.dumps({"taken_at": datetime.now(timezone.utc).isoformat(), "document": doc},
                                 indent=1, ensure_ascii=False), encoding="utf-8")

    fields = {
        "platforms": {"arrayValue": {"values": [{"stringValue": p} for p in PLATFORMS]}},
        "store_links": {"mapValue": {"fields": {k: {"stringValue": v} for k, v in LINKS.items()}}},
        "cover_url": {"stringValue": COVER},
        "updated_at": {"timestampValue": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")},
    }
    paths = ["platforms", "cover_url", "updated_at"] + [f"store_links.{k}" for k in LINKS]
    mask = "&".join("updateMask.fieldPaths=" + urllib.parse.quote(p, safe="") for p in paths)
    urllib.request.urlopen(urllib.request.Request(
        f"{URL}?{mask}", method="PATCH", data=json.dumps({"fields": fields}).encode(),
        headers={**headers, "Content-Type": "application/json"}))
    print(f"suika-game: platforms {platforms} -> {PLATFORMS}; added {sorted(LINKS)} links and cover_url")


if __name__ == "__main__":
    main()
