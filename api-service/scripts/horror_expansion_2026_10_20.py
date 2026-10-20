"""Horror expansion, 2026-10-20: widen the pool behind the Horror chip.

Two parts:

1. RETAG: existing horror games tagged only "survival-horror",
   "psychological-horror" or "gothic-horror" (or not at all), so the Horror
   chip, which matches the exact "horror" genre tag, never returned them.
   Adds "horror" to genre_tags and its genres mirror. Nothing else changes.
2. NEW: creates the curated records in games_data/horror_expansion_2026_10.json.
   Platforms and subscriptions were checked against official store and
   service pages on 2026-10-20 (sources in the curation notes for the PR).

Pre-write backup: catalog_horror_expansion_2026_10_20_backup.json (same
folder), written by --backup. It holds the full current documents for every
RETAG id and confirms every NEW id is absent. --apply refuses to run without
it, refuses a RETAG doc whose genre_tags changed since the backup, and
refuses a NEW id that exists by then.

    python scripts/horror_expansion_2026_10_20.py            # dry run
    python scripts/horror_expansion_2026_10_20.py --backup   # read-only snapshot
    python scripts/horror_expansion_2026_10_20.py --apply

Undo: re-PATCH each RETAG doc's genre_tags/genres from the backup and delete
the NEW ids.
"""

import json
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from game_seed_generator import get_default_explanation_templates

SCRIPT_DIR = Path(__file__).parent
DATA_FILE = SCRIPT_DIR / "games_data" / "horror_expansion_2026_10.json"
BACKUP_FILE = SCRIPT_DIR / "catalog_horror_expansion_2026_10_20_backup.json"
BASE = "https://firestore.googleapis.com/v1/projects/playnxt-1a2c6/databases/(default)/documents/games"

RETAG = [
    # tagged survival-horror / psychological-horror / gothic-horror only
    "amnesia-rebirth", "bloodborne", "crow-country", "dead-space-remake", "heaven-dust-2",
    "layers-of-fear-2023", "outlast-trials", "resident-evil-village", "signalis",
    "silent-hill-2-remake", "soma", "the-callisto-protocol", "tormented-souls",
    # horror games with no horror genre tag at all
    "luigis-mansion-3", "omori", "darkest-dungeon", "darkest-dungeon-2",
    "left-4-dead-2", "back-4-blood",
]


def gcloud_token():
    gcloud = shutil.which("gcloud") or "gcloud"
    return subprocess.run([gcloud, "auth", "print-access-token"],
                          capture_output=True, text=True, check=True).stdout.strip()


def to_fs(v):
    if isinstance(v, bool): return {"booleanValue": v}
    if isinstance(v, int): return {"integerValue": str(v)}
    if isinstance(v, float): return {"doubleValue": v}
    if isinstance(v, str): return {"stringValue": v}
    if isinstance(v, list): return {"arrayValue": {"values": [to_fs(x) for x in v]}}
    if isinstance(v, dict): return {"mapValue": {"fields": {k: to_fs(x) for k, x in v.items() if x is not None}}}
    return {"nullValue": None}


def strings(doc, field):
    return [v.get("stringValue") for v in
            doc.get("fields", {}).get(field, {}).get("arrayValue", {}).get("values", [])]


def get_doc(doc_id, tok):
    """The REST document, or None on 404."""
    url = f"{BASE}/{urllib.parse.quote(doc_id, safe='')}"
    try:
        return json.load(urllib.request.urlopen(urllib.request.Request(
            url, headers={"Authorization": f"Bearer {tok}"})))
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None
        raise


def patch(doc_id, fields, tok):
    mask = "&".join(f"updateMask.fieldPaths={k}" for k in fields)
    req = urllib.request.Request(
        f"{BASE}/{urllib.parse.quote(doc_id, safe='')}?{mask}", method="PATCH",
        data=json.dumps({"fields": fields}).encode(),
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req))


