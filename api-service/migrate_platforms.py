"""
Migration script to update game platforms from legacy values to new specific values.

Mapping:
- console -> playstation, xbox (games available on both)
- handheld -> switch (most handheld games are Switch)
- Some handheld-only games may be mobile (Monument Valley, etc.)

This script analyzes the data and applies smart mapping based on game metadata.
"""

import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase
if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {'projectId': 'playnxt-1a2c6'})

db = firestore.client()

# Games that are mobile-only or primarily mobile
MOBILE_GAMES = {
    'monument-valley', 'monument-valley-2', 'prune', 'altos-adventure', 'altos-odyssey',
    'marvel-snap', 'pokemon-tcg-live', 'hearthstone', 'legends-of-runeterra',
    'magic-the-gathering-arena', 'yu-gi-oh-master-duel', 'dr-mario'
}

# Games that are Switch exclusive (Nintendo first-party/exclusive)
SWITCH_EXCLUSIVE = {
    'animal-crossing-new-horizons', 'advance-wars-12-reboot-camp', 'bayonetta-3',
    'breath-of-the-wild', 'captain-toad-treasure-tracker', 'donkey-kong-country-tropical-freeze',
    'fire-emblem-engage', 'fire-emblem-three-houses', 'kirby-and-the-forgotten-land',
    'links-awakening', 'luigis-mansion-3', 'mario-kart-8-deluxe', 'mario-rabbids-sparks-of-hope',
    'metroid-dread', 'new-super-mario-bros-u-deluxe', 'pikmin-4', 'portal-companion-collection',
    'rhythm-heaven-megamix', 'snipperclips', 'splatoon-3', 'super-mario-3d-world-bowsers-fury',
    'super-smash-bros-ultimate', 'tears-of-the-kingdom', 'tetris-99', 'warioware-get-it-together',
    'xenoblade-chronicles-3', 'yoshis-crafted-world'
}

def migrate_platforms():
    games_ref = db.collection('games')
    docs = list(games_ref.stream())
    
    updated_count = 0
    skipped_count = 0
    
    for doc in docs:
        data = doc.to_dict()
        game_id = doc.id
        old_platforms = data.get('platforms', [])
        
        # Skip if already migrated (has new platform values)
        if any(p in old_platforms for p in ['playstation', 'xbox', 'switch', 'mobile']):
            skipped_count += 1
            continue
        
        new_platforms = []
        
        for platform in old_platforms:
            if platform == 'pc':
                new_platforms.append('pc')
            elif platform == 'console':
                # Most console games are on both PlayStation and Xbox
                new_platforms.append('playstation')
                new_platforms.append('xbox')
            elif platform == 'handheld':
                # Determine if it's Switch or Mobile
                if game_id in MOBILE_GAMES:
                    new_platforms.append('mobile')
                elif game_id in SWITCH_EXCLUSIVE:
                    new_platforms.append('switch')
                else:
                    # Default: assume Switch (most common handheld platform for premium games)
                    # Also add mobile if it seems like a mobile-friendly game
                    new_platforms.append('switch')
        
        # Remove duplicates while preserving order
        new_platforms = list(dict.fromkeys(new_platforms))
        
        if new_platforms != old_platforms:
            print(f"Updating {game_id}: {old_platforms} -> {new_platforms}")
            doc.reference.update({'platforms': new_platforms})
            updated_count += 1
    
    print(f"\nMigration complete!")
    print(f"Updated: {updated_count} games")
    print(f"Skipped (already migrated): {skipped_count} games")

if __name__ == '__main__':
    print("Starting platform migration...")
    migrate_platforms()
