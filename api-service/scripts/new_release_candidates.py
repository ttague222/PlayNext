"""Monthly new-release candidate finder (spec 2026-09-22).

Queries RAWG for recent (past ~45 days) and upcoming (next ~60 days) releases,
drops games already in Firestore or tombstoned, and writes a candidate JSON
for HUMAN curation. It never writes to Firestore — the GitHub Actions workflow
opens a PR; a person fills in the curation fields before seeding.

Usage:
    python new_release_candidates.py                 # writes games_data/candidates_<YYYY_MM>.json
    python new_release_candidates.py --min-added=50  # lower popularity floor

Env: RAWG_API_KEY (falls back to mobile-app/.env's EXPO_PUBLIC_RAWG_API_KEY locally).
"""

import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
GAMES_DATA = SCRIPT_DIR / "games_data"
TOMBSTONES_FILE = SCRIPT_DIR / "deleted_game_ids.json"
API_BASE = "https://playnxt-api-167253232570.us-central1.run.app/api"

# RAWG platform slug -> catalog platform enum
RAWG_PLATFORM_MAP = {
    "pc": "pc", "macos": "pc", "linux": "pc",
    "playstation5": "playstation", "playstation4": "playstation",
    "xbox-series-x": "xbox", "xbox-one": "xbox",
    "nintendo-switch": "switch", "nintendo-switch-2": "switch",
    "ios": "mobile", "android": "mobile",
}

DEFAULT_MIN_ADDED = 100   # RAWG "added" count — popularity floor keeping the list reviewable
RECENT_DAYS = 45
UPCOMING_DAYS = 60


def norm_title(t):
    return re.sub(r"[^a-z0-9]+", " ", (t or "").lower()).strip()


def filter_candidates(rawg_results, existing_ids, tombstones, min_added,
                      existing_titles=None):
    """Drop known, tombstoned, duplicate, and unpopular games. Pure function."""
    existing_titles = existing_titles or set()
    out = []
    seen = set()
    for g in rawg_results:
        slug = g.get("slug")
        if not slug or slug in seen:
            continue
        seen.add(slug)
        if slug in existing_ids or slug in tombstones:
            continue
        if norm_title(g.get("name")) in existing_titles:
            continue
        if (g.get("added") or 0) < min_added:
            continue
        out.append(g)
    return out


def to_candidate_entry(g):
    """RAWG result -> refresh-file entry skeleton — the SAME schema
    seed_refresh.transform() reads from games_data/refresh_*.json (id, year,
    genres, energy, moods, multiplayer, description, subscriptions — see
    refresh_2025_2026.json), not the catalog/transform-output schema. Curation
    fields stay blank on purpose: the seed gate refuses FILL_ME entries (and
    entries with no known year) until a human fills them in."""
    released = g.get("released") or ""
    year = int(released[:4]) if len(released) >= 4 and released[:4].isdigit() else None
    platforms = []
    for p in g.get("platforms") or []:
        mapped = RAWG_PLATFORM_MAP.get((p.get("platform") or {}).get("slug"))
        if mapped and mapped not in platforms:
            platforms.append(mapped)
    return {
        "id": g["slug"],
        "title": g.get("name", ""),
        "platforms": platforms,
        "year": year,
        "release_date": released,
        "genres": [x.get("slug") for x in (g.get("genres") or []) if x.get("slug")],
        "time_tags": [],
        "energy": "FILL_ME",
        "moods": [],
        "play_style": [],
        "time_to_fun": "FILL_ME",
        "stop_friendliness": "FILL_ME",
        "multiplayer": [],
        "description": "FILL_ME",
        "fun_fact": "",
        "subscriptions": [],
        "store_links": {},
    }


# ---------------------------------------------------------------- I/O below


def rawg_key():
    key = os.environ.get("RAWG_API_KEY")
    if key:
        return key
    env = (SCRIPT_DIR / ".." / ".." / "mobile-app" / ".env").resolve()
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("EXPO_PUBLIC_RAWG_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise SystemExit("Set RAWG_API_KEY (or mobile-app/.env)")


def fetch_rawg_window(key, start, end):
    """All RAWG results released in [start, end], paged (max 5 pages).

    Returns (results, page1_ok). page1_ok is False only when the very first
    page request itself failed, so callers can tell a broken fetch (RAWG
    outage, bad key) apart from a genuinely quiet month (page 1 succeeded,
    zero results) — the two must not both look like an empty, all-clear PR.
    """
    results, page = [], 1
    page1_ok = True
    while True:
        q = urllib.parse.urlencode({
            "key": key, "dates": f"{start},{end}",
            "ordering": "-added", "page_size": 40, "page": page,
        })
        try:
            d = json.load(urllib.request.urlopen(f"https://api.rawg.io/api/games?{q}", timeout=30))
        except Exception as e:
            print(f"RAWG fetch failed on page {page}: {e}", file=sys.stderr)
            if page == 1:
                page1_ok = False
            break
        results.extend(d.get("results") or [])
        if not d.get("next") or page >= 5:   # 200 games max per window is plenty
            break
        page += 1
    return results, page1_ok


def fetch_existing():
    """All catalog game ids + normalized titles via the public API (no creds needed)."""
    ids, titles = set(), set()
    offset = 0
    while True:
        url = f"{API_BASE}/games?limit=100&offset={offset}"
        try:
            d = json.load(urllib.request.urlopen(url, timeout=30))
        except Exception as e:
            raise SystemExit(f"Could not list existing games: {e}")
        if not d:
            break
        for g in d:
            ids.add(g["game_id"])
            titles.add(norm_title(g.get("title")))
        if len(d) < 100:
            break
        offset += 100
    return ids, titles


def main():
    min_added = DEFAULT_MIN_ADDED
    for a in sys.argv[1:]:
        if a.startswith("--min-added="):
            min_added = int(a.split("=", 1)[1])

    key = rawg_key()
    today = date.today()
    start = (today - timedelta(days=RECENT_DAYS)).isoformat()
    end = (today + timedelta(days=UPCOMING_DAYS)).isoformat()
    print(f"Fetching RAWG releases {start} .. {end} (min_added={min_added})")

    raw, page1_ok = fetch_rawg_window(key, start, end)
    if not page1_ok or not raw:
        raise SystemExit(
            f"RAWG fetch for {start}..{end} came back empty (page1_ok={page1_ok}) — "
            "refusing to write a candidate file, since an empty file is "
            "indistinguishable from a genuinely quiet month. Check RAWG_API_KEY "
            "and https://rawg.io status before re-running."
        )

    existing_ids, existing_titles = fetch_existing()
    tombstones = set(json.loads(TOMBSTONES_FILE.read_text())) if TOMBSTONES_FILE.exists() else set()

    candidates = filter_candidates(raw, existing_ids, tombstones, min_added,
                                   existing_titles=existing_titles)
    entries = [to_candidate_entry(g) for g in candidates]

    out_file = GAMES_DATA / f"candidates_{today.strftime('%Y_%m')}.json"
    out_file.write_text(json.dumps(entries, indent=2) + "\n")
    print(f"Wrote {len(entries)} candidates to {out_file.name}")
    print("Fill in every FILL_ME / empty curation field before seeding.")


if __name__ == "__main__":
    main()
