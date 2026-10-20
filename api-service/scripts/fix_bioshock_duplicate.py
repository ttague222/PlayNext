"""
One-off catalog fix, 2026-10-20: merge the duplicate BioShock records.

bioshock-remastered is kept: it is the version sold on PS4/PS5, Switch, GOG and
Epic, and already has the wider time_tags. bioshock (the 2007 original, from
add_classic_games.py) is deleted after its more specific mood tags and its fun
fact are merged into the survivor. The deleted id is tombstoned in
deleted_game_ids.json; its add_classic_games.py entry is removed by hand in the
same commit.

Pre-write documents: catalog_fix_2026_10_20_bioshock_duplicate_backup.json (same
folder), written before any change. Refuses to write if either record changed
since the 2026-10-20 review.

    python scripts/fix_bioshock_duplicate.py
"""

import json
import shutil
import subprocess
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://firestore.googleapis.com/v1/projects/playnxt-1a2c6/databases/(default)/documents/games"
KEEP, DROP = "bioshock-remastered", "bioshock"
SCRIPT_DIR = Path(__file__).parent
BACKUP = SCRIPT_DIR / "catalog_fix_2026_10_20_bioshock_duplicate_backup.json"


def strings(doc, field):
    return [v.get("stringValue") for v in
            doc["fields"].get(field, {}).get("arrayValue", {}).get("values", [])]


def main():
    gcloud = shutil.which("gcloud") or "gcloud"
    token = subprocess.run(
        [gcloud, "auth", "print-access-token"], capture_output=True, text=True, check=True
    ).stdout.strip()
    headers = {"Authorization": f"Bearer {token}"}

    def get(doc_id):
        return json.load(urllib.request.urlopen(urllib.request.Request(f"{BASE}/{doc_id}", headers=headers)))

    keep, drop = get(KEEP), get(DROP)
    if (strings(keep, "mood_tags") != ["immersive", "intense"]
            or strings(drop, "mood_tags") != ["atmospheric", "tense", "thought-provoking"]):
        raise SystemExit("Records changed since the review; not writing.")

    BACKUP.write_text(json.dumps({"taken_at": datetime.now(timezone.utc).isoformat(),
                                  "documents": {KEEP: keep, DROP: drop}}, indent=1), encoding="utf-8")

    moods = {"arrayValue": {"values": [{"stringValue": t} for t in strings(drop, "mood_tags")]}}
    fields = {
        "mood_tags": moods,
        "moods": moods,
        "fun_fact": drop["fields"]["fun_fact"],
        "updated_at": {"timestampValue": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")},
    }
    mask = "&".join(f"updateMask.fieldPaths={k}" for k in fields)
    urllib.request.urlopen(urllib.request.Request(
        f"{BASE}/{KEEP}?{mask}", method="PATCH", data=json.dumps({"fields": fields}).encode(),
        headers={**headers, "Content-Type": "application/json"}))
    urllib.request.urlopen(urllib.request.Request(f"{BASE}/{DROP}", method="DELETE", headers=headers))
    print(f"{KEEP}: mood_tags={strings(drop, 'mood_tags')} + fun_fact; deleted {DROP}")

    tomb_path = SCRIPT_DIR / "deleted_game_ids.json"
    tombs = json.loads(tomb_path.read_text(encoding="utf-8"))
    if DROP not in tombs:
        tomb_path.write_text(json.dumps(sorted(tombs + [DROP]), indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
