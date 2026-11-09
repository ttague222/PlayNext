"""Monthly new-release candidate finder (spec 2026-09-22).

Finds recent (past ~45 days) and upcoming (next ~60 days) releases on Steam,
drops games already in the catalog or tombstoned, and writes a candidate JSON
for HUMAN curation. It never writes to Firestore: the GitHub Actions workflow
opens a PR, and a person fills in the curation fields before seeding.

Source: Steam's public store search, no key needed. RAWG was the source until
it went unreachable around 2026-11-05 (Cloudflare 522 on api.rawg.io and
rawg.io), which failed that month's run.

  * Recent releases come from the "popular new releases" list, kept when the
    release date falls in the window and the game has at least --min-reviews
    user reviews (the popularity floor RAWG's "added" count used to provide).
  * Upcoming releases come from the "popular upcoming" list, which Steam
    ranks by wishlists, kept when they have a full release date in the window.
    Placeholder dates ("2027", "Q1 2027", "Coming soon") are skipped.

Steam only knows the PC version, so entries list "pc" and a curator adds
console or mobile platforms. Console exclusives never appear here at all.

Usage:
    python new_release_candidates.py                  # writes games_data/candidates_<YYYY_MM>.json
    python new_release_candidates.py --min-reviews=50 # lower popularity floor
"""

import html as html_lib
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
GAMES_DATA = SCRIPT_DIR / "games_data"
TOMBSTONES_FILE = SCRIPT_DIR / "deleted_game_ids.json"
API_BASE = "https://playnxt-api-167253232570.us-central1.run.app/api"

SEARCH_URL = "https://store.steampowered.com/search/results/"
APPDETAILS_URL = "https://store.steampowered.com/api/appdetails"
RECENT_FILTER = "popularnew"          # popular new releases
UPCOMING_FILTER = "popularwishlist"   # popular upcoming, ranked by wishlists
PAGE_SIZE = 50
MAX_PAGES = 4                         # 200 games per list is plenty
APPDETAILS_PACING_SECONDS = 1.6       # appdetails allows ~200 requests / 5 min

DEFAULT_MIN_REVIEWS = 100
RECENT_DAYS = 45
UPCOMING_DAYS = 60

STEAM_DATE_FORMATS = ("%b %d, %Y", "%d %b, %Y", "%B %d, %Y", "%d %B, %Y")


def norm_title(t):
    return re.sub(r"[^a-z0-9]+", " ", (t or "").lower()).strip()


def slugify(t):
    return norm_title(t).replace(" ", "-")


def parse_steam_date(text):
    """ISO date for a full Steam release date, else None (placeholders, TBA)."""
    text = (text or "").strip()
    for fmt in STEAM_DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def parse_search_html(results_html):
    """Rows from a Steam search results_html fragment. Pure function.

    Each row: app_id, title, released (ISO or None), reviews (int, 0 when the
    game has none yet), windows (bool).
    """
    rows = []
    for chunk in re.split(r"(?=<a href=\"https://store\.steampowered\.com/app/)", results_html or "")[1:]:
        app_id = re.search(r'data-ds-appid="(\d+)"', chunk)
        title = re.search(r'<span class="title">([^<]+)</span>', chunk)
        if not app_id or not title:
            continue
        released = re.search(r'search_released[^>]*>\s*([^<]*?)\s*<', chunk)
        tooltip = re.search(r'data-tooltip-html="([^"]+)"', chunk)
        reviews = 0
        if tooltip:
            m = re.search(r"of the ([\d,]+) user reviews", html_lib.unescape(tooltip.group(1)))
            if m:
                reviews = int(m.group(1).replace(",", ""))
        rows.append({
            "app_id": app_id.group(1),
            "title": html_lib.unescape(title.group(1)).strip(),
            "released": parse_steam_date(released.group(1) if released else ""),
            "reviews": reviews,
            "windows": 'platform_img win' in chunk,
        })
    return rows


def filter_candidates(recent_rows, upcoming_rows, today, existing_ids, tombstones,
                      min_reviews, existing_titles=None):
    """Keep in-window, popular, new-to-the-catalog games. Pure function.

    Recent rows need a release date in [today - RECENT_DAYS, today] and at
    least min_reviews reviews. Upcoming rows need a release date in
    (today, today + UPCOMING_DAYS]; their popularity is the wishlist ranking
    they came from. Dedupes across both lists by Steam app id.
    """
    existing_titles = existing_titles or set()
    recent_start = (today - timedelta(days=RECENT_DAYS)).isoformat()
    upcoming_end = (today + timedelta(days=UPCOMING_DAYS)).isoformat()
    today_iso = today.isoformat()

    out, seen = [], set()
    tagged = [(r, "recent") for r in recent_rows] + [(r, "upcoming") for r in upcoming_rows]
    for row, kind in tagged:
        if row["app_id"] in seen:
            continue
        released = row.get("released")
        if not released:
            continue
        if kind == "recent":
            if not (recent_start <= released <= today_iso) or row.get("reviews", 0) < min_reviews:
                continue
        elif not (today_iso < released <= upcoming_end):
            continue
        slug = slugify(row["title"])
        if slug in existing_ids or slug in tombstones or norm_title(row["title"]) in existing_titles:
            continue
        seen.add(row["app_id"])
        out.append(row)
    return out


