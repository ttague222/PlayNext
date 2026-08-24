"""Seed the 2025-2026 recency refresh (games_data/refresh_2025_2026.json) to production.

- Enriches each game with store links from RAWG (using the candidate slug list).
- Writes both genres/genre_tags and moods/mood_tags so every filter path matches.
- Generates explanation templates via game_seed_generator defaults.
- Creates docs in Firestore via REST (PATCH creates missing docs).

Usage:
    python seed_refresh.py            # dry run: shows what would be written
    python seed_refresh.py --apply
"""

import json
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from game_seed_generator import get_default_explanation_templates

SCRIPT_DIR = Path(__file__).parent
REFRESH_FILE = SCRIPT_DIR / "games_data" / "refresh_2025_2026.json"
for _a in sys.argv[1:]:
    if _a.startswith("--file="):
        REFRESH_FILE = SCRIPT_DIR / "games_data" / Path(_a.split("=", 1)[1]).name
PROJECT = "playnxt-1a2c6"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/games"
STORE_ID_MAPPING = {1: "steam", 2: "xbox", 3: "playstation", 5: "gog", 6: "nintendo", 7: "xbox", 11: "epic"}


def gcloud_token():
    gcloud = shutil.which("gcloud") or "gcloud"
    return subprocess.run([gcloud, "auth", "print-access-token"],
                          capture_output=True, text=True, check=True).stdout.strip()


def rawg_key():
    env = (SCRIPT_DIR / ".." / ".." / "mobile-app" / ".env").resolve()
    for line in env.read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_RAWG_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("RAWG key not found in mobile-app/.env")


def norm(t):
    return re.sub(r"[^a-z0-9]+", " ", (t or "").lower()).strip()


def fetch_stores(slug, key):
    q = urllib.parse.urlencode({"key": key})
    try:
        d = json.load(urllib.request.urlopen(f"https://api.rawg.io/api/games/{slug}/stores?{q}", timeout=20))
    except Exception:
        return {}
    links = {}
    for s in d.get("results", []):
        store_key = STORE_ID_MAPPING.get(s.get("store_id"))
        if store_key and s.get("url") and store_key not in links:
            url = s["url"]
            if "gog.com" in url:
                url = re.sub(r"gog\.com/[a-z]{2}/", "gog.com/en/", url)
            links[store_key] = url
    return links


def to_fs(v):
    if isinstance(v, bool): return {"booleanValue": v}
    if isinstance(v, int): return {"integerValue": str(v)}
    if isinstance(v, float): return {"doubleValue": v}
    if isinstance(v, str): return {"stringValue": v}
    if isinstance(v, list): return {"arrayValue": {"values": [to_fs(x) for x in v]}}
    if isinstance(v, dict): return {"mapValue": {"fields": {k: to_fs(x) for k, x in v.items() if x is not None}}}
    return {"nullValue": None}


def transform(g):
    return {
        "game_id": g["id"],
        "title": g["title"],
        "platforms": g.get("platforms", []),
        "year": g.get("year"),
        "genres": g.get("genres", []),
        "genre_tags": g.get("genres", []),
        "time_tags": g.get("time_tags", []),
        "energy_level": g.get("energy", "medium"),
        "moods": g.get("moods", []),
        "mood_tags": g.get("moods", []),
        "play_style": g.get("play_style", []),
        "time_to_fun": g.get("time_to_fun", "medium"),
        "stop_friendliness": g.get("stop_friendliness", "checkpoints"),
        "multiplayer_modes": g.get("multiplayer", []),
        "description_short": g.get("description", ""),
        "subscription_services": g.get("subscriptions", []),
        "store_links": g.get("store_links", {}),
        "warnings": [],
        "explanation_templates": get_default_explanation_templates(
            g.get("energy", "medium"), g.get("play_style", [])),
    }


def main():
    apply = "--apply" in sys.argv
    games = json.loads(REFRESH_FILE.read_text(encoding="utf-8"))
    key = rawg_key()

    # slug lookup from the candidate dump if present (scratchpad optional)
    slugs = {}
    for cand_path in sys.argv[1:]:
        if cand_path.endswith("rawg_candidates.json"):
            for c in json.loads(Path(cand_path).read_text(encoding="utf-8")):
                slugs[norm(c["name"])] = c["slug"]

    enriched = 0
    for g in games:
        if g.get("store_links"):
            continue
        slug = slugs.get(norm(g["title"]))
        if not slug:
            continue
        links = fetch_stores(slug, key)
        if links:
            g["store_links"] = links
            enriched += 1
        time.sleep(0.4)
    REFRESH_FILE.write_text(json.dumps(games, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"store links enriched: {enriched}/{len(games)}")

    if not apply:
        for g in games:
            print(f"  {g['id'][:34].ljust(34)} {g['year']} {g.get('energy'):>6} links={list((g.get('store_links') or {}).keys())}")
        print("\nDRY RUN — re-run with --apply to create docs in production.")
        return

    tok = gcloud_token()
    created = updated = 0
    for g in games:
        data = transform(g)
        doc_id = urllib.parse.quote(data["game_id"], safe="")
        # Preflight: distinguish create from in-place update so id collisions
        # with pre-existing docs are visible instead of silent.
        try:
            urllib.request.urlopen(urllib.request.Request(
                f"{BASE}/{doc_id}?mask.fieldPaths=title", headers={"Authorization": f"Bearer {tok}"}))
            updated += 1
            print(f"  UPDATE (id already exists): {data['game_id']}")
        except urllib.error.HTTPError:
            created += 1
        fields = {k: to_fs(v) for k, v in data.items() if v is not None}
        mask = "&".join(f"updateMask.fieldPaths={k}" for k in fields)
        body = json.dumps({"fields": fields}).encode()
        r = urllib.request.Request(f"{BASE}/{doc_id}?{mask}", method="PATCH", data=body,
                                   headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
        urllib.request.urlopen(r)
    print(f"created: {created} | updated in place: {updated}")


if __name__ == "__main__":
    main()
