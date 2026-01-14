"""
Add store links to games.

This script adds purchase links to games in the JSON files.
Run this after creating/updating games to add store URLs.
"""

import json
from pathlib import Path


# Store links mapping for popular games
# Format: game_id -> { store: url }
STORE_LINKS = {
    # Casual games
    "mario-kart-8-deluxe": {
        "nintendo": "https://www.nintendo.com/us/store/products/mario-kart-8-deluxe-switch/"
    },
    "fall-guys": {
        "steam": "https://store.steampowered.com/app/1097150/Fall_Guys/",
        "playstation": "https://store.playstation.com/en-us/product/UP4064-PPSA02029_00-FALLGUYSPS5US001",
        "xbox": "https://www.xbox.com/en-US/games/store/fall-guys/9PMXH5249DG5",
        "nintendo": "https://www.nintendo.com/us/store/products/fall-guys-switch/",
        "epic": "https://store.epicgames.com/en-US/p/fall-guys"
    },
    "among-us": {
        "steam": "https://store.steampowered.com/app/945360/Among_Us/",
        "playstation": "https://store.playstation.com/en-us/product/UP2590-PPSA04893_00-YOUREWELCOME0000",
        "xbox": "https://www.xbox.com/en-US/games/store/among-us/9NG07QJNK38J",
        "nintendo": "https://www.nintendo.com/us/store/products/among-us-switch/",
        "epic": "https://store.epicgames.com/en-US/p/among-us"
    },
    "rocket-league": {
        "steam": "https://store.steampowered.com/app/252950/Rocket_League/",
        "playstation": "https://store.playstation.com/en-us/product/UP2002-CUSA01163_00-RLODDLFULLGAMENA",
        "xbox": "https://www.xbox.com/en-US/games/store/rocket-league/C125W9BG2K0V",
        "nintendo": "https://www.nintendo.com/us/store/products/rocket-league-switch/",
        "epic": "https://store.epicgames.com/en-US/p/rocket-league"
    },
    "overcooked-2": {
        "steam": "https://store.steampowered.com/app/728880/Overcooked_2/",
        "playstation": "https://store.playstation.com/en-us/product/UP4064-CUSA10940_00-YOUREWELCOME0000",
        "xbox": "https://www.xbox.com/en-US/games/store/overcooked-2/BNTMPL5DH4RB",
        "nintendo": "https://www.nintendo.com/us/store/products/overcooked-2-switch/"
    },
    "minecraft": {
        "steam": None,  # Not on Steam
        "playstation": "https://store.playstation.com/en-us/product/UP4433-CUSA00744_00-YOUREWELCOME0000",
        "xbox": "https://www.xbox.com/en-US/games/store/minecraft/9NBLGGH537BL",
        "nintendo": "https://www.nintendo.com/us/store/products/minecraft-switch/"
    },
    "terraria": {
        "steam": "https://store.steampowered.com/app/105600/Terraria/",
        "playstation": "https://store.playstation.com/en-us/product/UP4040-CUSA00740_00-YOUREWELCOME0000",
        "xbox": "https://www.xbox.com/en-US/games/store/terraria/BQQM9J5GJ0QH",
        "nintendo": "https://www.nintendo.com/us/store/products/terraria-switch/",
        "gog": "https://www.gog.com/en/game/terraria"
    },
    "splatoon-3": {
        "nintendo": "https://www.nintendo.com/us/store/products/splatoon-3-switch/"
    },

    # Wind-down games
    "stardew-valley": {
        "steam": "https://store.steampowered.com/app/413150/Stardew_Valley/",
        "playstation": "https://store.playstation.com/en-us/product/UP2456-CUSA06840_00-YOUREWELCOME0000",
        "xbox": "https://www.xbox.com/en-US/games/store/stardew-valley/C3D891Z6TNQM",
        "nintendo": "https://www.nintendo.com/us/store/products/stardew-valley-switch/",
        "gog": "https://www.gog.com/en/game/stardew_valley"
    },
    "unpacking": {
        "steam": "https://store.steampowered.com/app/1135690/Unpacking/",
        "playstation": "https://store.playstation.com/en-us/product/UP3864-PPSA07101_00-YOUREWELCOME0000",
        "xbox": "https://www.xbox.com/en-US/games/store/unpacking/9PGKDKWHMQVV",
        "nintendo": "https://www.nintendo.com/us/store/products/unpacking-switch/",
        "gog": "https://www.gog.com/en/game/unpacking"
    },
    "animal-crossing-new-horizons": {
        "nintendo": "https://www.nintendo.com/us/store/products/animal-crossing-new-horizons-switch/"
    },
    "coffee-talk": {
        "steam": "https://store.steampowered.com/app/914800/Coffee_Talk/",
        "playstation": "https://store.playstation.com/en-us/product/UP4127-CUSA17498_00-YOUREWELCOME0000",
        "xbox": "https://www.xbox.com/en-US/games/store/coffee-talk/9PHCRFQ1F5M6",
        "nintendo": "https://www.nintendo.com/us/store/products/coffee-talk-switch/",
        "gog": "https://www.gog.com/en/game/coffee_talk"
    },
    "a-short-hike": {
        "steam": "https://store.steampowered.com/app/1055540/A_Short_Hike/",
        "nintendo": "https://www.nintendo.com/us/store/products/a-short-hike-switch/",
        "epic": "https://store.epicgames.com/en-US/p/a-short-hike"
    },

    # Focused games
    "hades": {
        "steam": "https://store.steampowered.com/app/1145360/Hades/",
        "playstation": "https://store.playstation.com/en-us/product/UP2809-CUSA18779_00-YOUREWELCOME0000",
        "xbox": "https://www.xbox.com/en-US/games/store/hades/9P8DL6W0JBBL",
        "nintendo": "https://www.nintendo.com/us/store/products/hades-switch/",
        "epic": "https://store.epicgames.com/en-US/p/hades"
    },
    "hollow-knight": {
        "steam": "https://store.steampowered.com/app/367520/Hollow_Knight/",
        "playstation": "https://store.playstation.com/en-us/product/UP1822-CUSA13632_00-YOUREWELCOME0000",
        "xbox": "https://www.xbox.com/en-US/games/store/hollow-knight-voidheart-edition/9MW9469V91LM",
        "nintendo": "https://www.nintendo.com/us/store/products/hollow-knight-switch/",
        "gog": "https://www.gog.com/en/game/hollow_knight"
    },
    "celeste": {
        "steam": "https://store.steampowered.com/app/504230/Celeste/",
        "playstation": "https://store.playstation.com/en-us/product/UP2120-CUSA11302_00-YOUREWELCOME0000",
        "xbox": "https://www.xbox.com/en-US/games/store/celeste/BWMQL2RPWM3W",
        "nintendo": "https://www.nintendo.com/us/store/products/celeste-switch/",
        "epic": "https://store.epicgames.com/en-US/p/celeste"
    },
    "dead-cells": {
        "steam": "https://store.steampowered.com/app/588650/Dead_Cells/",
        "playstation": "https://store.playstation.com/en-us/product/UP4016-CUSA11253_00-YOUREWELCOME0000",
        "xbox": "https://www.xbox.com/en-US/games/store/dead-cells/C1G0HBRKXVLZ",
        "nintendo": "https://www.nintendo.com/us/store/products/dead-cells-switch/",
        "gog": "https://www.gog.com/en/game/dead_cells"
    },
    "slay-the-spire": {
        "steam": "https://store.steampowered.com/app/646570/Slay_the_Spire/",
        "playstation": "https://store.playstation.com/en-us/product/UP3864-CUSA14275_00-YOUREWELCOME0000",
        "xbox": "https://www.xbox.com/en-US/games/store/slay-the-spire/9NZ4QWS2NLBX",
        "nintendo": "https://www.nintendo.com/us/store/products/slay-the-spire-switch/",
        "gog": "https://www.gog.com/en/game/slay_the_spire"
    },
    "into-the-breach": {
        "steam": "https://store.steampowered.com/app/590380/Into_the_Breach/",
        "nintendo": "https://www.nintendo.com/us/store/products/into-the-breach-switch/",
        "gog": "https://www.gog.com/en/game/into_the_breach",
        "epic": "https://store.epicgames.com/en-US/p/into-the-breach"
    },

    # Intense games
    "elden-ring": {
        "steam": "https://store.steampowered.com/app/1245620/ELDEN_RING/",
        "playstation": "https://store.playstation.com/en-us/product/UP0700-CUSA18444_00-YOUREWELCOME0000",
        "xbox": "https://www.xbox.com/en-US/games/store/elden-ring/9P3J32CTXLRZ"
    },
    "sekiro-shadows-die-twice": {
        "steam": "https://store.steampowered.com/app/814380/Sekiro_Shadows_Die_Twice__GOTY_Edition/",
        "playstation": "https://store.playstation.com/en-us/product/UP0002-CUSA12047_00-YOUREWELCOME0000",
        "xbox": "https://www.xbox.com/en-US/games/store/sekiro-shadows-die-twice-goty-edition/BQMV3V9RGLJH"
    },
    "dark-souls-3": {
        "steam": "https://store.steampowered.com/app/374320/DARK_SOULS_III/",
        "playstation": "https://store.playstation.com/en-us/product/UP0700-CUSA03388_00-YOUREWELCOME0000",
        "xbox": "https://www.xbox.com/en-US/games/store/dark-souls-iii/BW2XDRNSCCPZ"
    },
    "doom-eternal": {
        "steam": "https://store.steampowered.com/app/782330/DOOM_Eternal/",
        "playstation": "https://store.playstation.com/en-us/product/UP1003-CUSA13314_00-YOUREWELCOME0000",
        "xbox": "https://www.xbox.com/en-US/games/store/doom-eternal-standard-edition/9PHMQ4GRZBNT",
        "nintendo": "https://www.nintendo.com/us/store/products/doom-eternal-switch/"
    },
    "monster-hunter-rise": {
        "steam": "https://store.steampowered.com/app/1446780/MONSTER_HUNTER_RISE/",
        "playstation": "https://store.playstation.com/en-us/product/UP0102-PPSA06471_00-YOUREWELCOME0000",
        "xbox": "https://www.xbox.com/en-US/games/store/monster-hunter-rise/9NV1GCVLBWQG",
        "nintendo": "https://www.nintendo.com/us/store/products/monster-hunter-rise-switch/"
    },
    "returnal": {
        "steam": "https://store.steampowered.com/app/1649240/Returnal/",
        "playstation": "https://store.playstation.com/en-us/product/UP9000-CUSA28437_00-YOUREWELCOME0000"
    },
    "sifu": {
        "steam": "https://store.steampowered.com/app/2138710/Sifu/",
        "playstation": "https://store.playstation.com/en-us/product/UP2012-PPSA03877_00-YOUREWELCOME0000",
        "nintendo": "https://www.nintendo.com/us/store/products/sifu-switch/",
        "epic": "https://store.epicgames.com/en-US/p/sifu"
    }
}


def add_store_links_to_file(filepath: Path):
    """Add store links to games in a JSON file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        games = json.load(f)

    updated_count = 0
    for game in games:
        game_id = game.get("id", "")
        if game_id in STORE_LINKS:
            # Filter out None values
            links = {k: v for k, v in STORE_LINKS[game_id].items() if v is not None}
            if links:
                game["store_links"] = links
                updated_count += 1
                print(f"  + Added store links to: {game.get('title', game_id)}")

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(games, f, indent=2, ensure_ascii=False)

    return updated_count


def main():
    """Add store links to all game JSON files."""
    script_dir = Path(__file__).parent
    data_dir = script_dir / "games_data"

    files = ["wind_down.json", "casual.json", "focused.json", "intense.json"]
    total_updated = 0

    for filename in files:
        filepath = data_dir / filename
        if filepath.exists():
            print(f"\nProcessing {filename}...")
            updated = add_store_links_to_file(filepath)
            total_updated += updated
            print(f"  Updated {updated} games")
        else:
            print(f"Warning: {filepath} not found")

    print(f"\n=== Total games updated with store links: {total_updated} ===")


if __name__ == "__main__":
    main()
