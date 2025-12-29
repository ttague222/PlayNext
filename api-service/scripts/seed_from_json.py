"""
Seed games from JSON files to Firestore.

This script reads from the JSON files in games_data/ and seeds them to Firestore.
Use this after updating the JSON files with new data.
"""

import os
import json
from datetime import datetime
from pathlib import Path
from google.cloud import firestore


def load_games_from_json():
    """Load all games from JSON files."""
    script_dir = Path(__file__).parent
    data_dir = script_dir / "games_data"

    all_games = []
    files = ["wind_down.json", "casual.json", "focused.json", "intense.json"]

    # Map file to energy level
    energy_map = {
        "wind_down.json": "low",
        "casual.json": "medium",
        "focused.json": "medium",
        "intense.json": "high"
    }

    for filename in files:
        filepath = data_dir / filename
        if filepath.exists():
            with open(filepath, 'r', encoding='utf-8') as f:
                games = json.load(f)
                # Ensure energy level is set
                for game in games:
                    if "energy" not in game or not game["energy"]:
                        game["energy"] = energy_map.get(filename, "medium")
                    # Map 'energy' to 'energy_level' for consistency with API
                    game["energy_level"] = game.get("energy", "medium")
                all_games.extend(games)
                print(f"Loaded {len(games)} games from {filename}")
        else:
            print(f"Warning: {filepath} not found")

    return all_games


def generate_explanation_templates(game):
    """Generate explanation templates based on game attributes."""
    templates = {}

    energy = game.get("energy_level", game.get("energy", "medium"))
    stop = game.get("stop_friendliness", "checkpoints")
    time_to_fun = game.get("time_to_fun", "medium")
    play_styles = game.get("play_style", [])
    moods = game.get("moods", [])

    # Mood fit based on energy level
    mood_templates = {
        "low": "Perfect for unwinding - gentle pace lets you relax.",
        "medium": "Balanced experience that keeps you engaged without overwhelming.",
        "high": "High-energy gameplay for when you want intensity."
    }
    templates["mood_fit"] = mood_templates.get(energy, mood_templates["medium"])

    # Stop fit based on stop_friendliness
    stop_templates = {
        "anytime": "Save and quit whenever - no progress lost.",
        "checkpoints": "Regular checkpoints let you pause when needed.",
        "commitment": "Best enjoyed in longer sessions."
    }
    templates["stop_fit"] = stop_templates.get(stop, stop_templates["checkpoints"])

    # Style fit based on play_style
    style_messages = {
        "narrative": "Rich storytelling pulls you into the experience.",
        "action": "Fast-paced action keeps the adrenaline flowing.",
        "puzzle_strategy": "Satisfying puzzles and strategic thinking.",
        "sandbox_creative": "Freedom to create and explore at your pace."
    }
    if play_styles:
        primary_style = play_styles[0]
        templates["style_fit"] = style_messages.get(primary_style, "Great gameplay variety.")

    # Time fit template (will be filled with actual time during recommendation)
    time_templates = {
        "short": "Quick to jump in - you'll be having fun in minutes.",
        "medium": "Easy to get into with a bit of learning.",
        "long": "Worth the initial investment to master."
    }
    templates["time_fit"] = time_templates.get(time_to_fun, time_templates["medium"])

    return templates


def transform_game_data(game):
    """Transform JSON game data to Firestore format."""
    # Create game_id from id
    game_id = game.get("id", "")

    # Generate explanation templates
    explanation_templates = generate_explanation_templates(game)

    return {
        "game_id": game_id,
        "title": game.get("title", ""),
        "platforms": game.get("platforms", []),
        "year": game.get("year"),
        "genres": game.get("genres", []),
        "time_tags": game.get("time_tags", []),
        "energy_level": game.get("energy_level", game.get("energy", "medium")),
        "moods": game.get("moods", []),
        "play_style": game.get("play_style", []),
        "time_to_fun": game.get("time_to_fun", "medium"),
        "stop_friendliness": game.get("stop_friendliness", "checkpoints"),
        "multiplayer_modes": game.get("multiplayer", []),
        "description_short": game.get("description", ""),
        "fun_fact": game.get("fun_fact"),
        "subscription_services": game.get("subscriptions", []),
        "franchise": game.get("franchise"),
        "warnings": game.get("warnings", []),
        "explanation_templates": explanation_templates,
    }


def seed_games():
    """Seed the Firestore database with games from JSON files."""
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("FIREBASE_PROJECT_ID")
    if not project_id:
        project_id = "playnxt-1a2c6"

    print(f"Using project: {project_id}")

    db = firestore.Client(project=project_id)
    games_ref = db.collection("games")

    games = load_games_from_json()
    print(f"\nSeeding {len(games)} total games to Firestore...")

    success_count = 0
    for game in games:
        game_data = transform_game_data(game)

        if not game_data["game_id"]:
            print(f"  ! Skipping game without ID: {game.get('title', 'Unknown')}")
            continue

        # Add timestamps
        game_data["created_at"] = datetime.utcnow()
        game_data["updated_at"] = datetime.utcnow()

        # Use game_id as document ID, merge to preserve any existing data
        doc_ref = games_ref.document(game_data["game_id"])
        doc_ref.set(game_data, merge=True)
        success_count += 1

    print(f"\nSuccessfully seeded {success_count} games!")


if __name__ == "__main__":
    seed_games()
