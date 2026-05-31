"""
Normalize off-enum stop_friendliness values in the game catalog so every doc
validates against src/models/game.py (StopFriendliness: anytime / checkpoints /
commitment). The API does Game(**data), which raises on bad enum values and
silently drops the game from responses.

Found in the catalog (2026-05-31):
    "any-level"   -> "anytime"      (can be stopped at any moment)
    "save-points" -> "checkpoints"  (stop at save points)

Only documents that actually change are written (with a fresh updated_at).
Idempotent: safe to re-run.

Usage:  python fix_stop_friendliness.py
"""

import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {'projectId': 'playnxt-1a2c6'})

db = firestore.client()
games_ref = db.collection('games')

VALID = {"anytime", "checkpoints", "commitment"}

STOP_MAP = {
    "any-level": "anytime",
    "save-points": "checkpoints",
}


def fix_values():
    updated = 0

    for doc in games_ref.stream():
        g = doc.to_dict()
        sf = g.get("stop_friendliness")

        if sf in VALID or sf is None:
            continue

        new = STOP_MAP.get(sf)
        if new is None:
            print(f"SKIP {doc.id}: unmapped value {sf!r} (left as-is)")
            continue

        games_ref.document(doc.id).update({
            "stop_friendliness": new,
            "updated_at": datetime.now(timezone.utc),
        })
        updated += 1
        print(f"Updated {doc.id}: {sf!r} -> {new!r}")

    print(f"\nDone! {updated} docs updated")


if __name__ == "__main__":
    fix_values()
