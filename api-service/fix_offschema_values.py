"""
Normalize off-schema enum values in the game catalog so every doc validates
against src/models/game.py (the API does Game(**data), which raises on bad enums
and silently drops the game from responses).

Fixes two issues found in the catalog:
  1. time_to_fun == "instant"  -> "short"   (not a valid TimeToFun value)
  2. play_style tokens not in the PlayStyle enum:
         "rpg"         -> "narrative"
         "casual"      -> "sandbox_creative"
         "exploration" -> "sandbox_creative"
     ...then de-duplicated, preserving any already-valid styles and order.

Only documents that actually change are written (with a fresh updated_at).
Idempotent: safe to re-run.

Usage:  python fix_offschema_values.py
"""

import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {'projectId': 'playnxt-1a2c6'})

db = firestore.client()
games_ref = db.collection('games')

VALID_TTF = {"short", "medium", "long"}
VALID_PS = {"narrative", "action", "puzzle", "strategy", "tactics",
            "card_game", "sandbox_creative", "puzzle_strategy"}

PS_MAP = {
    "rpg": "narrative",
    "casual": "sandbox_creative",
    "exploration": "sandbox_creative",
}


def fix_play_style(styles):
    """Remap invalid play_style tokens to valid ones, de-duped, order-preserving."""
    out = []
    for s in styles or []:
        mapped = s if s in VALID_PS else PS_MAP.get(s)
        if mapped and mapped not in out:
            out.append(mapped)
    return out


def fix_values():
    ttf_fixed = 0
    ps_fixed = 0
    docs_updated = 0

    for doc in games_ref.stream():
        g = doc.to_dict()
        updates = {}

        ttf = g.get("time_to_fun")
        if ttf and ttf not in VALID_TTF:
            updates["time_to_fun"] = "short"

        ps = g.get("play_style") or []
        if any(s not in VALID_PS for s in ps):
            new_ps = fix_play_style(ps)
            if new_ps != ps:
                updates["play_style"] = new_ps

        if updates:
            if "time_to_fun" in updates:
                ttf_fixed += 1
            if "play_style" in updates:
                ps_fixed += 1
            updates["updated_at"] = datetime.now(timezone.utc)
            games_ref.document(doc.id).update(updates)
            docs_updated += 1
            changed = {k: v for k, v in updates.items() if k != "updated_at"}
            print(f"Updated {doc.id}: {changed}")

    print(f"\nDone! {docs_updated} docs updated "
          f"(time_to_fun fixes: {ttf_fixed}, play_style fixes: {ps_fixed})")


if __name__ == "__main__":
    fix_values()
