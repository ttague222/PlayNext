"""
Script to add franchise tags and subscription services data to game seed files.

This adds:
1. 'franchise' field to link games in the same series
2. Additional subscription services beyond Xbox Game Pass
"""

import json
import os
from pathlib import Path

# Franchise mappings - games that belong to the same franchise
FRANCHISE_MAPPINGS = {
    # Ori series
    "ori": ["ori-blind-forest", "ori-will-of-wisps", "ori-collection"],
    # Monument Valley
    "monument_valley": ["monument-valley", "monument-valley-2"],
    # Alto series
    "alto": ["alto-adventure", "alto-odyssey"],
    # Slime Rancher
    "slime_rancher": ["slime-rancher", "slime-rancher-2"],
    # My Time series
    "my_time": ["my-time-at-portia", "my-time-at-sandrock"],
    # Coffee Talk
    "coffee_talk": ["coffee-talk", "coffee-talk-2"],
    # Unpacking
    "unpacking": ["unpacking", "unpacking-2", "unpacking-dlc", "unpacking-zen"],
    # Hades
    "hades": ["hades", "hades-2"],
    # Cuphead
    "cuphead": ["cuphead", "cuphead-dlc"],
    # Portal
    "portal": ["portal-2"],  # Just has Portal 2 in data
    # Mario series (various sub-franchises)
    "mario_kart": ["mario-kart-8-deluxe"],
    "super_mario": ["new-super-mario-bros-u", "super-mario-3d-world"],
    "luigi_mansion": ["luigis-mansion-3"],
    "yoshi": ["yoshis-crafted-world"],
    "donkey_kong": ["donkey-kong-country-tropical-freeze"],
    "kirby": ["kirby-forgotten-land"],
    # Crash series
    "crash_bandicoot": ["crash-bandicoot-4", "crash-team-racing-nf"],
    # Spyro
    "spyro": ["spyro-reignited"],
    # LEGO games
    "lego_star_wars": ["lego-star-wars-skywalker"],
    "lego_marvel": ["lego-marvel-superheroes-2"],
    "lego_dc": ["lego-dc-supervillains"],
    # Zelda
    "zelda": ["zelda-tears-of-kingdom", "zelda-breath-of-wild", "zelda-links-awakening"],
    # Persona
    "persona": ["persona-3-reload", "persona-4-golden", "persona-5-royal"],
    # Yakuza / Like a Dragon
    "yakuza": ["yakuza-0", "yakuza-like-a-dragon", "like-a-dragon-infinite-wealth"],
    # Souls series (FromSoftware)
    "souls": ["dark-souls-3", "demons-souls-remake"],
    "elden_ring": ["elden-ring"],  # Spiritual successor
    # DOOM
    "doom": ["doom-2016", "doom-eternal"],
    # God of War
    "god_of_war": ["god-of-war-2018", "god-of-war-ragnarok"],
    # Spider-Man
    "spider_man": ["spider-man-remastered", "spider-man-miles-morales", "spider-man-2"],
    # Star Wars Jedi
    "star_wars_jedi": ["star-wars-jedi-fallen-order", "star-wars-jedi-survivor"],
    # Horizon
    "horizon": ["horizon-zero-dawn", "horizon-forbidden-west"],
    # Cities Skylines
    "cities_skylines": ["cities-skylines", "cities-skylines-2"],
    # Frostpunk
    "frostpunk": ["frostpunk", "frostpunk-2"],
    # Two Point series
    "two_point": ["two-point-hospital", "two-point-campus"],
    # Kerbal Space Program
    "kerbal": ["kerbal-space-program", "kerbal-space-program-2"],
    # The Talos Principle
    "talos_principle": ["the-talos-principle", "the-talos-principle-2"],
    # Age of Empires
    "age_of_empires": ["age-of-empires-4"],
    "age_of_mythology": ["age-of-mythology-retold"],
    # Path of Exile
    "path_of_exile": ["path-of-exile", "path-of-exile-2"],
    # Unravel
    "unravel": ["unravel-two"],
    # Ghostrunner
    "ghostrunner": ["ghostrunner", "ghostrunner-2"],
    # Rogue Legacy
    "rogue_legacy": ["rogue-legacy-2"],
    # Hyper Light
    "hyper_light": ["hyper-light-drifter", "hyper-light-breaker"],
    # Little Nightmares
    "little_nightmares": ["little-nightmares", "little-nightmares-2", "little-nightmares-3"],
    # Outlast
    "outlast": ["outlast-trials"],
    # Resident Evil
    "resident_evil": ["resident-evil-4-remake", "resident-evil-village"],
    # Assassin's Creed
    "assassins_creed": ["assassins-creed-mirage", "assassins-creed-valhalla"],
    # Blasphemous
    "blasphemous": ["blasphemous", "blasphemous-2"],
    # Fire Emblem
    "fire_emblem": ["fire-emblem-three-houses", "fire-emblem-engage"],
    # Monster Hunter
    "monster_hunter": ["monster-hunter-world", "monster-hunter-rise"],
    # NieR
    "nier": ["nier-automata", "nier-replicant"],
    # Final Fantasy
    "final_fantasy": ["final-fantasy-vii-rebirth", "final-fantasy-xvi"],
    # Dragon Quest
    "dragon_quest": ["dragon-quest-xi"],
    # Xenoblade
    "xenoblade": ["xenoblade-chronicles-3"],
    # Octopath
    "octopath": ["octopath-traveler", "octopath-traveler-2"],
    # Total War Warhammer
    "total_war_warhammer": ["total-war-warhammer-3"],
    # Borderlands
    "borderlands": ["borderlands-3", "tiny-tinas-wonderlands"],
    # Diablo
    "diablo": ["diablo-4"],
    # Overcooked
    "overcooked": ["overcooked-2"],
    # Splatoon
    "splatoon": ["splatoon-3"],
    # Hollow Knight
    "hollow_knight": ["hollow-knight"],
    # Dead Cells
    "dead_cells": ["dead-cells"],
}

