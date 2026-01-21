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
docs = games_ref.stream()

handheld_games = []
all_platforms = set()

for doc in docs:
    data = doc.to_dict()
    platforms = data.get('platforms', [])
    all_platforms.update(platforms)
    
    if 'handheld' in platforms:
        handheld_games.append({
            'id': doc.id,
            'title': data.get('title'),
            'platforms': platforms
        })

print(f"\nAll platform values in database: {sorted(all_platforms)}")
print(f"\nTotal games with 'handheld' platform: {len(handheld_games)}")
print("\nHandheld games:")
for g in handheld_games:
    print(f"  - {g['title']} ({g['platforms']})")
