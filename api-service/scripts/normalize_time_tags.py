"""Normalize dead time_tags values that no request bracket can ever match.

Valid brackets are 15/30/60/90/120 (TIME_BRACKETS in recommendation_service).
Any other value is dead weight. Rule: ceil to the nearest bracket — a session
of length v fits any bucket >= v (5, 10 -> 15; 20 -> 30; 45 -> 60).

Applies to both the local seed JSON files and production Firestore.

Usage:
    python normalize_time_tags.py            # dry run
    python normalize_time_tags.py --apply
"""

import glob
import json
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

BRACKETS = [15, 30, 60, 90, 120]
PROJECT = "playnxt-1a2c6"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/games"


def ceil_bracket(v):
    for b in BRACKETS:
        if v <= b:
            return b
    return 120


def normalize(tags):
    vals = sorted({ceil_bracket(t) for t in tags if isinstance(t, int)})
    return vals


def gcloud_token():
    gcloud = shutil.which("gcloud") or "gcloud"
    return subprocess.run([gcloud, "auth", "print-access-token"],
                          capture_output=True, text=True, check=True).stdout.strip()


def parse_val(v):
    if "integerValue" in v: return int(v["integerValue"])
    if "arrayValue" in v: return [parse_val(x) for x in v["arrayValue"].get("values", [])]
    if "stringValue" in v: return v["stringValue"]
    return None


def main():
    apply = "--apply" in sys.argv

    # 1. Seed files
    seed_changed = 0
    for f in glob.glob(str(Path(__file__).parent / "games_data" / "*.json")):
        games = json.loads(Path(f).read_text(encoding="utf-8"))
        if not isinstance(games, list):
            continue
        dirty = False
        for g in games:
            tt = g.get("time_tags") or []
            fixed = normalize(tt)
            if fixed != sorted(set(t for t in tt if isinstance(t, int))):
                g["time_tags"] = fixed
                dirty = True
                seed_changed += 1
        if dirty and apply:
            Path(f).write_text(json.dumps(games, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"seed entries needing normalization: {seed_changed}")

    # 2. Production
    tok = gcloud_token()
    games, page = [], None
    while True:
        url = BASE + "?pageSize=300&mask.fieldPaths=time_tags" + (f"&pageToken={page}" if page else "")
        r = urllib.request.Request(url, headers={"Authorization": f"Bearer {tok}"})
        d = json.load(urllib.request.urlopen(r))
        for doc in d.get("documents", []):
            tt = parse_val(doc.get("fields", {}).get("time_tags", {"arrayValue": {}})) or []
            games.append((doc["name"].rsplit("/", 1)[-1], tt))
        page = d.get("nextPageToken")
        if not page:
            break

    targets = [(gid, tt, normalize(tt)) for gid, tt in games
               if normalize(tt) != sorted(set(t for t in tt if isinstance(t, int)))]
    print(f"production docs needing normalization: {len(targets)}")
    for gid, old, new in targets[:10]:
        print(f"  {gid[:34].ljust(34)} {old} -> {new}")

    if not apply:
        print("DRY RUN — re-run with --apply to write.")
        return

    for gid, _, new in targets:
        body = {"fields": {"time_tags": {"arrayValue": {"values": [{"integerValue": str(t)} for t in new]}}}}
        r = urllib.request.Request(f"{BASE}/{gid}?updateMask.fieldPaths=time_tags", method="PATCH",
                                   data=json.dumps(body).encode(),
                                   headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
        urllib.request.urlopen(r)
    print(f"patched: {len(targets)}")


if __name__ == "__main__":
    main()
