"""One-off catalog fix, 2026-11-09: wrong Steam app ids on 15 records.

backfill_steam_covers.py could not get a cover for 15 records because their
store_links.steam pointed at app ids Steam does not serve. 13 had the wrong id
for a game that is on Steam: each is replaced with the id Steam's store search
returns for the title, checked against appdetails (type "game", same name)
before this was written, and cover_url is set from that app's header_image.
League of Legends (Riot client only) and Suika Game (no official Steam release;
the Steam matches are clones) are not on Steam, so their Steam link is removed.

Pre-write documents: catalog_fix_2026_11_09_steam_ids_backup.json (same
folder), written before any change. Refuses to write if any record's Steam link
changed since the 2026-11-09 review, or if any record already has a cover_url.

    python scripts/fix_steam_ids_2026_11.py
"""

import json
import shutil
import subprocess
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://firestore.googleapis.com/v1/projects/playnxt-1a2c6/databases/(default)/documents/games"
BACKUP = Path(__file__).parent / "catalog_fix_2026_11_09_steam_ids_backup.json"

# id: (Steam link as reviewed, correct app id or None when not on Steam,
#      header_image exactly as appdetails returned it on 2026-11-09)
FIXES = {
    "1000xresist": ("https://store.steampowered.com/app/1389100/1000xRESIST/", 1675830, "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1675830/header.jpg?t=1782502154"),
    "caravan-sandwitch": ("https://store.steampowered.com/app/2264260/Caravan_SandWitch/", 1582650, "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1582650/header.jpg?t=1757404894"),
    "citizen-sleeper-2": ("https://store.steampowered.com/app/2212070/Citizen_Sleeper_2_Starward_Vector/", 2442460, "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2442460/header.jpg?t=1789539760"),
    "clair-obscur-expedition-33": ("https://store.steampowered.com/app/2500870/Clair_Obscur_Expedition_33/", 1903340, "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1903340/be3305b02d4db0dffa3458537118423bf2792d7e/header.jpg?t=1793903997"),
    "elden-ring-nightreign": ("https://store.steampowered.com/app/2953010/ELDEN_RING_NIGHTREIGN/", 2622380, "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2622380/header.jpg?t=1791488960"),
    "final-fantasy-16": ("https://store.steampowered.com/app/1850690/FINAL_FANTASY_XVI/", 2515020, "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2515020/header.jpg?t=1773294537"),
    "garden-witch-life": ("https://store.steampowered.com/app/1525310/Garden_Witch_Life/", 1240450, "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1240450/header.jpg?t=1751536853"),
    "gimmick-2": ("https://store.steampowered.com/app/2483510/Gimmick_2/", 2994880, "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2994880/header.jpg?t=1770800539"),
    "madden-25": ("https://store.steampowered.com/app/2417330/Madden_NFL_25/", 2582560, "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2582560/header.jpg?t=1779987586"),
    "max-payne": ("http://store.steampowered.com/app/202570/", 12140, "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/12140/header.jpg?t=1737136163"),
    "tiny-bookshop": ("https://store.steampowered.com/app/2576010/Tiny_Bookshop/", 2133760, "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2133760/519031e524f64d61ea58b75df39dccfe31b68834/header.jpg?t=1793427140"),
    "wanderstop": ("https://store.steampowered.com/app/2667280/Wanderstop/", 1299460, "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1299460/header.jpg?t=1786044059"),
    "world-of-goo-2": ("https://store.steampowered.com/app/2683940/World_of_Goo_2/", 3385670, "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3385670/90f1bf9d70091002f41bca4c47deae2fb3bf045a/header.jpg?t=1746607469"),
    "league-of-legends": ("https://store.steampowered.com/app/20590", None, None),
    "suika-game": ("https://store.steampowered.com/app/2537240/Suika_Game/", None, None),
}


def main():
    gcloud = shutil.which("gcloud") or "gcloud"
    token = subprocess.run(
        [gcloud, "auth", "print-access-token"], capture_output=True, text=True, check=True
    ).stdout.strip()
    headers = {"Authorization": f"Bearer {token}"}

    docs = {}
    for doc_id, (old_link, _, _) in FIXES.items():
        doc = json.load(urllib.request.urlopen(urllib.request.Request(f"{BASE}/{doc_id}", headers=headers)))
        f = doc["fields"]
        steam = f.get("store_links", {}).get("mapValue", {}).get("fields", {}).get("steam", {}).get("stringValue")
        if steam != old_link or f.get("cover_url", {}).get("stringValue"):
            raise SystemExit(f"{doc_id} changed since the review (steam={steam}); not writing.")
        docs[doc_id] = doc
    BACKUP.write_text(json.dumps({"taken_at": datetime.now(timezone.utc).isoformat(), "documents": docs},
                                 indent=1, ensure_ascii=False), encoding="utf-8")

    now = {"timestampValue": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
    for doc_id, (old_link, app_id, cover) in FIXES.items():
        if app_id:
            fields = {
                "store_links": {"mapValue": {"fields": {"steam": {"stringValue": f"https://store.steampowered.com/app/{app_id}/"}}}},
                "cover_url": {"stringValue": cover},
                "updated_at": now,
            }
            paths = ["store_links.steam", "cover_url", "updated_at"]
        else:
            # A masked path with no value in the body deletes that map key.
            fields = {"updated_at": now}
            paths = ["store_links.steam", "updated_at"]
        mask = "&".join("updateMask.fieldPaths=" + urllib.parse.quote(p, safe="") for p in paths)
        urllib.request.urlopen(urllib.request.Request(
            f"{BASE}/{doc_id}?{mask}", method="PATCH", data=json.dumps({"fields": fields}).encode(),
            headers={**headers, "Content-Type": "application/json"}))
        print(f"  {doc_id}: {old_link} -> {f'app {app_id}' if app_id else 'removed (not on Steam)'}")


if __name__ == "__main__":
    main()
