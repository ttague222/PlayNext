"""
Add Phantom Rose 2 Sapphire (the title the user clarified after the
2026-06-02 batch).

Phantom Rose 2 Sapphire — by solo developer makaroll. Roguelike deckbuilder
with no random card draws; you manage card cooldowns instead.
- Steam launch: October 30, 2023
- iOS + Android launch: August 16, 2024 (free-to-play)

Tagged with both PC and Mobile to reflect actual availability.

Usage:  python add_phantom_rose_2.py
"""

import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {'projectId': 'playnxt-1a2c6'})

db = firestore.client()
games_ref = db.collection('games')

GAME = {
    "game_id": "phantom-rose-2-sapphire",
    "title": "Phantom Rose 2 Sapphire",
    "platforms": ["pc", "mobile"],
    "release_year": 2023,
    "genre_tags": ["roguelike", "deckbuilder", "card", "strategy", "indie"],
    "time_tags": [15, 30, 60],
    "energy_level": "medium",
    "mood_tags": ["strategic", "addictive", "charming"],
    "play_style": ["card_game", "strategy"],
    "time_to_fun": "short",
    "stop_friendliness": "anytime",
    "multiplayer_modes": ["solo"],
    "description_short": "A roguelike deckbuilder with no random draws — manage card cooldowns to defeat the Phantoms.",
    "fun_fact": "Made by solo developer makaroll; mobile version is free-to-play.",
    "explanation_templates": {
        "time_fit": "Runs fit comfortably in 30–60 minutes.",
        "mood_fit": "Strategic card play without the randomness of typical deckbuilders.",
        "stop_fit": "Save and quit between battles."
    },
    "subscription_services": [],
    "store_links": {}
}


def add_game():
    game_id = GAME["game_id"]
    existing = games_ref.document(game_id).get()
    if existing.exists:
        print(f"Skipping {GAME['title']} - already exists")
        return

    GAME["created_at"] = datetime.now(timezone.utc)
    GAME["updated_at"] = datetime.now(timezone.utc)
    games_ref.document(game_id).set(GAME)
    print(f"Added: {GAME['title']} ({GAME['release_year']})")


if __name__ == "__main__":
    add_game()