def transform(g):
    """Same shape seed_refresh.py writes, plus release_year/title_lower/content_warnings."""
    return {
        "game_id": g["id"],
        "title": g["title"],
        "title_lower": g["title"].lower(),
        "platforms": g["platforms"],
        "year": g["year"],
        "release_year": g["year"],
        "genres": g["genres"],
        "genre_tags": g["genres"],
        "time_tags": g["time_tags"],
        "energy_level": g["energy"],
        "moods": g["moods"],
        "mood_tags": g["moods"],
        "play_style": g["play_style"],
        "time_to_fun": g["time_to_fun"],
        "stop_friendliness": g["stop_friendliness"],
        "multiplayer_modes": g["multiplayer"],
        "description_short": g["description"],
        "fun_fact": None,
        "subscription_services": g.get("subscriptions", []),
        "store_links": g.get("store_links", {}),
        "content_warnings": g.get("content_warnings", []),
        "warnings": [],
        "explanation_templates": get_default_explanation_templates(g["energy"], g["play_style"]),
    }


def check_curated(games):
    required = ["id", "title", "platforms", "year", "genres", "time_tags", "energy", "moods",
                "play_style", "time_to_fun", "stop_friendliness", "multiplayer", "description"]
    bad = [g.get("id") for g in games
           if any(not g.get(k) or g.get(k) == "FILL_ME" for k in required) or "horror" not in g["genres"]]
    if bad:
        raise SystemExit(f"Uncurated or non-horror entries, fix before seeding: {bad}")
    ids = [g["id"] for g in games]
    if len(ids) != len(set(ids)):
        raise SystemExit("Duplicate ids in the data file.")


def main():
    games = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    check_curated(games)
    new_ids = [g["id"] for g in games]
    tok = gcloud_token()

    if "--backup" in sys.argv:
        retag_docs = {}
        for doc_id in RETAG:
            doc = get_doc(doc_id, tok)
            if doc is None:
                raise SystemExit(f"RETAG id missing from the catalog: {doc_id}")
            retag_docs[doc_id] = doc
        present = [i for i in new_ids if get_doc(i, tok) is not None]
        if present:
            raise SystemExit(f"NEW ids already exist, rename or drop them: {present}")
        BACKUP_FILE.write_text(json.dumps({
            "taken_at": datetime.now(timezone.utc).isoformat(),
            "retag_documents": retag_docs,
            "new_ids_confirmed_absent": new_ids,
        }, indent=1, ensure_ascii=False), encoding="utf-8")
        print(f"backup written: {BACKUP_FILE.name} ({len(retag_docs)} retag docs, {len(new_ids)} new ids absent)")
        return

    if "--apply" not in sys.argv:
        for doc_id in RETAG:
            print(f"  RETAG  {doc_id}")
        for g in games:
            print(f"  NEW    {g['id'][:36].ljust(36)} {g['energy']:>6} {','.join(g['platforms'])}"
                  f"  subs={g.get('subscriptions') or []}")
        print(f"\nDRY RUN: {len(RETAG)} retags, {len(games)} new docs. --backup, then --apply.")
        return

    if not BACKUP_FILE.exists():
        raise SystemExit("No backup file. Run --backup first.")
    backup = json.loads(BACKUP_FILE.read_text(encoding="utf-8"))

    # Re-verify everything before the first write, so a refusal writes nothing.
    current = {}
    for doc_id in RETAG:
        doc = get_doc(doc_id, tok)
        if doc is None or strings(doc, "genre_tags") != strings(backup["retag_documents"][doc_id], "genre_tags"):
            raise SystemExit(f"{doc_id} changed since the backup; not writing.")
        current[doc_id] = doc
    present = [i for i in new_ids if get_doc(i, tok) is not None]
    if present:
        raise SystemExit(f"NEW ids appeared since the backup; not writing: {present}")

    now_ts = {"timestampValue": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
    for doc_id, doc in current.items():
        fields = {}
        for field in ("genre_tags", "genres"):
            tags = strings(doc, field)
            if "horror" not in tags:
                fields[field] = to_fs(tags + ["horror"])
        if fields:
            fields["updated_at"] = now_ts
            patch(doc_id, fields, tok)
        print(f"  retagged {doc_id}")

    for g in games:
        fields = {k: to_fs(v) for k, v in transform(g).items()}
        fields["created_at"] = now_ts
        fields["updated_at"] = now_ts
        patch(g["id"], fields, tok)
        print(f"  created  {g['id']}")
    print(f"\nretagged: {len(current)} | created: {len(games)}")


if __name__ == "__main__":
    main()
