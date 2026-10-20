"""
One-off catalog fix, 2026-10-20: merge the duplicate Resident Evil Requiem records.

resident-evil-requiem (official title, Switch 2 listed, better mood tags) is kept.
resident-evil-9-requiem ("Resident Evil 9: Requiem", from refresh_2025_2026.json)
is deleted after its time_tags and play_style are merged into the survivor, so
the game keeps its 120-minute fit and narrative style. The deleted id is
tombstoned in deleted_game_ids.json and removed from refresh_2025_2026.json,
because seed_refresh.py does not read the tombstones.

Pre-write documents: catalog_fix_2026_10_20_re9_duplicate_backup.json (same folder),
written before any change. Refuses to write if either record changed since the
2026-10-20 review.

    python scripts/fix_re9_duplicate.py
"""

import json
import shutil
import subprocess
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://firestore.googleapis.com/v1/projects/playnxt-1a2c6/databases/(default)/documents/games"
KEEP, DROP = "resident-evil-requiem", "resident-evil-9-requiem"
SCRIPT_DIR = Path(__file__).parent
BACKUP = SCRIPT_DIR / "catalog_fix_2026_10_20_re9_duplicate_backup.json"


def strings(doc, field):
    return [v.get("stringValue") or v.get("integerValue") for v in
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
    if strings(keep, "time_tags") != ["60", "90"] or strings(drop, "time_tags") != ["60", "90", "120"]:
        raise SystemExit("Records changed since the review; not writing.")

    BACKUP.write_text(json.dumps({"taken_at": datetime.now(timezone.utc).isoformat(),
                                  "documents": {KEEP: keep, DROP: drop}}, indent=1), encoding="utf-8")

    time_tags = sorted({int(t) for t in strings(keep, "time_tags") + strings(drop, "time_tags")})
    play_style = strings(keep, "play_style") + [s for s in strings(drop, "play_style")
                                                if s not in strings(keep, "play_style")]
    fields = {
        "time_tags": {"arrayValue": {"values": [{"integerValue": str(t)} for t in time_tags]}},
        "play_style": {"arrayValue": {"values": [{"stringValue": s} for s in play_style]}},
        "updated_at": {"timestampValue": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")},
    }
    mask = "&".join(f"updateMask.fieldPaths={k}" for k in fields)
    urllib.request.urlopen(urllib.request.Request(
        f"{BASE}/{KEEP}?{mask}", method="PATCH", data=json.dumps({"fields": fields}).encode(),
        headers={**headers, "Content-Type": "application/json"}))
    urllib.request.urlopen(urllib.request.Request(f"{BASE}/{DROP}", method="DELETE", headers=headers))
    print(f"{KEEP}: time_tags={time_tags} play_style={play_style}; deleted {DROP}")

    tomb_path = SCRIPT_DIR / "deleted_game_ids.json"
    tombs = json.loads(tomb_path.read_text(encoding="utf-8"))
    if DROP not in tombs:
        tomb_path.write_text(json.dumps(sorted(tombs + [DROP]), indent=1) + "\n", encoding="utf-8")
    refresh = SCRIPT_DIR / "games_data" / "refresh_2025_2026.json"
    games = json.loads(refresh.read_text(encoding="utf-8"))
    refresh.write_text(json.dumps([g for g in games if g.get("id") != DROP], indent=2, ensure_ascii=False),
                       encoding="utf-8")


if __name__ == "__main__":
    main()
