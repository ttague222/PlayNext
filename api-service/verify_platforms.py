import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {'projectId': 'playnxt-1a2c6'})

db = firestore.client()
games_ref = db.collection('games')
docs = list(games_ref.stream())

platform_counts = {}
for doc in docs:
    platforms = doc.to_dict().get('platforms', [])
    for p in platforms:
        platform_counts[p] = platform_counts.get(p, 0) + 1

print("Platform distribution:")
for platform, count in sorted(platform_counts.items(), key=lambda x: -x[1]):
    print(f"  {platform}: {count} games")