# Subscription services data
# Based on current 2024 availability
SUBSCRIPTION_SERVICES = {
    # PlayStation Plus Premium/Extra games
    "playstation_plus": [
        "stray",
        "spider-man-remastered",
        "spider-man-miles-morales",
        "god-of-war-2018",
        "returnal",
        "demons-souls-remake",
        "bloodborne",
        "ghost-of-tsushima",
        "ratchet-and-clank-rift-apart",
        "horizon-zero-dawn",
        "uncharted-4",
        "death-stranding",
        "days-gone",
        "sackboy-adventure",
        "celeste",
        "hollow-knight",
        "dead-cells",
        "hades",
    ],
    # EA Play games
    "ea_play": [
        "star-wars-jedi-fallen-order",
        "star-wars-jedi-survivor",
        "dead-space-remake",
        "mass-effect-legendary",
        "it-takes-two",
        "titanfall-2",
        "battlefield-2042",
        "fifa-24",
        "madden-24",
        "nhl-24",
        "f1-23",
        "need-for-speed-unbound",
        "dragon-age-inquisition",
        "plants-vs-zombies",
    ],
    # Nintendo Switch Online (SNES/NES classics, not individual games)
    "nintendo_switch_online": [
        # NSO doesn't include modern games, just classic library
    ],
    # Ubisoft+ games
    "ubisoft_plus": [
        "assassins-creed-mirage",
        "assassins-creed-valhalla",
        "far-cry-6",
        "rainbow-six-siege",
        "watch-dogs-legion",
        "riders-republic",
        "anno-1800",
        "the-division-2",
        "xdefiant",
    ],
    # Netflix Games (mobile)
    "netflix_games": [
        # Mobile games primarily
    ],
    # Apple Arcade
    "apple_arcade": [
        "alto-adventure",
        "alto-odyssey",
        "monument-valley",
        "monument-valley-2",
        "mini-metro",
        "grindstone",
        "what-the-golf",
        "sayonara-wild-hearts",
        "assemble-with-care",
    ],
    # Amazon Luna
    "amazon_luna": [
        # Overlaps with other services
    ],
}

