"""Refresh subscription_services membership from authoritative catalogs.

Sources (fetched 2026-08-24, stored in subscription_data/):
- xbox_game_pass.json   — official catalog.gamepass.com sigls (console + PC),
                          titles hydrated via displaycatalog.mp.microsoft.com
- playstation_plus.json — playstation.com/en-us/ps-plus/games/ A-Z Game Catalog
- apple_arcade.json     — Pocket Gamer maintained list (Apple publishes no API)
- netflix_games.json    — whats-on-netflix.com maintained list

Matching is exact on normalized titles after stripping storefront noise
(platform suffixes, trademark glyphs, Arcade "+" variants, "Netflix
Edition"). No fuzzy matching — a wrong subscription claim is worse than a
missing one.

REPLACEMENT semantics for the four managed services: a game's membership in
{xbox_game_pass, playstation_plus, apple_arcade, netflix_games} is recomputed
from the source lists (services churn monthly; stale tags mislead). Tags for
unmanaged services (ea_play, ubisoft_plus, nintendo_switch_online) are
preserved untouched.

Usage:
    python subscription_refresh.py          # dry run
    python subscription_refresh.py --apply

Refresh cadence: re-fetch the four lists and re-run monthly (the Game Pass
sigl ids and page URLs are in this docstring's sources).
"""

import json
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

PROJECT = "playnxt-1a2c6"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/games"
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "subscription_data"

MANAGED = ["xbox_game_pass", "playstation_plus", "apple_arcade", "netflix_games"]

# storefront noise stripped before normalizing; order matters (longest first)
SUFFIX_PATTERNS = [
    r"\s*ps4\s*&\s*ps5\s*$", r"\s*ps4™?\s*&\s*ps5®?\s*$", r"\s+for ps5®?$",
    r"\s+ps5$", r"\s+ps4$", r"\s*-\s*windows$", r"\s*\(game preview\)$",
    r"\s*\(early access\)$", r"\s*console edition(\s*-\s*standard)?$",
    r":\s*netflix edition$", r"\s+netflix edition$",
    r"\s*standard edition$", r"\s*cross-gen digital edition$",
    r"\s*\(\d{4}(\s+video game)?\)$",
]


def clean(title: str) -> str:
    t = (title or "").lower()
    # glyphs become spaces, not empty — "Borderlands®4" must match "Borderlands 4"
    t = t.replace("™", " ").replace("®", " ").replace("©", " ")
    t = t.rstrip("+").strip()
    for pat in SUFFIX_PATTERNS:
        t = re.sub(pat, "", t)
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def gcloud_token():
    gcloud = shutil.which("gcloud") or "gcloud"
    return subprocess.run([gcloud, "auth", "print-access-token"],
                          capture_output=True, text=True, check=True).stdout.strip()


def fetch_catalog(tok):
    games, page = [], None
    while True:
        url = BASE + "?pageSize=300" + (f"&pageToken={page}" if page else "")
        d = json.load(urllib.request.urlopen(urllib.request.Request(
            url, headers={"Authorization": f"Bearer {tok}"})))
        for doc in d.get("documents", []):
            f = doc.get("fields", {})
            subs = [v.get("stringValue") for v in
                    f.get("subscription_services", {}).get("arrayValue", {}).get("values", [])]
            games.append({
                "doc_id": doc["name"].rsplit("/", 1)[-1],
                "title": f.get("title", {}).get("stringValue", ""),
                "subs": [s for s in subs if s],
            })
        page = d.get("nextPageToken")
        if not page:
            return games


def main():
    apply = "--apply" in sys.argv

    service_titles = {}
    for svc in MANAGED:
        raw = json.loads((DATA_DIR / f"{svc}.json").read_text(encoding="utf-8"))
        service_titles[svc] = {clean(t) for t in raw} - {""}
        print(f"{svc}: {len(service_titles[svc])} source titles")

    tok = gcloud_token()
    games = fetch_catalog(tok)
    print(f"catalog: {len(games)} games\n")

    changes = []
    per_svc_add = {s: 0 for s in MANAGED}
    per_svc_rm = {s: 0 for s in MANAGED}
    for g in games:
        nt = clean(g["title"])
        current = set(g["subs"])
        computed = {svc for svc in MANAGED if nt in service_titles[svc]}
        new = (current - set(MANAGED)) | computed
        if new != current:
            added = sorted(new - current)
            removed = sorted(current - new)
            for s in added: per_svc_add[s] += 1
            for s in removed: per_svc_rm[s] += 1
            changes.append((g["doc_id"], g["title"], sorted(new), added, removed))

    for doc_id, title, new, added, removed in sorted(changes):
        tags = []
        if added: tags.append("+" + ",".join(added))
        if removed: tags.append("-" + ",".join(removed))
        print(f"  {doc_id[:36].ljust(36)} {' '.join(tags)}")
    print(f"\ndocs changing: {len(changes)}")
    for s in MANAGED:
        print(f"  {s}: +{per_svc_add[s]} / -{per_svc_rm[s]}")

    if not apply:
        print("\nDRY RUN — re-run with --apply to write.")
        return

    for doc_id, _, new, _, _ in changes:
        body = json.dumps({"fields": {"subscription_services": {
            "arrayValue": {"values": [{"stringValue": s} for s in new]}}}}).encode()
        q = urllib.parse.quote(doc_id, safe="")
        r = urllib.request.Request(
            f"{BASE}/{q}?updateMask.fieldPaths=subscription_services",
            method="PATCH", data=body,
            headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
        urllib.request.urlopen(r)
    print(f"patched: {len(changes)}")


if __name__ == "__main__":
    main()
