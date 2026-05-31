"""
Backfill the required `description_short` field for docs that have a populated
long-form `description` but an empty/missing `description_short`. Copies the
existing real description across (no fabricated content). Additive and
idempotent.

Without description_short these docs fail Game(**data) validation and are
silently dropped from API responses. As of 2026-05-31 this affects 5 docs:
the Darksiders series and Fields of Mistria.

Usage:  python fix_missing_descriptions.py
"""

import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {'projectId': 'playnxt-1a2c6'})

db = firestore.client()
games_ref = db.collection('games')


def _is_empty(value):
    return value is None or value == ""


def fix_values():
    updated = 0

    for doc in games_ref.stream():
        g = doc.to_dict()
        if _is_empty(g.get("description_short")) and not _is_empty(g.get("description")):
            games_ref.document(doc.id).update({
                "description_short": g["description"],
                "updated_at": datetime.now(timezone.utc),
            })
            updated += 1
            print(f"Updated {doc.id}: description_short <- description")

    print(f"\nDone! {updated} docs updated")


if __name__ == "__main__":
    fix_values()