def to_candidate_entry(row, genres=None):
    """Steam row -> refresh-file entry skeleton, the SAME schema
    seed_refresh.transform() reads from games_data/refresh_*.json (id, year,
    genres, energy, moods, multiplayer, description, subscriptions; see
    refresh_2025_2026.json). Curation fields stay blank on purpose: the seed
    gate refuses FILL_ME entries (and entries with no known year) until a human
    fills them in."""
    released = row.get("released") or ""
    year = int(released[:4]) if len(released) >= 4 and released[:4].isdigit() else None
    return {
        "id": slugify(row["title"]),
        "title": row["title"],
        # Steam only proves the PC version; a curator adds console/mobile.
        "platforms": ["pc"] if row.get("windows") else [],
        "year": year,
        "release_date": released,
        "genres": list(genres or []),
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
        "store_links": {"steam": f"https://store.steampowered.com/app/{row['app_id']}/"},
    }


# ---------------------------------------------------------------- I/O below


def fetch_search_list(filter_name):
    """(rows, page1_ok) for one Steam search list, paged.

    page1_ok is False when the first page failed or parsed to nothing, so a
    Steam outage or a changed page layout can't pass for a quiet month.
    """
    rows, page1_ok = [], True
    for page in range(MAX_PAGES):
        q = urllib.parse.urlencode({
            "filter": filter_name, "category1": 998,  # games only, no DLC/soundtracks
            "json": 1, "infinite": 1, "start": page * PAGE_SIZE, "count": PAGE_SIZE,
            "cc": "us", "l": "english",
        })
        try:
            d = json.load(urllib.request.urlopen(f"{SEARCH_URL}?{q}", timeout=30))
            page_rows = parse_search_html(d.get("results_html", ""))
        except Exception as e:
            print(f"Steam search '{filter_name}' failed on page {page + 1}: {e}", file=sys.stderr)
            page_rows = []
        if not page_rows:
            if page == 0:
                page1_ok = False
            break
        rows.extend(page_rows)
    return rows, page1_ok


def fetch_genres(app_id):
    """Steam genre slugs for an app; [] if appdetails is unavailable."""
    q = urllib.parse.urlencode({"appids": app_id, "filters": "genres"})
    try:
        d = json.load(urllib.request.urlopen(f"{APPDETAILS_URL}?{q}", timeout=20))
        data = (d.get(str(app_id)) or {}).get("data") or {}
        return [slugify(g["description"]) for g in data.get("genres", []) if g.get("description")]
    except Exception:
        return []


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
    min_reviews = DEFAULT_MIN_REVIEWS
    for a in sys.argv[1:]:
        if a.startswith("--min-reviews="):
            min_reviews = int(a.split("=", 1)[1])

    today = date.today()
    print(f"Fetching Steam releases {today - timedelta(days=RECENT_DAYS)} .. "
          f"{today + timedelta(days=UPCOMING_DAYS)} (min_reviews={min_reviews})")

    recent, recent_ok = fetch_search_list(RECENT_FILTER)
    upcoming, upcoming_ok = fetch_search_list(UPCOMING_FILTER)
    if not (recent_ok and upcoming_ok):
        raise SystemExit(
            f"Steam search came back empty (recent_ok={recent_ok}, upcoming_ok={upcoming_ok}). "
            "Refusing to write a candidate file, since an empty file is "
            "indistinguishable from a genuinely quiet month. Check that "
            f"{SEARCH_URL} still returns results_html in the expected layout."
        )

    existing_ids, existing_titles = fetch_existing()
    tombstones = set(json.loads(TOMBSTONES_FILE.read_text())) if TOMBSTONES_FILE.exists() else set()

    candidates = filter_candidates(recent, upcoming, today, existing_ids, tombstones,
                                   min_reviews, existing_titles=existing_titles)
    entries = []
    for row in candidates:
        entries.append(to_candidate_entry(row, fetch_genres(row["app_id"])))
        time.sleep(APPDETAILS_PACING_SECONDS)

    out_file = GAMES_DATA / f"candidates_{today.strftime('%Y_%m')}.json"
    out_file.write_text(json.dumps(entries, indent=2) + "\n")
    print(f"Wrote {len(entries)} candidates to {out_file.name}")
    print("Fill in every FILL_ME / empty curation field before seeding.")


if __name__ == "__main__":
    main()
