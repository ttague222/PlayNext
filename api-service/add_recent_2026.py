"""
Add the most recent releases (2026, Jan-May) that were missing from the catalog,
including 007 First Light. Release dates/platforms verified against public
sources as of 2026-05-31. Switch 2 maps to "switch". Valid enum values only
(see src/models/game.py). store_links left empty to avoid unverified URLs.

Usage:  python add_recent_2026.py
"""

import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {'projectId': 'playnxt-1a2c6'})

db = firestore.client()
games_ref = db.collection('games')

RECENT_2026 = [
    {
        "game_id": "007-first-light", "title": "007 First Light", "platforms": ["pc", "playstation", "xbox"],
        "release_year": 2026, "genre_tags": ["action-adventure", "stealth", "spy", "narrative"],
        "time_tags": [60, 90], "energy_level": "medium", "mood_tags": ["cinematic", "tense", "stylish"],
        "play_style": ["action", "narrative"], "time_to_fun": "medium", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "An origin story for a young James Bond, from the makers of Hitman.",
        "fun_fact": "IO Interactive's first original James Bond game.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "forza-horizon-6", "title": "Forza Horizon 6", "platforms": ["pc", "xbox"],
        "release_year": 2026, "genre_tags": ["racing", "open-world", "simulation"],
        "time_tags": [30, 60], "energy_level": "medium", "mood_tags": ["relaxing", "exciting", "adventurous"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop", "competitive"],
        "description_short": "Open-world arcade racing across a vibrant, seasonal Japan.",
        "fun_fact": "The first Forza Horizon set in Japan.",
        "explanation_templates": {}, "subscription_services": ["game_pass"], "store_links": {}
    },
    {
        "game_id": "marathon-2026", "title": "Marathon", "platforms": ["pc", "playstation", "xbox"],
        "release_year": 2026, "genre_tags": ["fps", "extraction-shooter", "sci-fi", "multiplayer"],
        "time_tags": [30, 60], "energy_level": "high", "mood_tags": ["tense", "competitive", "atmospheric"],
        "play_style": ["action"], "time_to_fun": "medium", "stop_friendliness": "commitment",
        "multiplayer_modes": ["online_coop", "competitive"],
        "description_short": "Bungie's sci-fi PvP extraction shooter — raid, loot, and escape.",
        "fun_fact": "A reboot of the 1994 series Bungie made before Halo.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "trails-beyond-the-horizon", "title": "The Legend of Heroes: Trails Beyond the Horizon",
        "platforms": ["pc", "playstation", "switch"],
        "release_year": 2026, "genre_tags": ["rpg", "jrpg", "turn-based", "fantasy"],
        "time_tags": [60, 90], "energy_level": "low", "mood_tags": ["story-driven", "immersive", "epic"],
        "play_style": ["narrative", "strategy"], "time_to_fun": "long", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "The next chapter in the deeply interconnected Trails JRPG saga.",
        "fun_fact": "Part of one of gaming's most continuous story-driven series.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "pathologic-3", "title": "Pathologic 3", "platforms": ["pc", "playstation", "xbox"],
        "release_year": 2026, "genre_tags": ["horror", "survival", "narrative", "immersive-sim"],
        "time_tags": [60, 90], "energy_level": "medium", "mood_tags": ["atmospheric", "tense", "thought-provoking"],
        "play_style": ["narrative", "action"], "time_to_fun": "long", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "A surreal, oppressive narrative survival game in a plague-stricken town.",
        "fun_fact": "The series is known for punishing, deeply atmospheric storytelling.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "dragon-quest-7-reimagined", "title": "Dragon Quest VII Reimagined",
        "platforms": ["pc", "playstation", "xbox", "switch"],
        "release_year": 2026, "genre_tags": ["rpg", "jrpg", "turn-based", "fantasy", "remake"],
        "time_tags": [60, 90], "energy_level": "low", "mood_tags": ["charming", "story-driven", "relaxing"],
        "play_style": ["narrative", "strategy"], "time_to_fun": "medium", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "A full remake of the classic puzzle-box JRPG epic.",
        "fun_fact": "The original was famous for its enormous length.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "2xko", "title": "2XKO", "platforms": ["pc", "playstation", "xbox"],
        "release_year": 2026, "genre_tags": ["fighting", "competitive", "multiplayer"],
        "time_tags": [15, 30], "energy_level": "high", "mood_tags": ["competitive", "intense", "fun"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "local_coop", "online_coop", "competitive"],
        "description_short": "Riot's tag-team fighting game set in the League of Legends universe.",
        "fun_fact": "Champions like Ahri and Darius are playable fighters.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "pokemon-pokopia", "title": "Pokemon Pokopia", "platforms": ["switch"],
        "release_year": 2026, "genre_tags": ["simulation", "life-sim", "cozy"],
        "time_tags": [30, 60], "energy_level": "low", "mood_tags": ["relaxing", "cozy", "wholesome"],
        "play_style": ["sandbox_creative"], "time_to_fun": "short", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "A cozy Pokemon life-sim where you build a town with Pokemon.",
        "fun_fact": "You play as a Ditto transformed into a human.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "monster-hunter-stories-3", "title": "Monster Hunter Stories 3",
        "platforms": ["pc", "playstation", "switch"],
        "release_year": 2026, "genre_tags": ["rpg", "turn-based", "monster-collecting", "adventure"],
        "time_tags": [30, 60], "energy_level": "medium", "mood_tags": ["adventurous", "charming", "relaxing"],
        "play_style": ["narrative", "strategy"], "time_to_fun": "medium", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Befriend, raise, and ride monsters in this turn-based Monster Hunter RPG.",
        "fun_fact": "A friendlier, story-driven spin on the Monster Hunter series.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "lego-batman-legacy", "title": "LEGO Batman: Legacy of the Dark Knight",
        "platforms": ["pc", "playstation", "xbox", "switch"],
        "release_year": 2026, "genre_tags": ["action-adventure", "lego", "co-op", "comedy"],
        "time_tags": [30, 60], "energy_level": "low", "mood_tags": ["fun", "lighthearted", "family-friendly"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "local_coop"],
        "description_short": "Build-and-bash through Gotham in classic LEGO style.",
        "fun_fact": "TT Games' return to the beloved LEGO Batman series.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "yoshi-mysterious-book", "title": "Yoshi and the Mysterious Book", "platforms": ["switch"],
        "release_year": 2026, "genre_tags": ["platformer", "adventure", "family"],
        "time_tags": [15, 30], "energy_level": "low", "mood_tags": ["wholesome", "charming", "relaxing"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "local_coop"],
        "description_short": "A charming Yoshi platforming adventure through storybook worlds.",
        "fun_fact": "Yoshi's latest craft-styled platformer.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "paralives", "title": "Paralives", "platforms": ["pc"],
        "release_year": 2026, "genre_tags": ["simulation", "life-sim", "sandbox"],
        "time_tags": [30, 60, 90], "energy_level": "low", "mood_tags": ["relaxing", "creative", "cozy"],
        "play_style": ["sandbox_creative"], "time_to_fun": "short", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "An indie life simulation with open-ended building and town creation.",
        "fun_fact": "A long-awaited indie alternative to The Sims.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
]


def add_games():
    added = 0
    skipped = 0

    for game in RECENT_2026:
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
