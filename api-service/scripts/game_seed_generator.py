"""
PlayNxt Game Seed Generator

Generates full seed files from compact game data.
This allows us to define games with minimal data and auto-generate the full structure.

Usage:
    python -m scripts.game_seed_generator

This will read from games_data/*.json and generate seed_games_*.py files.
"""

import json
import os
from pathlib import Path
from datetime import datetime

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "games_data"


def get_default_explanation_templates(energy_level: str, play_style: list) -> dict:
    """Generate default explanation templates based on game attributes."""
    templates = {}

    if energy_level == "low":
        templates["time_fit"] = "Perfect for a relaxing {time}-minute session"
        templates["mood_fit"] = "Unwind and enjoy at your own pace"
        templates["stop_fit"] = "Easy to pause whenever you need"
    elif energy_level == "medium":
        templates["time_fit"] = "Great for a {time}-minute gaming session"
        templates["mood_fit"] = "Engaging without being overwhelming"
        templates["stop_fit"] = "Good stopping points throughout"
    else:  # high
        templates["time_fit"] = "Get your adrenaline pumping in {time} minutes"
        templates["mood_fit"] = "Intense action when you're ready for it"
        templates["stop_fit"] = "Best enjoyed in longer sessions"

    if "narrative" in play_style:
        templates["style_fit"] = "Rich story to get lost in"
    elif "action" in play_style:
        templates["style_fit"] = "Fast-paced gameplay"
    elif "puzzle_strategy" in play_style:
        templates["style_fit"] = "Satisfying strategic thinking"
    elif "sandbox_creative" in play_style:
        templates["style_fit"] = "Freedom to create and explore"
    else:
        templates["style_fit"] = "Enjoyable gameplay experience"

    return templates


def get_avg_session_length(time_tags: list) -> int:
    """Calculate average session length from time tags."""
    if not time_tags:
        return 30
    return sum(time_tags) // len(time_tags)


def expand_game(game_data: dict) -> dict:
    """Expand compact game data into full seed format."""
    # Required fields
    game = {
        "game_id": game_data["id"],
        "title": game_data["title"],
        "platforms": game_data.get("platforms", ["pc", "console"]),
        "release_year": game_data.get("year", 2023),
        "genre_tags": game_data.get("genres", []),
        "time_tags": game_data.get("time_tags", [30, 60]),
        "energy_level": game_data.get("energy", "medium"),
        "mood_tags": game_data.get("moods", []),
        "play_style": game_data.get("play_style", ["action"]),
        "time_to_fun": game_data.get("time_to_fun", "short"),
        "stop_friendliness": game_data.get("stop_friendliness", "checkpoints"),
        "multiplayer_modes": game_data.get("multiplayer", ["solo"]),
        "description_short": game_data["description"],
        "fun_fact": game_data.get("fun_fact", ""),
        "explanation_templates": game_data.get(
            "explanation_templates",
            get_default_explanation_templates(
                game_data.get("energy", "medium"),
                game_data.get("play_style", ["action"])
            )
        ),
        "avg_session_length": game_data.get(
            "avg_session",
            get_avg_session_length(game_data.get("time_tags", [30, 60]))
        ),
        "subscription_services": game_data.get("subscriptions", []),
        "content_warnings": game_data.get("warnings", []),
        "store_links": game_data.get("store_links", {})
    }

    return game


def format_game_dict(game: dict, indent: int = 4) -> str:
    """Format a game dictionary as Python code."""
    lines = ["{"]
    ind = " " * indent

    for key, value in game.items():
        if isinstance(value, str):
            # Escape quotes in strings
            escaped = value.replace("\\", "\\\\").replace('"', '\\"')
            lines.append(f'{ind}"{key}": "{escaped}",')
        elif isinstance(value, dict):
            if not value:
                lines.append(f'{ind}"{key}": {{}},')
            else:
                dict_str = json.dumps(value, ensure_ascii=False)
                lines.append(f'{ind}"{key}": {dict_str},')
        elif isinstance(value, list):
            list_str = json.dumps(value, ensure_ascii=False)
            lines.append(f'{ind}"{key}": {list_str},')
        else:
            lines.append(f'{ind}"{key}": {value},')

    lines.append("}")
    return "\n    ".join(lines)


def generate_seed_file(category: str, games: list, output_path: Path):
    """Generate a seed file from game data."""

    header = f'''"""
PlayNxt Game Seeder - {category.replace("_", " ").title()} Games

Auto-generated seed file with {len(games)} games.
Run with: python -m scripts.seed_games_{category}
"""

import os
import sys
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from google.cloud import firestore
from dotenv import load_dotenv

load_dotenv()

SEED_GAMES = [
'''

    footer = f''']


def seed_games():
    """Seed the Firestore database with {category.replace("_", " ")} games."""
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("FIREBASE_PROJECT_ID")
    if not project_id:
        project_id = "playnxt"

    db = firestore.Client(project=project_id)
    games_ref = db.collection("games")

    print(f"Seeding {{len(SEED_GAMES)}} {category.replace("_", " ")} games to Firestore...")

    for game_data in SEED_GAMES:
        # Add timestamps
        game_data["created_at"] = datetime.utcnow()
        game_data["updated_at"] = datetime.utcnow()

        # Use game_id as document ID
        doc_ref = games_ref.document(game_data["game_id"])
        doc_ref.set(game_data, merge=True)
        print(f"  + Added: {{game_data['title']}}")

    print(f"\\nSuccessfully seeded {{len(SEED_GAMES)}} games!")


if __name__ == "__main__":
    seed_games()
'''

    # Build the games list
    games_code = []
    for game in games:
        expanded = expand_game(game)
        games_code.append("    " + format_game_dict(expanded))

    content = header + ",\n".join(games_code) + footer

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"Generated {output_path} with {len(games)} games")


def load_game_data(category: str) -> list:
    """Load game data from JSON file."""
    json_path = DATA_DIR / f"{category}.json"
    if not json_path.exists():
        print(f"Warning: {json_path} not found")
        return []

    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


def check_duplicates(all_games: dict) -> list:
    """Check for duplicate game IDs across all categories."""
    seen = {}
    duplicates = []

    for category, games in all_games.items():
        for game in games:
            game_id = game["id"]
            if game_id in seen:
                duplicates.append(f"{game_id} appears in both {seen[game_id]} and {category}")
            else:
                seen[game_id] = category

    return duplicates


def main():
    """Generate all seed files from game data."""
    categories = ["wind_down", "casual", "focused", "intense"]

    # Create data directory if needed
    DATA_DIR.mkdir(exist_ok=True)

    all_games = {}
    total_games = 0

    for category in categories:
        games = load_game_data(category)
        if games:
            all_games[category] = games
            total_games += len(games)

            output_path = SCRIPT_DIR / f"seed_games_{category}.py"
            generate_seed_file(category, games, output_path)

    # Check for duplicates
    duplicates = check_duplicates(all_games)
    if duplicates:
        print("\n[WARNING] Duplicate game IDs found:")
        for dup in duplicates:
            print(f"  - {dup}")
    else:
        print("\n[OK] No duplicate game IDs found")

    print(f"\nTotal games across all categories: {total_games}")


if __name__ == "__main__":
    main()