# More Xbox Game Pass games to add
ADDITIONAL_XBOX_GAME_PASS = [
    "stardew-valley",
    "hollow-knight",
    "celeste",
    "dead-cells",
    "the-witness",
    "return-obra-dinn",
    "subnautica",
    "no-mans-sky",
    "starfield",
    "fallout-4",
    "fallout-76",
    "elder-scrolls-skyrim",
    "dishonored-2",
    "prey-2017",
    "deathloop",
    "ghostwire-tokyo",
    "redfall",
    "minecraft-dungeons",
    "state-of-decay-2",
    "gears-5",
    "gears-tactics",
    "halo-infinite",
    "halo-master-chief",
    "psychonauts-2",
    "a-plague-tale-requiem",
    "sniper-elite-5",
    "nobody-saves-world",
    "unpacking",
    "deaths-door",
    "twelve-minutes",
    "the-ascent",
    "somerville",
    "high-on-life",
    "weird-west",
    "shredders",
    "mlb-the-show",
    "cricket-22",
    "cricket-24",
    "payday-3",
    "starfield",
    "cocoon",
    "party-animals",
    "lies-of-p",
    "payday-3",
    "like-a-dragon-gaiden",
    "persona-3-reload",
]


def create_franchise_lookup():
    """Create reverse lookup from game ID to franchise."""
    lookup = {}
    for franchise, game_ids in FRANCHISE_MAPPINGS.items():
        for game_id in game_ids:
            lookup[game_id] = franchise
    return lookup


def get_subscriptions_for_game(game_id, current_subs):
    """Get all subscriptions a game is available on."""
    subs = set(current_subs) if current_subs else set()

    # Check each subscription service
    if game_id in ADDITIONAL_XBOX_GAME_PASS:
        subs.add("xbox_game_pass")

    for service, games in SUBSCRIPTION_SERVICES.items():
        if game_id in games:
            subs.add(service)

    return list(subs) if subs else None


def update_game_data(games, franchise_lookup):
    """Update games with franchise and subscription data."""
    updated_count = 0

    for game in games:
        game_id = game.get("id")
        if not game_id:
            continue

        # Add franchise if applicable
        if game_id in franchise_lookup:
            game["franchise"] = franchise_lookup[game_id]
            updated_count += 1

        # Update subscriptions
        current_subs = game.get("subscriptions", [])
        new_subs = get_subscriptions_for_game(game_id, current_subs)
        if new_subs:
            game["subscriptions"] = new_subs

    return games, updated_count


def process_file(filepath, franchise_lookup):
    """Process a single JSON file."""
    print(f"Processing {filepath}...")

    with open(filepath, 'r', encoding='utf-8') as f:
        games = json.load(f)

    updated_games, count = update_game_data(games, franchise_lookup)

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(updated_games, f, indent=2, ensure_ascii=False)

    print(f"  Updated {count} games with franchise data")
    return len(games)


def main():
    script_dir = Path(__file__).parent
    data_dir = script_dir / "games_data"

    franchise_lookup = create_franchise_lookup()

    files = [
        "wind_down.json",
        "casual.json",
        "focused.json",
        "intense.json"
    ]

    total_games = 0
    for filename in files:
        filepath = data_dir / filename
        if filepath.exists():
            total_games += process_file(filepath, franchise_lookup)
        else:
            print(f"File not found: {filepath}")

    print(f"\nTotal games processed: {total_games}")
    print(f"Franchise mappings: {len(FRANCHISE_MAPPINGS)}")


if __name__ == "__main__":
    main()
