import firebase_admin
from firebase_admin import credentials, firestore
import os

# Initialize Firebase
if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {'projectId': 'playnxt-1a2c6'})

db = firestore.client()

# Get all games
games_ref = db.collection('games')
docs = list(games_ref.stream())

print(f"Total games in database: {len(docs)}")

# Simulate the filtering logic
TIME_BRACKETS = {
    15: [15],
    30: [15, 30],
    60: [15, 30, 60],
    90: [15, 30, 60, 90],
    120: [15, 30, 60, 90, 120],
}

MOOD_TO_ENERGY = {
    "wind_down": "low",
    "casual": "low",
    "focused": "medium",
    "intense": "high",
}

# Test case: 60 minutes, casual mood, handheld only
time_available = 60
energy_mood = "casual"
platforms = ["handheld"]

time_tags = TIME_BRACKETS.get(time_available, [time_available])
target_energy = MOOD_TO_ENERGY.get(energy_mood)

games = [doc.to_dict() | {"game_id": doc.id} for doc in docs]
print(f"Games loaded: {len(games)}")

# Filter by time
filtered = [g for g in games if any(t in g.get("time_tags", []) for t in time_tags)]
print(f"After time filter (tags {time_tags}): {len(filtered)} games")

# Filter by energy (with adjacent compatibility)
def energy_compatible(game_energy, target):
    energy_order = ["low", "medium", "high"]
    try:
        game_idx = energy_order.index(game_energy)
        target_idx = energy_order.index(target)
        return abs(game_idx - target_idx) <= 1
    except (ValueError, IndexError):
        return False

energy_filtered = [
    g for g in filtered
    if g.get("energy_level") == target_energy or energy_compatible(g.get("energy_level"), target_energy)
]
print(f"After energy filter ({target_energy} with adjacent): {len(energy_filtered)} games")

# Filter by platform
platform_filtered = [
    g for g in energy_filtered
    if any(p in g.get("platforms", []) for p in platforms)
]
print(f"After platform filter ({platforms}): {len(platform_filtered)} games")

# Show some examples
if platform_filtered:
    print("\nSample matching games:")
    for g in platform_filtered[:5]:
        print(f"  - {g['title']} | platforms: {g['platforms']} | time_tags: {g.get('time_tags', [])} | energy: {g.get('energy_level')}")
else:
    print("\nNo games matched all filters!")
    
    # Debug: Check if there are any handheld games with time_tags
    handheld_with_time = [g for g in games if 'handheld' in g.get('platforms', []) and any(t in g.get('time_tags', []) for t in time_tags)]
    print(f"\nHandheld games with matching time tags: {len(handheld_with_time)}")
    
    if handheld_with_time:
        print("Examples:")
        for g in handheld_with_time[:3]:
            print(f"  - {g['title']} | energy: {g.get('energy_level')}")
