"""
Migration script to update game platforms in Python seed files from legacy values to specific values.

This script uses regex to find and replace platform arrays in Python files.
"""

import re
import os
from pathlib import Path

# Games that are mobile-only or primarily mobile
MOBILE_GAMES = {
    'monument-valley', 'monument-valley-2', 'prune', 'altos-adventure', 'altos-odyssey',
    'marvel-snap', 'pokemon-tcg-live', 'hearthstone', 'legends-of-runeterra',
    'magic-the-gathering-arena', 'yu-gi-oh-master-duel', 'dr-mario', 'pokemon-go',
    'clash-royale', 'brawl-stars', 'candy-crush', 'among-us-mobile', 'genshin-impact-mobile',
    'call-of-duty-mobile', 'pubg-mobile', 'mobile-legends', 'arena-of-valor',
    'fire-emblem-heroes', 'mario-kart-tour', 'pokemon-unite-mobile'
}

# Games that are Switch exclusive (won't also get playstation/xbox from console tag)
SWITCH_EXCLUSIVE = {
    'animal-crossing-new-horizons', 'advance-wars-12-reboot-camp', 'bayonetta-3',
    'breath-of-the-wild', 'captain-toad-treasure-tracker', 'donkey-kong-country-tropical-freeze',
    'fire-emblem-engage', 'fire-emblem-three-houses', 'kirby-and-the-forgotten-land',
    'links-awakening', 'luigis-mansion-3', 'mario-kart-8-deluxe', 'mario-rabbids-sparks-of-hope',
    'metroid-dread', 'new-super-mario-bros-u-deluxe', 'pikmin-4', 'pikmin-3-deluxe',
    'rhythm-heaven-megamix', 'snipperclips', 'splatoon-3', 'super-mario-3d-world-bowsers-fury',
    'super-smash-bros-ultimate', 'tears-of-the-kingdom', 'tetris-99', 'warioware-get-it-together',
    'xenoblade-chronicles-3', 'yoshis-crafted-world', 'pokemon-legends-arceus',
    'pokemon-scarlet-violet', 'pokemon-sword-shield', 'pokemon-brilliant-diamond-shining-pearl',
    'super-mario-odyssey', 'super-mario-bros-wonder', 'zelda-echoes-of-wisdom',
    'mario-party-superstars', 'nintendo-switch-sports', 'ring-fit-adventure',
    'astral-chain', 'xenoblade-chronicles-definitive', 'paper-mario-origami-king'
}

# Games that are PlayStation exclusive
PLAYSTATION_EXCLUSIVE = {
    'astro-bot', 'astros-playroom', 'bloodborne', 'demons-souls', 'demons-souls-remake',
    'ghost-of-tsushima', 'god-of-war-ragnarok', 'god-of-war-2018', 'grans-turismo-7',
    'horizon-forbidden-west', 'horizon-zero-dawn', 'the-last-of-us', 'the-last-of-us-part-ii',
    'marvels-spider-man', 'marvels-spider-man-2', 'marvels-spider-man-miles-morales',
    'ratchet-and-clank-rift-apart', 'returnal', 'uncharted-4', 'uncharted-legacy-of-thieves',
    'until-dawn', 'days-gone', 'infamous-second-son', 'killzone-shadow-fall', 'littlebigplanet-3',
    'sackboy-a-big-adventure', 'dreams', 'concrete-genie', 'death-stranding'
}

# Games that are Xbox exclusive
XBOX_EXCLUSIVE = {
    'halo-infinite', 'halo-master-chief-collection', 'forza-horizon-5', 'forza-motorsport',
    'gears-5', 'gears-tactics', 'sea-of-thieves', 'grounded', 'pentiment', 'hi-fi-rush',
    'starfield', 'redfall', 'flight-simulator', 'age-of-empires-4', 'psychonauts-2',
    'ori-and-the-will-of-the-wisps', 'ori-and-the-blind-forest', 'state-of-decay-2',
    'sunset-overdrive', 'quantum-break', 'ryse-son-of-rome'
}


