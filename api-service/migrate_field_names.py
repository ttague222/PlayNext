"""
Normalize legacy game-doc field names to the canonical schema in
src/models/game.py. Additive and reversible: copies each old field into its
new counterpart ONLY when the new field is empty/missing, and never touches
the old field. Curated new values always win (auto-resolves conflict docs).

Firestore project: playnxt-1a2c6, collection: games.

Usage:
    python migrate_field_names.py --dry-run   # preview, no writes
    python migrate_field_names.py             # apply
"""

import sys
from datetime import datetime, timezone

# old field name -> canonical (new) field name
FIELD_PAIRS = [
    ("year", "release_year"),
    ("genres", "genre_tags"),
    ("moods", "mood_tags"),
    ("energy", "energy_level"),
    ("warnings", "content_warnings"),
    ("multiplayer", "multiplayer_modes"),
]

# Required fields on the canonical Game model (used to flag still-invalid docs).
REQUIRED_FIELDS = [
    "release_year", "energy_level", "time_to_fun",
    "stop_friendliness", "description_short", "title",
]


def _is_empty(value):
    return value is None or value == [] or value == ""


def compute_field_updates(doc: dict) -> dict:
    """Return {new_field: value} for each old->new pair where old has a value
    and new is empty/missing. Never includes a pair whose new field is set."""
    updates = {}
    for old, new in FIELD_PAIRS:
        if not _is_empty(doc.get(old)) and _is_empty(doc.get(new)):
            updates[new] = doc[old]
    return updates


def run(dry_run: bool) -> None:
    import firebase_admin
    from firebase_admin import credentials, firestore

    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {"projectId": "playnxt-1a2c6"})

    games_ref = firestore.client().collection("games")

    changed = 0
    still_invalid = []

    for doc in games_ref.stream():
        g = doc.to_dict()
        updates = compute_field_updates(g)

        if updates:
            changed += 1
            if dry_run:
                print(f"[dry-run] {doc.id}: {updates}")
            else:
                write = dict(updates)
                write["updated_at"] = datetime.now(timezone.utc)
                games_ref.document(doc.id).update(write)
                print(f"Updated {doc.id}: {list(updates)}")

        merged = {**g, **updates}
        if any(_is_empty(merged.get(f)) for f in REQUIRED_FIELDS):
            still_invalid.append(doc.id)

    verb = "would change" if dry_run else "changed"
    print(f"\n{'DRY RUN: ' if dry_run else ''}{changed} docs {verb}")
    if still_invalid:
        print(f"{len(still_invalid)} docs still missing a required field "
              f"(manual follow-up): {still_invalid}")


if __name__ == "__main__":
    run(dry_run="--dry-run" in sys.argv)
