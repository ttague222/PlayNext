"""
Add user-requested mobile games (2026-06-02 batch).

Requested:
- Aznana (Caramel Column, 2023) — confirmed via web search, iOS + Android.
- Postknight 2 (Kurechii, 2021) — confirmed via web search, iOS + Android.
  (Official name is "Postknight 2: Deliver and Die"; the user wrote
  "Postknights 2" — same game.)
- Rose 2 — NOT INCLUDED. Could not verify a real mobile game by that name;
  awaiting clarification from the user.

Valid enum values only (see src/models/game.py). store_links left empty to
avoid unverified URLs.

Usage:  python add_user_requests_2026_06.py
"""

import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {'projectId': 'playnxt-1a2c6'})

db = firestore.client()
games_ref = db.collection('games')

USER_REQUESTS = [
    {
        "game_id": "aznana",
        "title": "Aznana",
        "platforms": ["mobile"],
        "release_year": 2023,
        "genre_tags": ["idle", "adventure", "narrative", "indie"],
        "time_tags": [15, 30, 60],
        "energy_level": "low",
        "mood_tags": ["atmospheric", "mysterious", "charming", "relaxing"],
        "play_style": ["narrative", "action"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "A boy who cannot speak and a talking head try to escape a mysterious walled town in this idle adventure.",
        "fun_fact": "An idle game with hand-drawn art that plays at your pace, even while the app is closed.",
        "explanation_templates": {
            "time_fit": "Idle progression means short or long sessions both work.",
            "mood_fit": "Atmospheric and unhurried.",
            "stop_fit": "Stop anytime — progress continues offline."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "postknight-2",
        "title": "Postknight 2",
        "platforms": ["mobile"],
        "release_year": 2021,
        "genre_tags": ["rpg", "adventure", "action", "indie"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["charming", "fun", "adventurous"],
        "play_style": ["action", "narrative"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "A casual RPG-adventure about postknights delivering letters across a charming pixel-art world.",
        "fun_fact": "Sequel to the popular Postknight, developed by Malaysian studio Kurechii.",
        "explanation_templates": {
            "time_fit": "Bite-sized deliveries fit short mobile sessions.",
            "mood_fit": "Light RPG with a charming, lighthearted tone.",
            "stop_fit": "Save between deliveries."
        },
        "subscription_services": [],
        "store_links": {}
    },
]


def add_games():
    added = 0
    skipped = 0

    for game in USER_REQUESTS:
        game_id = game["game_id"]
        existing = games_ref.document(game_id).get()
        if existing.exists:
            print(f"Skipping {game['title']} - already exists")
            skipped += 1
            continue

        game["created_at"] = datetime.now(timezone.utc)
        game["updated_at"] = datetime.now(timezone.utc)
        games_ref.document(game_id).set(game)
        print(f"Added: {game['title']} ({game['release_year']})")
        added += 1

    print(f"\nDone! Added {added} games, skipped {skipped} existing")


if __name__ == "__main__":
    add_games()
