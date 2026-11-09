"""Backfill cover_url on catalog records from Steam, 2026-11.

Clients looked up cover art live on RAWG by title. RAWG has been unreachable
since about 2026-11-06 (api.rawg.io and rawg.io both return Cloudflare 522),
so every surface fell back to placeholder tiles. cover_url moves the cover
onto the catalog record, so the API serves it and clients stop depending on a
third party at render time.

This pass covers records with a Steam app id in store_links.steam. The image
is Steam's own header_image from the appdetails API (the legacy
/steam/apps/<id>/header.jpg path 404s for newer apps), and each URL is fetched
once to confirm it serves an image before it is kept.

    python scripts/backfill_steam_covers.py             # read-only: collect + verify
    python scripts/backfill_steam_covers.py --apply     # write cover_url

The collect pass writes scripts/cover_data/steam_covers_2026_11.json, and
--apply reads that file instead of calling Steam again. --apply only writes
the cover_url field, only on records that have none, and first records which
records it will touch in catalog_steam_covers_2026_11_backup.json (cover_url
did not exist before, so undo is deleting the field on those ids).
"""

import json
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://firestore.googleapis.com/v1/projects/playnxt-1a2c6/databases/(default)/documents/games"
SCRIPT_DIR = Path(__file__).parent
COLLECTED = SCRIPT_DIR / "cover_data" / "steam_covers_2026_11.json"
BACKUP = SCRIPT_DIR / "catalog_steam_covers_2026_11_backup.json"
APPDETAILS = "https://store.steampowered.com/api/appdetails?filters=basic&appids={}"
PACING_SECONDS = 1.6  # appdetails allows roughly 200 requests per 5 minutes
STEAM_APP = re.compile(r"store\.steampowered\.com/app/(\d+)")


def gcloud_token():
    gcloud = shutil.which("gcloud") or "gcloud"
    return subprocess.run([gcloud, "auth", "print-access-token"],
                          capture_output=True, text=True, check=True).stdout.strip()


def fetch_catalog(tok):
    """{game_id: {"title", "steam_app_id", "has_cover"}} for every record."""
    out, page = {}, None
    fields = "&".join(f"mask.fieldPaths={f}" for f in ("title", "store_links", "cover_url"))
    while True:
        url = f"{BASE}?pageSize=300&{fields}" + (f"&pageToken={page}" if page else "")
        d = json.load(urllib.request.urlopen(urllib.request.Request(
            url, headers={"Authorization": f"Bearer {tok}"})))
        for doc in d.get("documents", []):
            f = doc.get("fields", {})
            steam = (f.get("store_links", {}).get("mapValue", {}).get("fields", {})
                     .get("steam", {}).get("stringValue") or "")
            m = STEAM_APP.search(steam)
            out[doc["name"].rsplit("/", 1)[1]] = {
                "title": f.get("title", {}).get("stringValue", ""),
                "steam_app_id": m.group(1) if m else None,
                "has_cover": bool(f.get("cover_url", {}).get("stringValue")),
            }
        page = d.get("nextPageToken")
        if not page:
            return out


def steam_header(app_id):
    """(header_image URL or None, reason)."""
    for attempt in range(3):
        try:
            d = json.load(urllib.request.urlopen(APPDETAILS.format(app_id), timeout=20))
            entry = d.get(str(app_id)) or {}
            if not entry.get("success"):
                return None, "appdetails success=false (delisted or region-locked)"
            url = (entry.get("data") or {}).get("header_image")
            return (url, "ok") if url else (None, "no header_image")
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < 2:
                time.sleep(60)
                continue
            return None, f"appdetails HTTP {exc.code}"
        except Exception as exc:  # network blip: one retry, then give up on this id
            if attempt < 2:
                time.sleep(5)
                continue
            return None, f"appdetails error {type(exc).__name__}"
    return None, "appdetails rate limited"


def serves_image(url):
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=20)
        return r.status == 200 and r.headers.get("Content-Type", "").startswith("image/")
    except Exception:
        return False


def collect(catalog):
    done = json.loads(COLLECTED.read_text(encoding="utf-8")) if COLLECTED.exists() else {}
    todo = [(gid, g) for gid, g in catalog.items() if g["steam_app_id"] and gid not in done]
    print(f"{sum(1 for g in catalog.values() if g['steam_app_id'])} records with a Steam app id, "
          f"{len(todo)} still to collect")
    for i, (gid, g) in enumerate(todo, 1):
        url, reason = steam_header(g["steam_app_id"])
        if url and not serves_image(url):
            url, reason = None, "header_image did not serve an image"
        done[gid] = {"title": g["title"], "steam_app_id": g["steam_app_id"], "cover_url": url, "reason": reason}
        if i % 50 == 0 or i == len(todo):
            COLLECTED.parent.mkdir(exist_ok=True)
            COLLECTED.write_text(json.dumps(done, indent=1, ensure_ascii=False), encoding="utf-8")
            print(f"  {i}/{len(todo)}")
        time.sleep(PACING_SECONDS)
    ok = sum(1 for v in done.values() if v["cover_url"])
    print(f"collected: {ok} covers, {len(done) - ok} without (see reason in {COLLECTED.name})")


def apply(catalog, tok):
    collected = json.loads(COLLECTED.read_text(encoding="utf-8"))
    targets = {gid: v["cover_url"] for gid, v in collected.items()
               if v["cover_url"] and gid in catalog and not catalog[gid]["has_cover"]}
    BACKUP.write_text(json.dumps({
        "taken_at": datetime.now(timezone.utc).isoformat(),
        "note": "cover_url did not exist on these records before; undo = delete the field on each id",
        "ids_without_cover_url_before": sorted(targets),
    }, indent=1), encoding="utf-8")
    now = {"timestampValue": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
    for i, (gid, url) in enumerate(sorted(targets.items()), 1):
        body = json.dumps({"fields": {"cover_url": {"stringValue": url}, "updated_at": now}}).encode()
        req = urllib.request.Request(
            f"{BASE}/{urllib.parse.quote(gid, safe='')}"
            "?updateMask.fieldPaths=cover_url&updateMask.fieldPaths=updated_at"
            "&currentDocument.exists=true",
            method="PATCH", data=body,
            headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
        urllib.request.urlopen(req)
        if i % 100 == 0:
            print(f"  {i}/{len(targets)}")
    print(f"cover_url written on {len(targets)} records")


def main():
    tok = gcloud_token()
    catalog = fetch_catalog(tok)
    if "--apply" in sys.argv:
        apply(catalog, tok)
    else:
        collect(catalog)


if __name__ == "__main__":
    main()
