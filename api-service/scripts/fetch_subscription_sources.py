"""Fetch the four subscription source lists into subscription_data/.

Companion to subscription_refresh.py — run this first, then the refresh.
Designed for unattended CI use (monthly GitHub Actions cron):

- xbox_game_pass: official catalog.gamepass.com sigls (console + PC),
  titles hydrated via displaycatalog.mp.microsoft.com. Deterministic API.
- playstation_plus: playstation.com A-Z Game Catalog page; titles live in
  data-dtm-label attributes on store links (module "PS Plus Games List").
- apple_arcade: Pocket Gamer's maintained list; titles are the
  <strong><a>...</a> (Developer)</strong> entries in the article body.
- netflix_games: What's on Netflix full-list page; titles are <h4> headings
  inside .game-info blocks (the removed-games section uses a different
  structure and is not captured).

Fail-safe: a source whose parse yields fewer than MIN_COUNT titles is
SKIPPED — the committed list is left untouched and the failure is printed,
so a page redesign degrades to stale-but-sane data instead of wiping tags.
Exit code is non-zero if any source was skipped, so CI can surface it.

Usage:
    python fetch_subscription_sources.py
"""

import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

DATA_DIR = Path(__file__).parent / "subscription_data"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/128.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9"}

GAMEPASS_SIGLS = {
    "console": "fdd9e2a7-0fee-49f6-ad69-4354098401ff",
    "pc": "f6f1f99f-9b49-4ccd-b3bf-4d9767a77f5e",
}

MIN_COUNT = {
    "xbox_game_pass": 400,
    "playstation_plus": 150,
    "apple_arcade": 100,
    "netflix_games": 60,
}


def get(url):
    return urllib.request.urlopen(
        urllib.request.Request(url, headers=UA), timeout=30).read().decode("utf-8", "ignore")


def fetch_gamepass():
    ids = set()
    for sigl in GAMEPASS_SIGLS.values():
        url = f"https://catalog.gamepass.com/sigls/v2?id={sigl}&language=en-us&market=US"
        ids.update(x["id"] for x in json.loads(get(url)) if "id" in x)
    titles = set()
    idlist = sorted(ids)
    for i in range(0, len(idlist), 20):
        chunk = ",".join(idlist[i:i + 20])
        url = ("https://displaycatalog.mp.microsoft.com/v7.0/products"
               f"?bigIds={chunk}&market=US&languages=en-us&MS-CV=playnxt")
        for p in json.loads(get(url)).get("Products", []):
            lp = (p.get("LocalizedProperties") or [{}])[0]
            if lp.get("ProductTitle"):
                titles.add(lp["ProductTitle"])
        time.sleep(0.2)
    return titles


def fetch_psplus():
    # Sony's own page, single authoritative source. It server-renders only
    # ~240 of the catalog (the rest hydrate client-side), so coverage is
    # partial-but-true. Third-party "all PS Plus games" lists were evaluated
    # and rejected: they include titles that left the service years ago, and
    # a false "on your subscription" claim is worse than a missing tag.
    page = get("https://www.playstation.com/en-us/ps-plus/games/")
    titles = re.findall(
        r'module-name="PS Plus Games List"[^>]*data-dtm-label="([^"]+)"', page)
    titles += re.findall(
        r'data-dtm-label="([^"]+)"[^>]*module-name="PS Plus Games List"', page)
    return {html.unescape(t).strip() for t in titles}


# known typos on source pages, corrected to real product titles
CORRECTIONS = {
    "Vampire Survivor+": "Vampire Survivors+",
}


def fetch_apple_arcade():
    page = get("https://www.pocketgamer.com/apple-arcade/list-of-every-apple-arcade-game/")
    # entries appear as <strong><a>Title</a> (Dev)</strong> or as
    # <em><strong>Title (Dev)</strong></em>, sometimes without the (Dev)
    titles = re.findall(r"<strong><a href=\"[^\"]*\">([^<]+)</a>", page)
    for t in re.findall(r"<em><strong>([^<]+?)</strong></em>", page):
        titles.append(re.sub(r"\s*\([^)]*\)\s*$", "", t))
    titles += [t.strip() for t in re.findall(r"<strong>([^<]+?)\s*<em>", page)]
    return {CORRECTIONS.get(html.unescape(t).strip(), html.unescape(t).strip())
            for t in titles}


def fetch_netflix():
    page = get("https://www.whats-on-netflix.com/news/netflix-games/"
               "full-list-mobile-cloud-games-on-netflix/")
    titles = re.findall(r"<h4>([^<]+?)\s*<div class=\"platform-icons", page)
    return {html.unescape(t).strip() for t in titles}


def main():
    fetchers = {
        "xbox_game_pass": fetch_gamepass,
        "playstation_plus": fetch_psplus,
        "apple_arcade": fetch_apple_arcade,
        "netflix_games": fetch_netflix,
    }
    failed = []
    for name, fn in fetchers.items():
        try:
            titles = {t for t in fn() if t}
        except Exception as e:
            print(f"{name}: FETCH ERROR {e} — keeping committed list")
            failed.append(name)
            continue
        if len(titles) < MIN_COUNT[name]:
            print(f"{name}: only {len(titles)} titles (< {MIN_COUNT[name]}) — "
                  f"page layout likely changed, keeping committed list")
            failed.append(name)
            continue
        (DATA_DIR / f"{name}.json").write_text(
            json.dumps(sorted(titles), ensure_ascii=False, indent=0), encoding="utf-8")
        print(f"{name}: {len(titles)} titles written")

    if failed:
        print(f"\nSOURCES SKIPPED: {', '.join(failed)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
