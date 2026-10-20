"""
One-off catalog fix, 2026-10-20: drop the stray "intense" mood tag from
low-energy horror games.

Ten low-energy horror games carried "intense", a leftover default rather than
a description of the game. It is in MOOD_TAG_CLASH for Wind Down, so these
games lost points on exactly the mood they fit, and it told users a quiet
walking sim was high-pressure. Each "intense" is replaced with a tag from the
existing vocabulary that matches the game's own description. Other tags are
untouched.

Writes mood_tags and its moods mirror in Firestore, and the same change in the
seed file each game came from, so a reseed keeps it.

Pre-write documents: catalog_fix_2026_10_20_horror_moods_backup.json (same
folder), written before any change. Refuses to write if any record's mood_tags
changed since the 2026-10-20 review.

    python scripts/fix_low_energy_horror_moods.py
"""

import json
import shutil
import subprocess
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://firestore.googleapis.com/v1/projects/playnxt-1a2c6/databases/(default)/documents/games"
SCRIPT_DIR = Path(__file__).parent
BACKUP = SCRIPT_DIR / "catalog_fix_2026_10_20_horror_moods_backup.json"

# id: (mood_tags as reviewed, replacement for "intense", seed file)
FIXES = {
    "bramble-mountain-king": (["beautiful", "intense", "immersive"], "dark", "batch_userloved_m.json"),
    "bulb-boy": (["creative", "intense", "charming"], "quirky", "batch_gems_narrative_i.json"),
    "detention": (["intense", "immersive"], "melancholic", "batch_hidden_gems_h.json"),
    "doki-doki-literature-club": (["immersive", "intense"], "unsettling", "batch_essentials_g.json"),
    "sally-face": (["immersive", "intense", "creative"], "mysterious", "batch_userloved_m.json"),
    "stories-untold": (["intense", "immersive", "creative"], "retro", "batch_gems_mixed_l.json"),
    "vanishing-of-ethan-carter": (["immersive", "beautiful", "intense"], "mysterious", "batch_gems_mixed_l.json"),
    "tiny-bunny": (["immersive", "intense"], "atmospheric", "refresh_2025_2026.json"),
    "visage": (["intense", "immersive"], "terrifying", "batch_gems_mixed_l.json"),
    "year-walk": (["immersive", "intense", "beautiful"], "atmospheric", "batch_gems_narrative_i.json"),
}


def strings(doc, field):
    return [v.get("stringValue") for v in
            doc["fields"].get(field, {}).get("arrayValue", {}).get("values", [])]


def replaced(tags, new):
    return [new if t == "intense" else t for t in tags]


def main():
    gcloud = shutil.which("gcloud") or "gcloud"
    token = subprocess.run(
        [gcloud, "auth", "print-access-token"], capture_output=True, text=True, check=True
    ).stdout.strip()
    headers = {"Authorization": f"Bearer {token}"}

    docs = {}
    for doc_id, (expected, _, _) in FIXES.items():
        doc = json.load(urllib.request.urlopen(urllib.request.Request(f"{BASE}/{doc_id}", headers=headers)))
        if strings(doc, "mood_tags") != expected:
            raise SystemExit(f"{doc_id} changed since the review ({strings(doc, 'mood_tags')}); not writing.")
        docs[doc_id] = doc
    BACKUP.write_text(json.dumps({"taken_at": datetime.now(timezone.utc).isoformat(), "documents": docs},
                                 indent=1, ensure_ascii=False), encoding="utf-8")

    now = {"timestampValue": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
    for doc_id, (expected, new, _) in FIXES.items():
        tags = {"arrayValue": {"values": [{"stringValue": t} for t in replaced(expected, new)]}}
        fields = {"mood_tags": tags, "moods": tags, "updated_at": now}
        mask = "&".join(f"updateMask.fieldPaths={k}" for k in fields)
        urllib.request.urlopen(urllib.request.Request(
            f"{BASE}/{doc_id}?{mask}", method="PATCH", data=json.dumps({"fields": fields}).encode(),
            headers={**headers, "Content-Type": "application/json"}))
        print(f"  {doc_id}: {expected} -> {replaced(expected, new)}")

    for seed in sorted({f for _, _, f in FIXES.values()}):
        path = SCRIPT_DIR / "games_data" / seed
        games = json.loads(path.read_text(encoding="utf-8"))
        for g in games:
            if g.get("id") in FIXES and FIXES[g["id"]][2] == seed:
                g["moods"] = replaced(g.get("moods") or [], FIXES[g["id"]][1])
        path.write_text(json.dumps(games, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
