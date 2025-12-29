"""
PlayNxt Fun Facts Addition Script

Adds fun facts to all games in the database.
Run with: python -m scripts.add_fun_facts
"""

import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from google.cloud import firestore
from dotenv import load_dotenv

load_dotenv()

# Fun facts for all games - interesting trivia about each game
FUN_FACTS = {
    # Low Energy / Relaxing Games
    "stardew-valley": "Creator Eric Barone (ConcernedApe) spent 4 years developing this entire game by himself, including all art, music, and code!",
    "animal-crossing-nh": "The game sold 13.4 million copies in its first 6 weeks, breaking the record for most digital sales in a single month!",
    "tetris-effect": "Tetris was invented in 1984 by Soviet software engineer Alexey Pajitnov while working at the Soviet Academy of Sciences.",
    "unpacking": "The developers spent months researching how to make pixel art objects immediately recognizable, studying real-world items in detail.",
    "a-short-hike": "This cozy game was made in just 1 month as part of a game jam and later expanded into a full release!",
    "coffee-talk": "The game features music by Andrew Jeremy and is inspired by classic 90s coffee shop culture in Seattle.",
    "spiritfarer": "The game deals with themes of death and letting go - the developers consulted with grief counselors during development.",
    "powerwash-simulator": "The game features over 40 vehicles and locations to clean, with surprisingly accurate physics for water pressure!",
    "dorfromantik": "The word 'Dorfromantik' is German and roughly translates to 'village romanticism' - a longing for rural life.",
    "lego-builders-journey": "This was the first LEGO game developed in collaboration with LEGO's own in-house design team.",
    "islanders": "The entire game was created by a team of just 4 people in Germany!",
    "gardens-between": "The game has no dialogue or text - the entire story is told through visuals and environmental storytelling.",
    "gris": "The stunning watercolor art style was hand-painted by artist Conrad Roset, with each frame carefully crafted.",
    "mini-metro": "The game was inspired by Harry Beck's iconic 1931 London Underground map design.",
    "abzu": "The game's title comes from ancient Sumerian mythology - 'Abzu' refers to the primordial sea.",

    # Medium Energy / Strategy Games
    "civilization-6": "If you played every possible game of Civ 6, there are more potential combinations than atoms in the universe!",
    "disco-elysium": "The game started as a tabletop RPG that the developers played for years before making it into a video game.",
    "slay-the-spire": "The game invented the 'roguelike deckbuilder' genre, spawning hundreds of similar games!",
    "it-takes-two": "It won Game of the Year 2021 - the first co-op only game ever to win this prestigious award!",
    "hollow-knight": "Team Cherry (just 3 people) created over 140 unique enemies and made the game's world entirely interconnected.",
    "portal-2": "The companion cube has its own Twitter account and has become one of gaming's most beloved characters.",
    "subnautica": "The game takes place on planet 4546B, which was procedurally generated but then hand-crafted for the final game.",
    "divinity-os2": "The game has over 1 million words of dialogue - more than the entire Harry Potter series!",
    "baldurs-gate-3": "Players have found over 17,000 possible endings based on all the choices you can make!",
    "hades-2": "Supergiant Games is one of the few studios where every employee works on every game together.",
    "inscryption": "The game contains secrets that took the community months to uncover, including hidden ARGs.",
    "return-obra-dinn": "Creator Lucas Pope spent 5 years developing this game entirely by himself.",
    "outer-wilds": "The game's 22-minute time loop is exactly synced to the sun's supernova cycle.",
    "witness": "There are over 650 puzzles in the game, and creator Jonathan Blow spent 8 years designing them.",
    "factorio": "The game spent 4 years in Early Access and has a 96% positive rating on Steam!",
    "satisfactory": "The conveyor belt system alone took over a year to perfect for smooth gameplay.",
    "rimworld": "The AI storyteller system was inspired by the concept of a dungeon master in tabletop RPGs.",

    # High Energy / Action Games
    "dead-cells": "The game has been updated with new content for over 5 years since launch!",
    "persona-5-royal": "The game's soundtrack has been streamed over 1 billion times on Spotify!",
    "fire-emblem-engage": "The game features characters from every previous Fire Emblem game as summonable 'Emblems'.",
    "zelda-totk": "The physics engine allows for creations so complex that players have built working computers in-game!",
    "monster-hunter-rise": "Capcom created entirely new monster ecologies and food chains for the game's ecosystem.",
    "minecraft": "The game has sold over 300 million copies, making it the best-selling video game of all time!",
    "terraria": "The game has received over 50 major content updates since its 2011 launch!",
    "valheim": "Made by a team of just 5 people, it sold 10 million copies in its first year!",
    "no-mans-sky": "The game contains 18 quintillion procedurally generated planets - you could never visit them all.",
    "deep-rock-galactic": "The iconic 'Rock and Stone!' voice line was recorded by the game's actual sound designer.",
    "risk-of-rain-2": "The transition from 2D to 3D only took the developers 8 months to prototype!",
    "vampire-survivors": "Created as a passion project, the game made over $100 million in its first year!",
    "cult-of-the-lamb": "The art style was inspired by Cartoon Network shows from the 2000s.",
    "dave-the-diver": "The game blends 4 different genres: diving, cooking, farming, and RPG elements!",
    "sea-of-stars": "The pixel art team animated every single frame by hand - over 25,000 frames total.",
    "hades": "Voice actors Troy Baker and Logan Cunningham recorded over 20,000 lines of dialogue.",
    "celeste": "The game's developer, Maddy Thorson, has said the game is partly autobiographical.",
    "elden-ring": "George R.R. Martin (Game of Thrones author) wrote the game's background mythology.",

    # Competitive / Multiplayer Games
    "apex-legends": "The game launched with no marketing and gained 25 million players in its first week!",
    "valorant": "Riot Games spent 6 years developing the game in secret before announcing it.",
    "overwatch-2": "The original Overwatch took inspiration from the canceled Blizzard project 'Titan'.",
    "street-fighter-6": "The game's art director studied real martial arts for years to make animations authentic.",
    "tekken-8": "Each character has over 100 unique moves, making it one of the deepest fighting games ever.",
    "mortal-kombat-1": "The MK franchise has been restarted 3 times now with different timelines!",
    "super-smash-bros-ultimate": "With 89 playable fighters, it has the largest roster of any fighting game!",
    "rocket-league": "The game was originally called 'Supersonic Acrobatic Rocket-Powered Battle-Cars'!",
    "fall-guys": "The beans have no bones - they're literally just beans in costumes!",
    "among-us": "The game was released in 2018 but didn't become popular until 2020!",
    "lethal-company": "Made by a single developer in just 6 months, it became a viral sensation!",
    "phasmophobia": "The ghost AI actually listens to players through their microphones!",
    "content-warning": "The game's 'Spook Tube' is based on real early 2000s video sharing sites.",
    "golf-with-friends": "The game started as a university project before becoming a Steam hit!",
    "jackbox-party-packs": "Each game in the packs is made by a different team at Jackbox Games.",

    # Sports Games
    "nba-2k24": "The motion capture for players uses over 50 cameras to capture every movement.",
    "fifa-24": "EA uses HyperMotion technology that captures full 11v11 matches for realistic animations.",
    "mlb-the-show-24": "The game tracks real-world stats daily to update player ratings!",
    "forza-horizon-5": "The map is based on a real section of Mexico, recreated with satellite data.",
    "gran-turismo-7": "Professional race car drivers use the game for training and practice!",
    "pga-tour-2k24": "Real PGA courses are recreated using laser-scanned topographical data.",
    "tony-hawks-pro-skater": "The remaster uses many of the same developers from the original 1999 game!",
    "riders-republic": "The open world contains real locations from 7 different US national parks.",

    # Horror Games
    "resident-evil-4-remake": "The original RE4 was almost completely different - a scrapped version became Devil May Cry!",
    "silent-hill-2-remake": "Konami's original team created the monster 'Pyramid Head' in just 2 weeks.",
    "alan-wake-2": "Remedy Entertainment worked on this sequel for over 13 years!",
    "dead-space-remake": "The necromorphs' audio uses slowed-down recordings of actual surgical procedures.",
    "amnesia-bunker": "The game's sound design was created to make players physically uncomfortable.",
    "dredge": "The art style was inspired by old nautical horror stories and H.P. Lovecraft.",
    "outlast-trials": "The developers research actual CIA psychological experiments for inspiration.",
    "little-nightmares-2": "The TV enemy in the game represents society's addiction to screens.",

    # Indie Gems
    "tunic": "The in-game manual is written in a fictional language that players decoded!",
    "sifu": "Martial arts experts consulted on every punch and kick animation.",
    "neon-white": "The speedrunning community helped design levels during development!",
    "hi-fi-rush": "The entire game syncs to the beat of the music - even enemy attacks!",
    "pizza-tower": "The game's physics were inspired by Wario Land games from the 90s.",
    "blasphemous-2": "The art is inspired by Spanish religious iconography and baroque paintings.",
    "deaths-door": "The game was made by just 2 people in under 2 years!",
    "loop-hero": "The developers intentionally made the game look like a lost NES title.",
    "webbed": "You can actually create functional web structures using real spider physics!",
    "toem": "The entire game fits in under 500MB despite having hundreds of photos to take.",
    "chicory": "The game explores themes of imposter syndrome and creative burnout.",
    "tinykin": "The animation team studied real ant behavior for months!",

    # Classics & Remasters
    "dark-souls-remastered": "The 'Praise the Sun' gesture became a real-world meme and merchandise phenomenon!",
    "mass-effect-legendary": "The trilogy contains over 40,000 lines of dialogue across all three games.",
    "final-fantasy-pixel-remaster": "The pixel art was completely redrawn by legendary artist Kazuko Shibuya.",
    "chrono-cross-remaster": "The game has 45 playable characters - more than most RPGs combined!",
    "metroid-dread": "This game concluded a storyline that began in 1986 - 35 years earlier!",
    "links-awakening-switch": "The entire island exists only in the Wind Fish's dream.",
    "super-mario-rpg-remake": "The original was a collaboration between Nintendo and Squaresoft (now Square Enix).",
    "paper-mario-ttyd": "The game's humor was rewritten for the remake to be even funnier!",

    # Cozy Multiplayer
    "overcooked-2": "The game was designed to test relationships - it's infamous for causing friendly arguments!",
    "moving-out": "The developers literally moved furniture IRL to understand the physics!",
    "unravel-two": "The yarn physics are based on real textile mathematics!",
    "a-way-out": "Director Josef Fares is known for shouting 'F*** the Oscars!' at the Game Awards.",
    "sackboy-adventure": "LittleBigPlanet's Sackboy has appeared in over 10 different games!",
    "lego-star-wars-skywalker": "The game contains over 300 playable characters and 23 planets!",
    "luigi-mansion-3": "Each floor of the hotel was designed by a different team at Nintendo.",

    # Racing & Driving
    "mario-kart-8-deluxe": "The game has been on Nintendo's best-sellers list for over 7 years straight!",
    "crash-team-racing-nf": "The original CTR was considered by many to be better than Mario Kart!",
    "hot-wheels-unleashed-2": "Real Hot Wheels designers helped create exclusive cars for the game.",
    "art-of-rally": "The developer grew up watching rally racing with his father.",

    # Rhythm Games
    "beat-saber": "The game has been used in physical therapy to help patients recover!",
    "hi-fi-rush": "Developer Tango Gameworks was previously known only for horror games!",
    "metal-hellsinger": "Every demon's attack pattern syncs to the heavy metal soundtrack.",
    "theatrhythm-final-bar": "Contains music from 35 years of Final Fantasy history!",

    # Management Sims
    "cities-skylines-2": "The traffic AI simulates every single vehicle in the city individually!",
    "two-point-campus": "The game's humor is inspired by British comedy like Monty Python.",
    "planet-zoo": "Animals have over 30 unique behaviors based on real zoological research.",
    "jurassic-world-evolution-2": "Paleontologists consulted on accurate dinosaur behaviors and sounds.",
    "foundation": "The developers studied actual medieval city planning documents!",

    # VR Games
    "half-life-alyx": "This was Valve's first full single-player game in 13 years!",
    "resident-evil-4-vr": "The VR version was completely rebuilt from scratch - not just a port.",
    "beat-saber": "The game was the first VR-only title to sell over 4 million copies!",
    "moss": "The little mouse hero, Quill, was motion-captured using a custom mouse-sized suit.",

    # Card/Board Games
    "marvel-snap": "Ben Brode, the designer, previously created Hearthstone at Blizzard!",
    "legends-of-runeterra": "The game uses characters from League of Legends' 14-year history.",
    "gwent": "The card game from The Witcher 3 was so popular it became its own game!",
    "magic-arena": "Magic: The Gathering has over 25,000 unique cards created since 1993!",

    # Additional games that were missing
    "armored-core-6": "FromSoftware hadn't made an Armored Core game in 10 years before this entry!",
    "call-of-duty-warzone": "Warzone uses the same engine that powered Modern Warfare 2019.",
    "counter-strike-2": "The original Counter-Strike started as a mod for Half-Life in 1999!",
    "cuphead": "Every frame of animation was hand-drawn - over 45,000 frames total!",
    "dark-souls-3": "Director Hidetaka Miyazaki originally envisioned the series as a dungeon crawler.",
    "dead-by-daylight": "The game has featured licensed killers from over 20 horror franchises!",
    "destiny-2": "Bungie previously created the Halo franchise before creating Destiny.",
    "diablo-4": "The game world is the largest in Diablo history, taking hours to cross on foot.",
    "doom-eternal": "The Doom Slayer's rage is literally too angry for Hell to contain!",
    "final-fantasy-16": "This is the first mainline FF game to be fully action-based combat.",
    "final-fantasy-7-rebirth": "The Remake trilogy will span 3 full games for the original's story!",
    "fortnite": "The game started as a zombie survival game before Battle Royale was added!",
    "god-of-war-ragnarok": "The game features over 70 unique boss encounters!",
    "helldivers-2": "The game supports 'friendly fire' - your bullets really do hurt teammates!",
    "hogwarts-legacy": "The game is set 100 years before Harry Potter was born.",
    "lies-of-p": "The game is based on the story of Pinocchio but set in a dark, soulslike world.",
    "nier-automata": "Director Yoko Taro wore a mask throughout development to stay anonymous.",
    "palworld": "The game sold 25 million copies in its first month of Early Access!",
    "path-of-exile-2": "The skill gem system allows for millions of possible build combinations!",
    "returnal": "The entire game was inspired by the developer's recurring nightmares.",
    "sekiro": "The game won Game of the Year 2019 - FromSoftware's first GOTY win!",
    "spider-man-2": "The game's New York City is twice the size of the first game's map!",
    "star-wars-jedi-survivor": "Cal Kestis is voiced by Cameron Monaghan, who also does motion capture.",
    "ultrakill": "The game is inspired by 90s shooters like Quake and Devil May Cry combat!",
}


def add_fun_facts_to_games():
    """Add fun facts to all games in Firestore."""
    # Initialize Firestore
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("FIREBASE_PROJECT_ID")
    if not project_id:
        project_id = "playnxt"

    db = firestore.Client(project=project_id)
    games_ref = db.collection("games")

    # Get all games
    games = games_ref.stream()

    updated_count = 0
    skipped_count = 0

    for game in games:
        game_id = game.id
        game_data = game.to_dict()

        # Check if game already has a fun fact
        if game_data.get("fun_fact"):
            print(f"  Skipping {game_id} - already has fun fact")
            skipped_count += 1
            continue

        # Look up fun fact
        fun_fact = FUN_FACTS.get(game_id)

        if fun_fact:
            # Update the game with the fun fact
            games_ref.document(game_id).update({"fun_fact": fun_fact})
            print(f"  Added fun fact to: {game_id}")
            updated_count += 1
        else:
            print(f"  No fun fact for: {game_id}")

    print(f"\nDone! Updated {updated_count} games, skipped {skipped_count}")


if __name__ == "__main__":
    print("Adding fun facts to games...")
    add_fun_facts_to_games()
