"""
Fetch store links from RAWG API for all games.

This script searches RAWG for each game and extracts store links.
Requires RAWG_API_KEY environment variable.

Usage:
    export RAWG_API_KEY=your_api_key
    python fetch_store_links_rawg.py
"""

import os
import json
import time
from pathlib import Path
import requests

RAWG_API_KEY = os.getenv("RAWG_API_KEY") or os.getenv("EXPO_PUBLIC_RAWG_API_KEY")
RAWG_BASE_URL = "https://api.rawg.io/api"

# Map RAWG store IDs to our store keys
# RAWG Store IDs: 1=Steam, 2=Xbox, 3=PlayStation, 4=App Store, 5=GOG, 6=Nintendo, 7=Xbox 360, 8=Google Play, 11=Epic
STORE_ID_MAPPING = {
    1: "steam",
    2: "xbox",
    3: "playstation",
    5: "gog",
    6: "nintendo",
    7: "xbox",  # Xbox 360 maps to Xbox
    11: "epic",
}


def search_game(title: str) -> dict | None:
    """Search for a game on RAWG and return the first result."""
    if not RAWG_API_KEY:
        print("Error: RAWG_API_KEY not set")
        return None

    try:
        response = requests.get(
            f"{RAWG_BASE_URL}/games",
            params={
                "key": RAWG_API_KEY,
                "search": title,
                "page_size": 1,
            },
            timeout=10
        )
        response.raise_for_status()
        data = response.json()

        if data.get("results") and len(data["results"]) > 0:
            return data["results"][0]
    except Exception as e:
        print(f"  Error searching for '{title}': {e}")

    return None


def get_game_stores(game_id: int) -> dict:
    """Get store links for a specific game by RAWG ID."""
    if not RAWG_API_KEY:
        return {}

    try:
        response = requests.get(
            f"{RAWG_BASE_URL}/games/{game_id}/stores",
            params={"key": RAWG_API_KEY},
            timeout=10
        )
        response.raise_for_status()
        data = response.json()

        store_links = {}
        for store_entry in data.get("results", []):
            store_id = store_entry.get("store_id")
            url = store_entry.get("url", "")

            if store_id in STORE_ID_MAPPING and url:
                our_key = STORE_ID_MAPPING[store_id]
                # Don't overwrite if we already have a link for this store
                if our_key not in store_links:
                    store_links[our_key] = url

        return store_links
    except Exception as e:
        print(f"  Error getting stores: {e}")

    return {}


def process_game(game: dict) -> dict:
    """Process a single game and fetch store links."""
    title = game.get("title", "")
    game_id = game.get("id", "")
    existing_links = game.get("store_links", {})

    # Skip if already has multiple store links
    if existing_links and len(existing_links) >= 3:
        return existing_links

    # Search for game on RAWG
    rawg_game = search_game(title)
    if not rawg_game:
        return existing_links

    # Get store links
    rawg_id = rawg_game.get("id")
    if not rawg_id:
        return existing_links

    store_links = get_game_stores(rawg_id)

    # Merge with existing links (existing takes priority)
    merged_links = {**store_links, **existing_links}

    return merged_links


def process_file(filepath: Path) -> int:
    """Process all games in a JSON file and add store links."""
    with open(filepath, 'r', encoding='utf-8') as f:
        games = json.load(f)

    updated_count = 0
    total = len(games)

    for i, game in enumerate(games):
        title = game.get("title", "Unknown")
        game_id = game.get("id", "")

        print(f"  [{i+1}/{total}] Processing: {title}")

        # Get store links
        new_links = process_game(game)

        if new_links and new_links != game.get("store_links", {}):
            game["store_links"] = new_links
            updated_count += 1
            print(f"    + Added {len(new_links)} store links")
        elif not new_links:
            print(f"    - No store links found")
        else:
            print(f"    = Already has store links")

        # Rate limiting - RAWG has limits
        time.sleep(0.25)

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(games, f, indent=2, ensure_ascii=False)

    return updated_count


def main():
    """Fetch store links for all games from RAWG."""
    if not RAWG_API_KEY:
        print("Error: RAWG_API_KEY environment variable not set")
        print("Set it with: export RAWG_API_KEY=your_api_key")
        return

    print(f"Using RAWG API key: {RAWG_API_KEY[:8]}...")

    script_dir = Path(__file__).parent
    data_dir = script_dir / "games_data"

    files = ["casual.json", "wind_down.json", "focused.json", "intense.json"]
    total_updated = 0

    for filename in files:
        filepath = data_dir / filename
        if filepath.exists():
            print(f"\n{'='*60}")
            print(f"Processing {filename}...")
            print('='*60)
            updated = process_file(filepath)
            total_updated += updated
            print(f"\nUpdated {updated} games in {filename}")
        else:
            print(f"Warning: {filepath} not found")

    print(f"\n{'='*60}")
    print(f"COMPLETE: Updated {total_updated} games with store links")
    print('='*60)


if __name__ == "__main__":
    main()
