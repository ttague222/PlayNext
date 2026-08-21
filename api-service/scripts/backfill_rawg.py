"""Backfill missing year and store links across the production catalog via RAWG.

Fill-only: existing values are never overwritten. A RAWG match is accepted
only when the normalized titles are near-identical (difflib >= 0.90) — a
wrong-game link is worse than no link.

Store id mapping extends the fetch_store_links_rawg.py set with mobile
stores: 4 = App Store -> ios, 8 = Google Play -> android.

Usage:
    python backfill_rawg.py            # dry run: report what would be filled
    python backfill_rawg.py --apply
"""

import difflib
import json
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

PROJECT = "playnxt-1a2c6"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/games"
STORE_ID_MAPPING = {1: "steam", 2: "xbox", 3: "playstation", 4: "ios", 5: "gog",
                    6: "nintendo", 7: "xbox", 8: "android", 11: "epic"}
SIM_THRESHOLD = 0.90


def gcloud_token():
    gcloud = shutil.which("gcloud") or "gcloud"
    return subprocess.run([gcloud, "auth", "print-access-token"],
                          capture_output=True, text=True, check=True).stdout.strip()


def rawg_key():
    env = (Path(__file__).parent / ".." / ".." / "mobile-app" / ".env").resolve()
    for line in env.read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_RAWG_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("RAWG key not found")


def parse_val(v):
    if "stringValue" in v: return v["stringValue"]
    if "integerValue" in v: return int(v["integerValue"])
    if "booleanValue" in v: return v["booleanValue"]
    if "arrayValue" in v: return [parse_val(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v: return {k: parse_val(x) for k, x in v["mapValue"].get("fields", {}).items()}
    return None


def to_fs(v):
    if isinstance(v, bool): return {"booleanValue": v}
    if isinstance(v, int): return {"integerValue": str(v)}
    if isinstance(v, str): return {"stringValue": v}
    if isinstance(v, list): return {"arrayValue": {"values": [to_fs(x) for x in v]}}
    if isinstance(v, dict): return {"mapValue": {"fields": {k: to_fs(x) for k, x in v.items()}}}
    return {"nullValue": None}


def fetch_all(tok):
    games, page = [], None
    while True:
        url = BASE + "?pageSize=300" + (f"&pageToken={page}" if page else "")
        r = urllib.request.Request(url, headers={"Authorization": f"Bearer {tok}"})
        d = json.load(urllib.request.urlopen(r))
        for doc in d.get("documents", []):
            g = {k: parse_val(v) for k, v in doc.get("fields", {}).items()}
            g["_doc_id"] = doc["name"].rsplit("/", 1)[-1]
            games.append(g)
        page = d.get("nextPageToken")
        if not page:
            return games


def norm(t):
    return re.sub(r"[^a-z0-9]+", " ", (t or "").lower()).strip()


def rawg_search(title, key):
    q = urllib.parse.urlencode({"key": key, "search": title, "page_size": 3})
    try:
        d = json.load(urllib.request.urlopen(f"https://api.rawg.io/api/games?{q}", timeout=20))
    except Exception:
        return None
    best, best_sim = None, 0.0
    for r in d.get("results", []):
        sim = difflib.SequenceMatcher(None, norm(title), norm(r.get("name"))).ratio()
        if sim > best_sim:
            best, best_sim = r, sim
    return best if best_sim >= SIM_THRESHOLD else None


def rawg_stores(slug, key):
    q = urllib.parse.urlencode({"key": key})
    try:
        d = json.load(urllib.request.urlopen(f"https://api.rawg.io/api/games/{slug}/stores?{q}", timeout=20))
    except Exception:
        return {}
    links = {}
    for s in d.get("results", []):
        sk = STORE_ID_MAPPING.get(s.get("store_id"))
        if sk and s.get("url") and sk not in links:
            url = s["url"]
            if "gog.com" in url:
                url = re.sub(r"gog\.com/[a-z]{2}/", "gog.com/en/", url)
            links[sk] = url
    return links


def main():
    apply = "--apply" in sys.argv
    tok = gcloud_token()
    key = rawg_key()
    print("Fetching production catalog...")
    games = fetch_all(tok)
    print(f"  {len(games)} games")

    targets = []
    for g in games:
        needs_year = not g.get("year")
        sl = g.get("store_links") or {}
        plats = set(g.get("platforms") or [])
        needs_links = not sl or ("mobile" in plats and not (sl.get("android") and sl.get("ios")))
        if needs_year or needs_links:
            targets.append((g, needs_year, needs_links))
    print(f"targets: {len(targets)} (year missing: {sum(1 for _, y, _ in targets if y)}, links needed: {sum(1 for _, _, l in targets if l)})")

    filled_year = filled_links = unmatched = patched = 0
    for g, needs_year, needs_links in targets:
        hit = rawg_search(g.get("title"), key)
        time.sleep(0.25)
        if not hit:
            unmatched += 1
            continue
        update = {}
        if needs_year and hit.get("released"):
            update["year"] = int(hit["released"][:4])
            filled_year += 1
        if needs_links:
            links = rawg_stores(hit["slug"], key)
            time.sleep(0.25)
            merged = dict(g.get("store_links") or {})
            added = False
            for k, v in links.items():
                if k not in merged:
                    merged[k] = v
                    added = True
            if added:
                update["store_links"] = merged
                filled_links += 1
        if not update:
            continue
        if apply:
            fields = {k: to_fs(v) for k, v in update.items()}
            mask = "&".join(f"updateMask.fieldPaths={k}" for k in fields)
            r = urllib.request.Request(f"{BASE}/{g['_doc_id']}?{mask}", method="PATCH",
                                       data=json.dumps({"fields": fields}).encode(),
                                       headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
            urllib.request.urlopen(r)
            patched += 1

    print(f"\nyear filled: {filled_year} | link sets extended: {filled_links} | no confident RAWG match: {unmatched}")
    print(f"docs patched: {patched}" if apply else "DRY RUN — re-run with --apply to write.")


if __name__ == "__main__":
    main()