def migrate_platforms(game_id: str, old_platforms: list[str]) -> list[str]:
    """Convert legacy platform values to specific platform values."""
    new_platforms = []

    for platform in old_platforms:
        if platform == 'pc':
            new_platforms.append('pc')
        elif platform == 'console':
            # Check for exclusives first
            if game_id in SWITCH_EXCLUSIVE:
                pass  # Switch exclusive, don't add PS/Xbox
            elif game_id in PLAYSTATION_EXCLUSIVE:
                new_platforms.append('playstation')
            elif game_id in XBOX_EXCLUSIVE:
                new_platforms.append('xbox')
            else:
                new_platforms.append('playstation')
                new_platforms.append('xbox')
        elif platform == 'handheld':
            if game_id in MOBILE_GAMES:
                new_platforms.append('mobile')
            else:
                new_platforms.append('switch')
        elif platform in ['playstation', 'xbox', 'switch', 'mobile']:
            new_platforms.append(platform)
        else:
            new_platforms.append(platform)

    # Remove duplicates while preserving order
    seen = set()
    unique_platforms = []
    for p in new_platforms:
        if p not in seen:
            seen.add(p)
            unique_platforms.append(p)

    return unique_platforms


def process_python_file(filepath: Path, dry_run: bool = False) -> dict:
    """Process a single Python file and migrate platforms."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    stats = {
        'updated': 0,
        'changes': []
    }

    # Pattern to find game entries with game_id and platforms
    # This matches the structure: {"game_id": "xxx", ... "platforms": [...], ...}
    game_pattern = re.compile(
        r'("game_id":\s*"([^"]+)".*?"platforms":\s*\[([^\]]+)\])',
        re.DOTALL
    )

    def replace_platforms(match):
        full_match = match.group(1)
        game_id = match.group(2)
        platforms_str = match.group(3)

        # Parse the platforms list
        old_platforms = re.findall(r'"([^"]+)"', platforms_str)

        # Check if migration needed
        if not any(p in old_platforms for p in ['console', 'handheld']):
            return full_match

        new_platforms = migrate_platforms(game_id, old_platforms)

        if new_platforms != old_platforms:
            stats['changes'].append({
                'game_id': game_id,
                'old': old_platforms,
                'new': new_platforms
            })
            stats['updated'] += 1

            # Create new platforms string
            new_platforms_str = ', '.join(f'"{p}"' for p in new_platforms)

            # Replace just the platforms array in the match
            new_match = re.sub(
                r'"platforms":\s*\[[^\]]+\]',
                f'"platforms": [{new_platforms_str}]',
                full_match
            )
            return new_match

        return full_match

    new_content = game_pattern.sub(replace_platforms, content)

    if not dry_run and stats['updated'] > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)

    return stats


def main(dry_run: bool = True):
    """Main function to process all Python seed files."""
    scripts_dir = Path(__file__).parent

    print(f"{'DRY RUN - ' if dry_run else ''}Processing Python seed files in {scripts_dir}")
    print("=" * 60)

    total_updated = 0

    for py_file in sorted(scripts_dir.glob('seed_games*.py')):
        if py_file.name == 'seed_from_json.py':
            continue

        print(f"\nFile: {py_file.name}")
        print("-" * 40)

        stats = process_python_file(py_file, dry_run=dry_run)
        total_updated += stats['updated']

        print(f"  Updated: {stats['updated']}")

        if stats['changes']:
            print(f"\n  Changes:")
            for change in stats['changes'][:10]:
                print(f"    - {change['game_id']}: {change['old']} -> {change['new']}")
            if len(stats['changes']) > 10:
                print(f"    ... and {len(stats['changes']) - 10} more")

    print("\n" + "=" * 60)
    print(f"Total updated: {total_updated}")

    if dry_run:
        print("\n[!] This was a DRY RUN. No files were modified.")
        print("   Run with --apply to make changes.")


if __name__ == '__main__':
    import sys
    dry_run = '--apply' not in sys.argv
    main(dry_run=dry_run)
