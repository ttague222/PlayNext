"""Dedupe the production games collection.

Finds title-duplicate groups (43 groups / 87 docs as of 2026-08-21), merges
each group's data into one canonical doc (richest, non-"-mobile" id
preferred), then deletes the duplicates.

- DRY RUN by default: prints the full plan, writes nothing.
- --apply executes: writes a JSON backup of every affected doc first, then
  PATCHes canonical docs and DELETEs duplicates.
- Dead mobile spin-offs (Apex Legends Mobile, Warzone Mobile) do not
  contribute a "mobile" platform or mobile store links to the survivor.

Usage:
    python dedupe_games.py            # show plan
    python dedupe_games.py --apply    # execute with backup

Auth: uses `gcloud auth print-access-token` (your logged-in account).
Restore: every deleted/modified doc's original is in the backup file;
re-create any doc by PATCHing its fields back.
"""

import collections
import json
import re
import shutil
import subprocess
import sys
import urllib.request

PROJECT = "playnxt-1a2c6"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/games"
DEAD_MOBILE = {"apex-legends-mobile", "cod-warzone-mobile"}
ARRAY_FIELDS = ["platforms", "time_tags", "genres", "genre_tags", "moods", "mood_tags",
                "play_style", "multiplayer_modes", "subscription_services", "warnings"]
MAP_FIELDS = ["store_links", "explanation_templates"]
BACKUP_PATH = "dedupe_backup.json"


def token():
    # shutil.which resolves the gcloud.cmd shim on Windows
    gcloud = shutil.which("gcloud") or "gcloud"
    return subprocess.run([gcloud, "auth", "print-access-token"],
                          capture_output=True, text=True, check=True).stdout.strip()


def parse_val(v):
    if "stringValue" in v: return v["stringValue"]
    if "integerValue" in v: return int(v["integerValue"])
    if "doubleValue" in v: return v["doubleValue"]
    if "booleanValue" in v: return v["booleanValue"]
    if "nullValue" in v: return None
    if "arrayValue" in v: return [parse_val(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v: return {k: parse_val(x) for k, x in v["mapValue"].get("fields", {}).items()}
    if "timestampValue" in v: return v["timestampValue"]
    return None


def to_fs(v):
    if isinstance(v, bool): return {"booleanValue": v}
    if isinstance(v, int): return {"integerValue": str(v)}
    if isinstance(v, float): return {"doubleValue": v}
    if isinstance(v, str): return {"stringValue": v}
    if isinstance(v, list): return {"arrayValue": {"values": [to_fs(x) for x in v]}}
    if isinstance(v, dict): return {"mapValue": {"fields": {k: to_fs(x) for k, x in v.items() if x is not None}}}
    return {"nullValue": None}


def call(tok, url, method="GET", body=None):
    r = urllib.request.Request(url, method=method,
                               headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
                               data=json.dumps(body).encode() if body else None)
    with urllib.request.urlopen(r) as resp:
        return json.load(resp) if method == "GET" else None


def fetch_all(tok):
    games, page = [], None
    while True:
        url = BASE + "?pageSize=300" + (f"&pageToken={page}" if page else "")
        d = call(tok, url)
        for doc in d.get("documents", []):
            g = {k: parse_val(v) for k, v in doc.get("fields", {}).items()}
            g["_doc_id"] = doc["name"].rsplit("/", 1)[-1]
            games.append(g)
        page = d.get("nextPageToken")
        if not page:
            return games


def norm_title(t):
    t = re.sub(r"\s*\(?mobile\)?$", "", (t or "").lower()).strip()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def richness(g):
    return sum(1 for v in g.values() if v not in (None, "", [], {}))


def build_plan(games):
    groups = collections.defaultdict(list)
    for g in games:
        groups[norm_title(g.get("title"))].append(g)
    plan = []
    for t, gs in sorted(groups.items()):
        if len(gs) < 2:
            continue
        gs_sorted = sorted(gs, key=lambda g: (not g["_doc_id"].endswith("-mobile"), richness(g),
                                              len(g.get("platforms") or []), -len(g["_doc_id"])), reverse=True)
        canon, rest = gs_sorted[0], gs_sorted[1:]
        merged = dict(canon)
        for d in rest:
            dead = d["_doc_id"] in DEAD_MOBILE
            for f in ARRAY_FIELDS:
                vals = [v for v in (d.get(f) or []) if not (dead and f == "platforms" and v == "mobile")]
                merged[f] = list(dict.fromkeys(list(merged.get(f) or []) + vals))
            for f in MAP_FIELDS:
                dm = {k: v for k, v in (d.get(f) or {}).items()
                      if not (dead and f == "store_links" and k in ("android", "ios"))}
                cm = dict(merged.get(f) or {})
                for k, v in dm.items():
                    cm.setdefault(k, v)
                merged[f] = cm
            for f, v in d.items():
                if f.startswith("_") or f in ARRAY_FIELDS or f in MAP_FIELDS:
                    continue
                if merged.get(f) in (None, "", [], {}) and v not in (None, "", [], {}):
                    merged[f] = v
        tt = sorted({x for x in (merged.get("time_tags") or []) if isinstance(x, int)})
        if tt:
            merged["time_tags"] = tt
        plan.append({"title": t, "canonical": canon["_doc_id"], "merged": merged,
                     "delete": [d["_doc_id"] for d in rest], "originals": gs})
    return plan


def main():
    apply = "--apply" in sys.argv
    tok = token()
    print("Fetching production catalog...")
    games = fetch_all(tok)
    print(f"  {len(games)} games")
    plan = build_plan(games)
    n_del = sum(len(p["delete"]) for p in plan)
    print(f"\nPlan: {len(plan)} duplicate groups, {n_del} docs to delete\n")
    for p in plan:
        print(f"  {p['title'][:40].ljust(40)} keep {p['canonical']}  delete {', '.join(p['delete'])}")

    if not apply:
        print("\nDRY RUN — nothing written. Re-run with --apply to execute.")
        return

    backup = [g for p in plan for g in p["originals"]]
    json.dump(backup, open(BACKUP_PATH, "w", encoding="utf-8"))
    print(f"\nBackup of {len(backup)} docs -> {BACKUP_PATH}")

    for p in plan:
        fields = {k: to_fs(v) for k, v in p["merged"].items()
                  if not k.startswith("_") and k not in ("created_at", "updated_at") and v is not None}
        mask = "&".join(f"updateMask.fieldPaths={k}" for k in fields)
        call(tok, f"{BASE}/{p['canonical']}?{mask}", "PATCH", {"fields": fields})
        for did in p["delete"]:
            call(tok, f"{BASE}/{did}", "DELETE")
        print(f"  merged {p['canonical']}, deleted {len(p['delete'])}")

    json.dump(sorted({d for p in plan for d in p["delete"]}),
              open("deleted_game_ids.json", "w"), indent=1)
    print(f"\nDone. Deleted ids -> deleted_game_ids.json (used to clean seed files)")


if __name__ == "__main__":
    main()
