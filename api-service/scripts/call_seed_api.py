"""
Call the seed API endpoint with the game data from all category files.
"""
import json
import httpx
import sys
from pathlib import Path

# Import the seed games data from all categories
try:
    from seed_games_wind_down import SEED_GAMES as WIND_DOWN_GAMES
except ImportError:
    WIND_DOWN_GAMES = []
    print("Warning: Could not import wind_down games")

try:
    from seed_games_casual import SEED_GAMES as CASUAL_GAMES
except ImportError:
    CASUAL_GAMES = []
    print("Warning: Could not import casual games")

try:
    from seed_games_focused import SEED_GAMES as FOCUSED_GAMES
except ImportError:
    FOCUSED_GAMES = []
    print("Warning: Could not import focused games")

try:
    from seed_games_intense import SEED_GAMES as INTENSE_GAMES
except ImportError:
    INTENSE_GAMES = []
    print("Warning: Could not import intense games")

API_URL = "https://playnxt-api-234522821472.us-central1.run.app/api/games/seed"


def seed_category(name: str, games: list) -> int:
    """Seed a single category of games."""
    if not games:
        print(f"  Skipping {name} - no games")
        return 0

    print(f"\nSeeding {len(games)} {name} games...")

    # Send in batches of 50 to avoid timeout
    batch_size = 50
    total_success = 0

    for i in range(0, len(games), batch_size):
        batch = games[i:i+batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(games) + batch_size - 1) // batch_size
        print(f"  Batch {batch_num}/{total_batches} ({len(batch)} games)...", end=" ", flush=True)

        try:
            response = httpx.post(
                API_URL,
                json=batch,
                timeout=120.0
            )

            if response.status_code == 200:
                result = response.json()
                success = result.get("success", 0)
                total_success += success
                failed = result.get("failed", [])
                if failed:
                    print(f"OK ({success} added, {len(failed)} failed: {failed[:3]}...)")
                else:
                    print(f"OK ({success} added)")
            else:
                print(f"ERROR: {response.status_code} - {response.text[:100]}")
        except Exception as e:
            print(f"ERROR: {e}")

    return total_success


def main():
    print(f"PlayNxt Game Seeder")
    print(f"===================")
    print(f"API: {API_URL}")

    categories = [
        ("Wind Down", WIND_DOWN_GAMES),
        ("Casual", CASUAL_GAMES),
        ("Focused", FOCUSED_GAMES),
        ("Intense", INTENSE_GAMES),
    ]

    total_games = sum(len(games) for _, games in categories)
    print(f"\nTotal games to seed: {total_games}")

    total_success = 0
    for name, games in categories:
        total_success += seed_category(name, games)

    print(f"\n===================")
    print(f"Total games seeded: {total_success}/{total_games}")

    if total_success == total_games:
        print("All games seeded successfully!")
    else:
        print(f"Warning: {total_games - total_success} games failed to seed")


if __name__ == "__main__":
    main()
