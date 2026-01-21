"""
Add more mobile games to the PlayNxt catalog.
"""

import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {'projectId': 'playnxt-1a2c6'})

db = firestore.client()
games_ref = db.collection('games')

MOBILE_GAMES_BATCH_4 = [
    {
        "game_id": "among-us",
        "title": "Among Us",
        "platforms": ["pc", "playstation", "xbox", "switch", "mobile"],
        "release_year": 2018,
        "genre_tags": ["party", "social-deduction", "multiplayer"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["social", "fun", "suspicious"],
        "play_style": ["strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["online_coop", "competitive"],
        "description_short": "Find the impostor among your crewmates.",
        "fun_fact": "Became a viral sensation in 2020, two years after its initial release.",
        "explanation_templates": {
            "time_fit": "Games take 10-15 minutes.",
            "mood_fit": "Social deception with friends.",
            "stop_fit": "Complete games then stop."
        },
        "subscription_services": [],
        "store_links": {"steam": "https://store.steampowered.com/app/945360/Among_Us/"}
    },
    {
        "game_id": "retro-bowl",
        "title": "Retro Bowl",
        "platforms": ["pc", "switch", "mobile"],
        "release_year": 2020,
        "genre_tags": ["sports", "football", "retro", "simulation"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["fun", "nostalgic"],
        "play_style": ["strategy", "action"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Retro-style American football with team management.",
        "fun_fact": "Became a viral hit on TikTok and topped the App Store charts.",
        "explanation_templates": {
            "time_fit": "Games take 5-10 minutes.",
            "mood_fit": "Quick retro football fun.",
            "stop_fit": "Stop after any game."
        },
        "subscription_services": [],
        "store_links": {"steam": "https://store.steampowered.com/app/1671930/Retro_Bowl/"}
    },
    {
        "game_id": "clash-heroes",
        "title": "Squad Busters",
        "platforms": ["mobile"],
        "release_year": 2024,
        "genre_tags": ["action", "multiplayer", "battle"],
        "time_tags": [15],
        "energy_level": "medium",
        "mood_tags": ["competitive", "fun"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["competitive"],
        "description_short": "Supercell's mashup battler with characters from all their games.",
        "fun_fact": "Features characters from Clash of Clans, Brawl Stars, and more.",
        "explanation_templates": {
            "time_fit": "Matches take 3-5 minutes.",
            "mood_fit": "Fast chaotic battles.",
            "stop_fit": "Complete matches then stop."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "битва",
        "title": "Battlegrounds Mobile India",
        "platforms": ["mobile"],
        "release_year": 2021,
        "genre_tags": ["battle-royale", "shooter", "competitive"],
        "time_tags": [30, 60],
        "energy_level": "high",
        "mood_tags": ["intense", "competitive"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "commitment",
        "multiplayer_modes": ["competitive", "online_coop"],
        "description_short": "PUBG Mobile's Indian version with localized features.",
        "fun_fact": "Has over 100 million downloads in India alone.",
        "explanation_templates": {
            "time_fit": "Matches run 20-30 minutes.",
            "mood_fit": "Intense battle royale.",
            "stop_fit": "Commit to full matches."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "survivor-io",
        "title": "Survivor.io",
        "platforms": ["mobile"],
        "release_year": 2022,
        "genre_tags": ["roguelike", "action", "survival"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["action-packed", "satisfying"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Survive waves of monsters in this Vampire Survivors-like.",
        "fun_fact": "One of the most successful mobile adaptations of the survivor genre.",
        "explanation_templates": {
            "time_fit": "Runs take 10-15 minutes.",
            "mood_fit": "Satisfying horde survival.",
            "stop_fit": "Complete runs then stop."
        },
        "subscription_services": [],
        "store_links": {}
    }
]

MOBILE_GAMES_BATCH_3 = [
    {
        "game_id": "monument-valley",
        "title": "Monument Valley",
        "platforms": ["mobile"],
        "release_year": 2014,
        "genre_tags": ["puzzle", "art", "indie", "adventure"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["relaxing", "meditative", "beautiful"],
        "play_style": ["puzzle"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Guide a princess through impossible architecture in this stunning puzzler.",
        "fun_fact": "Inspired by M.C. Escher's optical illusions and impossible objects.",
        "explanation_templates": {
            "time_fit": "Chapters take 10-15 minutes.",
            "mood_fit": "Beautiful, zen-like puzzles.",
            "stop_fit": "Save after any level."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "alto-adventure",
        "title": "Alto's Adventure",
        "platforms": ["mobile"],
        "release_year": 2015,
        "genre_tags": ["endless-runner", "snowboarding", "zen", "indie"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["relaxing", "beautiful", "zen"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Snowboard through serene alpine landscapes in this zen endless runner.",
        "fun_fact": "Features a zen mode that removes scores and coins for pure relaxation.",
        "explanation_templates": {
            "time_fit": "Runs take a few minutes.",
            "mood_fit": "Peaceful snowboarding experience.",
            "stop_fit": "Each run is self-contained."
        },
        "subscription_services": ["apple_arcade"],
        "store_links": {}
    },
    {
        "game_id": "threes",
        "title": "Threes!",
        "platforms": ["mobile"],
        "release_year": 2014,
        "genre_tags": ["puzzle", "math", "indie", "casual"],
        "time_tags": [15],
        "energy_level": "low",
        "mood_tags": ["brain-teasing", "addictive"],
        "play_style": ["puzzle"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Slide numbered tiles to create multiples of three.",
        "fun_fact": "Inspired the viral hit 2048, though Threes came first.",
        "explanation_templates": {
            "time_fit": "Perfect for 5-minute breaks.",
            "mood_fit": "Addictive number puzzles.",
            "stop_fit": "Stop anytime."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "florence",
        "title": "Florence",
        "platforms": ["mobile", "switch"],
        "release_year": 2018,
        "genre_tags": ["narrative", "indie", "romance", "interactive-story"],
        "time_tags": [30],
        "energy_level": "low",
        "mood_tags": ["emotional", "touching", "artistic"],
        "play_style": ["narrative"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Experience a young woman's first love through interactive vignettes.",
        "fun_fact": "Won Apple's Game of the Year and multiple BAFTA awards.",
        "explanation_templates": {
            "time_fit": "Complete experience in 30-40 minutes.",
            "mood_fit": "Touching emotional story.",
            "stop_fit": "Best played in one sitting."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "device-6",
        "title": "DEVICE 6",
        "platforms": ["mobile"],
        "release_year": 2013,
        "genre_tags": ["puzzle", "narrative", "mystery", "indie"],
        "time_tags": [30, 60],
        "energy_level": "medium",
        "mood_tags": ["mysterious", "clever", "immersive"],
        "play_style": ["puzzle", "narrative"],
        "time_to_fun": "medium",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "A surreal thriller where text becomes the game world.",
        "fun_fact": "Uses text layout itself as a puzzle mechanic.",
        "explanation_templates": {
            "time_fit": "Chapters take 20-30 minutes.",
            "mood_fit": "Mind-bending narrative puzzles.",
            "stop_fit": "Save between chapters."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "the-room",
        "title": "The Room",
        "platforms": ["mobile"],
        "release_year": 2012,
        "genre_tags": ["puzzle", "mystery", "escape-room"],
        "time_tags": [30, 60],
        "energy_level": "medium",
        "mood_tags": ["mysterious", "atmospheric", "clever"],
        "play_style": ["puzzle"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Solve intricate puzzle boxes in this atmospheric mystery.",
        "fun_fact": "Started as a small project and became one of mobile's most acclaimed series.",
        "explanation_templates": {
            "time_fit": "Chapters take 20-40 minutes.",
            "mood_fit": "Atmospheric puzzle-solving.",
            "stop_fit": "Progress saves automatically."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "downwell",
        "title": "Downwell",
        "platforms": ["pc", "switch", "mobile"],
        "release_year": 2015,
        "genre_tags": ["roguelike", "action", "platformer", "indie"],
        "time_tags": [15, 30],
        "energy_level": "high",
        "mood_tags": ["action-packed", "challenging"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Fall down a well while shooting enemies with gunboots.",
        "fun_fact": "Made by one developer using only black, white, and red.",
        "explanation_templates": {
            "time_fit": "Runs take 5-10 minutes.",
            "mood_fit": "Fast-paced action roguelike.",
            "stop_fit": "Each run is self-contained."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "clash-mini",
        "title": "Clash Mini",
        "platforms": ["mobile"],
        "release_year": 2023,
        "genre_tags": ["strategy", "auto-battler", "casual"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["strategic", "competitive"],
        "play_style": ["strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["competitive"],
        "description_short": "Place minis and watch them battle in this auto-chess style game.",
        "fun_fact": "Features chibi versions of Clash of Clans characters.",
        "explanation_templates": {
            "time_fit": "Matches take 5-10 minutes.",
            "mood_fit": "Quick strategic battles.",
            "stop_fit": "Complete matches then stop."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "marvel-snap",
        "title": "Marvel Snap",
        "platforms": ["pc", "mobile"],
        "release_year": 2022,
        "genre_tags": ["card", "strategy", "competitive", "marvel"],
        "time_tags": [15],
        "energy_level": "medium",
        "mood_tags": ["strategic", "competitive"],
        "play_style": ["card_game", "strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["competitive"],
        "description_short": "Fast-paced card battler with Marvel heroes and villains.",
        "fun_fact": "Matches last only 3 minutes, revolutionizing digital card games.",
        "explanation_templates": {
            "time_fit": "Matches are just 3 minutes.",
            "mood_fit": "Quick strategic card battles.",
            "stop_fit": "Complete matches in under 5 minutes."
        },
        "subscription_services": [],
        "store_links": {"steam": "https://store.steampowered.com/app/1997040/MARVEL_SNAP/"}
    },
    {
        "game_id": "apex-legends-mobile",
        "title": "Apex Legends Mobile",
        "platforms": ["mobile"],
        "release_year": 2022,
        "genre_tags": ["battle-royale", "shooter", "competitive"],
        "time_tags": [15, 30],
        "energy_level": "high",
        "mood_tags": ["intense", "competitive", "action-packed"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "commitment",
        "multiplayer_modes": ["competitive", "online_coop"],
        "description_short": "Hero-based battle royale with unique character abilities.",
        "fun_fact": "Features mobile-exclusive legends not in the PC/console version.",
        "explanation_templates": {
            "time_fit": "Matches run 15-20 minutes.",
            "mood_fit": "Fast-paced hero shooter.",
            "stop_fit": "Commit to full matches."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "arena-of-valor",
        "title": "Arena of Valor",
        "platforms": ["mobile", "switch"],
        "release_year": 2016,
        "genre_tags": ["moba", "competitive", "action"],
        "time_tags": [15, 30],
        "energy_level": "high",
        "mood_tags": ["competitive", "strategic"],
        "play_style": ["action", "strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "commitment",
        "multiplayer_modes": ["competitive", "online_coop"],
        "description_short": "5v5 MOBA with DC Comics crossover heroes.",
        "fun_fact": "Known as Honor of Kings in China, the most profitable mobile game ever.",
        "explanation_templates": {
            "time_fit": "Matches last 12-18 minutes.",
            "mood_fit": "Intense MOBA action.",
            "stop_fit": "Commit to full matches."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "world-of-tanks-blitz",
        "title": "World of Tanks Blitz",
        "platforms": ["pc", "mobile"],
        "release_year": 2014,
        "genre_tags": ["action", "tanks", "competitive", "simulation"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["competitive", "tactical"],
        "play_style": ["action", "strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["competitive"],
        "description_short": "7v7 tank battles optimized for mobile.",
        "fun_fact": "Features over 400 historically accurate tanks.",
        "explanation_templates": {
            "time_fit": "Battles last 5-7 minutes.",
            "mood_fit": "Tactical tank warfare.",
            "stop_fit": "Complete matches then stop."
        },
        "subscription_services": [],
        "store_links": {"steam": "https://store.steampowered.com/app/444200/World_of_Tanks_Blitz/"}
    },
    {
        "game_id": "hearthstone",
        "title": "Hearthstone",
        "platforms": ["pc", "mobile"],
        "release_year": 2014,
        "genre_tags": ["card", "strategy", "competitive", "fantasy"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["strategic", "competitive"],
        "play_style": ["card_game", "strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "competitive"],
        "description_short": "The definitive digital card game set in the Warcraft universe.",
        "fun_fact": "Started as a side project by a small Blizzard team.",
        "explanation_templates": {
            "time_fit": "Matches take 10-15 minutes.",
            "mood_fit": "Deep strategic card play.",
            "stop_fit": "Complete matches then stop."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "clash-quest",
        "title": "Clash Quest",
        "platforms": ["mobile"],
        "release_year": 2021,
        "genre_tags": ["puzzle", "strategy", "tactical"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["strategic", "casual"],
        "play_style": ["puzzle", "strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Turn-based tactical puzzler with Clash characters.",
        "fun_fact": "Combines match-3 mechanics with tactical RPG elements.",
        "explanation_templates": {
            "time_fit": "Levels take 5-10 minutes.",
            "mood_fit": "Casual tactical puzzles.",
            "stop_fit": "Stop after any level."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "sky-children-of-light",
        "title": "Sky: Children of the Light",
        "platforms": ["mobile", "switch"],
        "release_year": 2019,
        "genre_tags": ["adventure", "social", "exploration", "indie"],
        "time_tags": [30, 60],
        "energy_level": "low",
        "mood_tags": ["relaxing", "beautiful", "social"],
        "play_style": ["sandbox_creative", "narrative"],
        "time_to_fun": "medium",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop"],
        "description_short": "Explore a beautiful kingdom and spread light with friends.",
        "fun_fact": "From the creators of Journey, emphasizing connection over competition.",
        "explanation_templates": {
            "time_fit": "Play at your own pace.",
            "mood_fit": "Peaceful social exploration.",
            "stop_fit": "Stop anytime."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "dead-cells-mobile",
        "title": "Dead Cells",
        "platforms": ["pc", "playstation", "xbox", "switch", "mobile"],
        "release_year": 2018,
        "genre_tags": ["roguelike", "action", "metroidvania", "indie"],
        "time_tags": [30, 60],
        "energy_level": "high",
        "mood_tags": ["challenging", "action-packed"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Fast-paced roguelike action with tight combat.",
        "fun_fact": "Won numerous Game of the Year awards and sold millions on mobile.",
        "explanation_templates": {
            "time_fit": "Runs take 20-40 minutes.",
            "mood_fit": "Challenging skill-based action.",
            "stop_fit": "Progress saves between biomes."
        },
        "subscription_services": [],
        "store_links": {"steam": "https://store.steampowered.com/app/588650/Dead_Cells/"}
    },
    {
        "game_id": "baba-is-you-mobile",
        "title": "Baba Is You",
        "platforms": ["pc", "switch", "mobile"],
        "release_year": 2019,
        "genre_tags": ["puzzle", "indie", "logic"],
        "time_tags": [15, 30, 60],
        "energy_level": "medium",
        "mood_tags": ["brain-teasing", "clever"],
        "play_style": ["puzzle"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Push words around to change the rules of each puzzle.",
        "fun_fact": "You can literally push 'WIN' next to 'BABA IS' to win.",
        "explanation_templates": {
            "time_fit": "Puzzles vary from minutes to hours.",
            "mood_fit": "Mind-bending rule manipulation.",
            "stop_fit": "Stop after any puzzle."
        },
        "subscription_services": [],
        "store_links": {"steam": "https://store.steampowered.com/app/736260/Baba_Is_You/"}
    },
    {
        "game_id": "legends-of-kingdom-rush",
        "title": "Legends of Kingdom Rush",
        "platforms": ["mobile"],
        "release_year": 2021,
        "genre_tags": ["rpg", "tactics", "turn-based"],
        "time_tags": [30, 60],
        "energy_level": "medium",
        "mood_tags": ["strategic", "adventurous"],
        "play_style": ["tactics", "strategy"],
        "time_to_fun": "medium",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Turn-based tactical RPG in the Kingdom Rush universe.",
        "fun_fact": "Features heroes from across the Kingdom Rush tower defense series.",
        "explanation_templates": {
            "time_fit": "Battles take 15-20 minutes.",
            "mood_fit": "Tactical fantasy combat.",
            "stop_fit": "Save between encounters."
        },
        "subscription_services": ["apple_arcade"],
        "store_links": {}
    },
    {
        "game_id": "grindstone",
        "title": "Grindstone",
        "platforms": ["pc", "switch", "mobile"],
        "release_year": 2019,
        "genre_tags": ["puzzle", "action", "indie"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["satisfying", "action-packed"],
        "play_style": ["puzzle", "action"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Chain together creeps of the same color for massive combos.",
        "fun_fact": "From Capybara Games, the studio behind Sword & Sworcery.",
        "explanation_templates": {
            "time_fit": "Levels take 5-10 minutes.",
            "mood_fit": "Satisfying puzzle action.",
            "stop_fit": "Stop after any level."
        },
        "subscription_services": ["apple_arcade"],
        "store_links": {"steam": "https://store.steampowered.com/app/1818690/Grindstone/"}
    },
    {
        "game_id": "what-the-golf",
        "title": "What the Golf?",
        "platforms": ["pc", "switch", "mobile"],
        "release_year": 2019,
        "genre_tags": ["golf", "comedy", "puzzle", "indie"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["funny", "surprising"],
        "play_style": ["puzzle"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "A golf game for people who hate golf.",
        "fun_fact": "Each level subverts expectations - you might golf a house or a horse.",
        "explanation_templates": {
            "time_fit": "Levels take 30 seconds to 2 minutes.",
            "mood_fit": "Hilarious surprises every level.",
            "stop_fit": "Stop after any level."
        },
        "subscription_services": ["apple_arcade"],
        "store_links": {"steam": "https://store.steampowered.com/app/785790/WHAT_THE_GOLF/"}
    },
    {
        "game_id": "sneaky-sasquatch",
        "title": "Sneaky Sasquatch",
        "platforms": ["mobile"],
        "release_year": 2019,
        "genre_tags": ["adventure", "sandbox", "comedy", "indie"],
        "time_tags": [30, 60],
        "energy_level": "low",
        "mood_tags": ["fun", "relaxing", "silly"],
        "play_style": ["sandbox_creative"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Live the life of a sasquatch stealing picnic baskets.",
        "fun_fact": "You can get a job, go racing, or just steal food from campers.",
        "explanation_templates": {
            "time_fit": "Play as long as you want.",
            "mood_fit": "Silly open-world fun.",
            "stop_fit": "Save and stop anytime."
        },
        "subscription_services": ["apple_arcade"],
        "store_links": {}
    },
    {
        "game_id": "nba-2k-mobile",
        "title": "NBA 2K Mobile",
        "platforms": ["mobile"],
        "release_year": 2018,
        "genre_tags": ["sports", "basketball", "simulation"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["competitive", "sports"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "competitive"],
        "description_short": "Console-quality basketball on your phone.",
        "fun_fact": "Features real NBA players with updated rosters.",
        "explanation_templates": {
            "time_fit": "Games take 10-15 minutes.",
            "mood_fit": "Authentic basketball action.",
            "stop_fit": "Complete games then stop."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "madden-mobile",
        "title": "Madden NFL Mobile",
        "platforms": ["mobile"],
        "release_year": 2014,
        "genre_tags": ["sports", "football", "simulation"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["competitive", "sports"],
        "play_style": ["action", "strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "competitive"],
        "description_short": "Build your NFL team and compete on mobile.",
        "fun_fact": "Updates with real NFL season events and players.",
        "explanation_templates": {
            "time_fit": "Games take 5-10 minutes.",
            "mood_fit": "Quick football action.",
            "stop_fit": "Complete games then stop."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "golf-clash",
        "title": "Golf Clash",
        "platforms": ["mobile"],
        "release_year": 2017,
        "genre_tags": ["sports", "golf", "casual", "pvp"],
        "time_tags": [15],
        "energy_level": "low",
        "mood_tags": ["competitive", "relaxing"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["competitive"],
        "description_short": "Quick 1v1 golf matches against real players.",
        "fun_fact": "Matches take just 2-3 minutes for fast competitive fun.",
        "explanation_templates": {
            "time_fit": "Matches are 2-3 minutes.",
            "mood_fit": "Quick competitive golf.",
            "stop_fit": "Complete matches in minutes."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "top-eleven",
        "title": "Top Eleven",
        "platforms": ["mobile"],
        "release_year": 2010,
        "genre_tags": ["sports", "soccer", "manager", "simulation"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["strategic", "competitive"],
        "play_style": ["strategy"],
        "time_to_fun": "medium",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "competitive"],
        "description_short": "Manage your own football club to glory.",
        "fun_fact": "Jose Mourinho was the official ambassador for the game.",
        "explanation_templates": {
            "time_fit": "Check in for a few minutes.",
            "mood_fit": "Strategic team management.",
            "stop_fit": "Matches play out while away."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "score-hero",
        "title": "Score! Hero",
        "platforms": ["mobile"],
        "release_year": 2015,
        "genre_tags": ["sports", "soccer", "puzzle", "casual"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["casual", "satisfying"],
        "play_style": ["puzzle", "action"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Draw the path of the ball to score amazing goals.",
        "fun_fact": "Combines puzzle mechanics with football for unique gameplay.",
        "explanation_templates": {
            "time_fit": "Levels take 1-2 minutes.",
            "mood_fit": "Satisfying goal-scoring puzzles.",
            "stop_fit": "Stop after any level."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "tap-titans-2",
        "title": "Tap Titans 2",
        "platforms": ["mobile"],
        "release_year": 2016,
        "genre_tags": ["idle", "rpg", "clicker"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["casual", "satisfying"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop"],
        "description_short": "Tap to defeat titans and prestige for power.",
        "fun_fact": "The prestige system lets you restart stronger infinitely.",
        "explanation_templates": {
            "time_fit": "Play actively or let it idle.",
            "mood_fit": "Satisfying progression.",
            "stop_fit": "Progress continues offline."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "idle-heroes",
        "title": "Idle Heroes",
        "platforms": ["mobile"],
        "release_year": 2016,
        "genre_tags": ["idle", "rpg", "gacha", "strategy"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["casual", "collecting"],
        "play_style": ["strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "competitive"],
        "description_short": "Collect heroes and watch them battle automatically.",
        "fun_fact": "One of the original idle RPGs that popularized the genre.",
        "explanation_templates": {
            "time_fit": "Check in for a few minutes.",
            "mood_fit": "Relaxed hero collecting.",
            "stop_fit": "Heroes fight while away."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "empires-puzzles",
        "title": "Empires & Puzzles",
        "platforms": ["mobile"],
        "release_year": 2017,
        "genre_tags": ["puzzle", "rpg", "match-3", "gacha"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["strategic", "collecting"],
        "play_style": ["puzzle", "strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "online_coop"],
        "description_short": "Match-3 battles combined with base building and hero collecting.",
        "fun_fact": "Made by Small Giant Games, later acquired for over $700 million.",
        "explanation_templates": {
            "time_fit": "Battles take 5-10 minutes.",
            "mood_fit": "Strategic puzzle combat.",
            "stop_fit": "Complete battles then stop."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "pocket-city",
        "title": "Pocket City",
        "platforms": ["mobile"],
        "release_year": 2018,
        "genre_tags": ["simulation", "city-builder", "indie"],
        "time_tags": [30, 60],
        "energy_level": "low",
        "mood_tags": ["creative", "relaxing"],
        "play_style": ["sandbox_creative", "strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Build your dream city without timers or IAPs.",
        "fun_fact": "A premium city builder inspired by classic SimCity.",
        "explanation_templates": {
            "time_fit": "Play as long as you want.",
            "mood_fit": "Relaxing city building.",
            "stop_fit": "Save and stop anytime."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "mindustry",
        "title": "Mindustry",
        "platforms": ["pc", "mobile"],
        "release_year": 2019,
        "genre_tags": ["strategy", "tower-defense", "factory", "indie"],
        "time_tags": [30, 60, 90],
        "energy_level": "medium",
        "mood_tags": ["strategic", "creative"],
        "play_style": ["strategy", "sandbox_creative"],
        "time_to_fun": "medium",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop"],
        "description_short": "Tower defense meets factory building.",
        "fun_fact": "Completely free and open source with no ads.",
        "explanation_templates": {
            "time_fit": "Levels vary from 20 minutes to hours.",
            "mood_fit": "Deep strategic factory building.",
            "stop_fit": "Pause anytime."
        },
        "subscription_services": [],
        "store_links": {"steam": "https://store.steampowered.com/app/1127400/Mindustry/"}
    },
    {
        "game_id": "geometry-dash",
        "title": "Geometry Dash",
        "platforms": ["pc", "mobile"],
        "release_year": 2013,
        "genre_tags": ["rhythm", "platformer", "challenging"],
        "time_tags": [15, 30],
        "energy_level": "high",
        "mood_tags": ["challenging", "addictive"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Jump and fly through rhythm-based platforming levels.",
        "fun_fact": "Has millions of user-created levels with custom music.",
        "explanation_templates": {
            "time_fit": "Levels take 1-2 minutes (or hundreds of attempts).",
            "mood_fit": "Challenging rhythm action.",
            "stop_fit": "Stop after any attempt."
        },
        "subscription_services": [],
        "store_links": {"steam": "https://store.steampowered.com/app/322170/Geometry_Dash/"}
    },
    {
        "game_id": "btd6-mobile",
        "title": "Bloons TD 6",
        "platforms": ["pc", "mobile"],
        "release_year": 2018,
        "genre_tags": ["tower-defense", "strategy"],
        "time_tags": [30, 60],
        "energy_level": "low",
        "mood_tags": ["strategic", "satisfying"],
        "play_style": ["strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "online_coop"],
        "description_short": "Pop bloons with monkey towers in this beloved TD series.",
        "fun_fact": "Features over 20 unique monkey towers with upgrade paths.",
        "explanation_templates": {
            "time_fit": "Maps take 20-40 minutes.",
            "mood_fit": "Satisfying tower defense.",
            "stop_fit": "Pause between rounds."
        },
        "subscription_services": [],
        "store_links": {"steam": "https://store.steampowered.com/app/960090/Bloons_TD_6/"}
    },
    {
        "game_id": "kingdom-rush",
        "title": "Kingdom Rush",
        "platforms": ["pc", "mobile"],
        "release_year": 2011,
        "genre_tags": ["tower-defense", "strategy", "fantasy"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["strategic", "fun"],
        "play_style": ["strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Classic fantasy tower defense with heroes and upgrades.",
        "fun_fact": "Started the beloved Kingdom Rush franchise with multiple sequels.",
        "explanation_templates": {
            "time_fit": "Levels take 10-20 minutes.",
            "mood_fit": "Classic tower defense action.",
            "stop_fit": "Complete levels then stop."
        },
        "subscription_services": [],
        "store_links": {"steam": "https://store.steampowered.com/app/246420/Kingdom_Rush/"}
    }
]

MOBILE_GAMES_BATCH_2 = [
    {
        "game_id": "diablo-immortal",
        "title": "Diablo Immortal",
        "platforms": ["pc", "mobile"],
        "release_year": 2022,
        "genre_tags": ["rpg", "action", "arpg", "loot"],
        "time_tags": [15, 30, 60],
        "energy_level": "medium",
        "mood_tags": ["action-packed", "grinding"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "online_coop"],
        "description_short": "Hack and slash through demons in this mobile ARPG.",
        "fun_fact": "Set between Diablo II and III, filling a 20-year story gap.",
        "explanation_templates": {
            "time_fit": "Dungeons take 10-15 minutes.",
            "mood_fit": "Satisfying demon-slaying action.",
            "stop_fit": "Save progress between dungeons."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "league-of-legends-wild-rift",
        "title": "League of Legends: Wild Rift",
        "platforms": ["mobile"],
        "release_year": 2020,
        "genre_tags": ["moba", "competitive", "strategy"],
        "time_tags": [15, 30],
        "energy_level": "high",
        "mood_tags": ["competitive", "strategic"],
        "play_style": ["strategy", "action"],
        "time_to_fun": "medium",
        "stop_friendliness": "commitment",
        "multiplayer_modes": ["competitive", "online_coop"],
        "description_short": "5v5 MOBA action redesigned for mobile.",
        "fun_fact": "Matches are shorter than PC LoL, averaging 15-20 minutes.",
        "explanation_templates": {
            "time_fit": "Matches run 15-20 minutes.",
            "mood_fit": "Intense competitive teamplay.",
            "stop_fit": "Commit to full matches."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "legends-of-runeterra",
        "title": "Legends of Runeterra",
        "platforms": ["pc", "mobile"],
        "release_year": 2020,
        "genre_tags": ["card", "strategy", "competitive"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["strategic", "competitive"],
        "play_style": ["card_game", "strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "competitive"],
        "description_short": "Strategic card game set in the League of Legends universe.",
        "fun_fact": "Known for being generous with free cards compared to other CCGs.",
        "explanation_templates": {
            "time_fit": "Matches take 10-15 minutes.",
            "mood_fit": "Deep strategic card battles.",
            "stop_fit": "Complete matches then stop."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "afk-arena",
        "title": "AFK Arena",
        "platforms": ["mobile"],
        "release_year": 2019,
        "genre_tags": ["rpg", "idle", "gacha", "strategy"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["casual", "collecting"],
        "play_style": ["strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Idle RPG where heroes fight even when you're away.",
        "fun_fact": "Your heroes keep battling and earning rewards while offline.",
        "explanation_templates": {
            "time_fit": "Check in for a few minutes.",
            "mood_fit": "Relaxed idle progression.",
            "stop_fit": "Progress continues offline."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "raid-shadow-legends",
        "title": "RAID: Shadow Legends",
        "platforms": ["pc", "mobile"],
        "release_year": 2018,
        "genre_tags": ["rpg", "gacha", "turn-based", "collecting"],
        "time_tags": [15, 30, 60],
        "energy_level": "low",
        "mood_tags": ["strategic", "collecting"],
        "play_style": ["strategy"],
        "time_to_fun": "medium",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "competitive"],
        "description_short": "Collect champions and battle in this turn-based RPG.",
        "fun_fact": "Became famous for its aggressive YouTube sponsorship campaigns.",
        "explanation_templates": {
            "time_fit": "Battles take a few minutes each.",
            "mood_fit": "Strategic team building.",
            "stop_fit": "Stop between battles."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "rise-of-kingdoms",
        "title": "Rise of Kingdoms",
        "platforms": ["mobile"],
        "release_year": 2018,
        "genre_tags": ["strategy", "4x", "pvp", "civilization"],
        "time_tags": [30, 60, 90],
        "energy_level": "medium",
        "mood_tags": ["strategic", "social"],
        "play_style": ["strategy"],
        "time_to_fun": "medium",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop", "competitive"],
        "description_short": "Build your civilization and conquer in real-time strategy.",
        "fun_fact": "Features 13 real historical civilizations to play as.",
        "explanation_templates": {
            "time_fit": "Set timers and check back.",
            "mood_fit": "Deep strategic empire building.",
            "stop_fit": "Building continues while away."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "free-fire",
        "title": "Free Fire",
        "platforms": ["mobile"],
        "release_year": 2017,
        "genre_tags": ["battle-royale", "shooter", "competitive"],
        "time_tags": [15, 30],
        "energy_level": "high",
        "mood_tags": ["intense", "competitive"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "commitment",
        "multiplayer_modes": ["competitive", "online_coop"],
        "description_short": "Fast-paced battle royale optimized for mobile.",
        "fun_fact": "Most downloaded mobile game globally in 2019.",
        "explanation_templates": {
            "time_fit": "Matches last about 10 minutes.",
            "mood_fit": "Quick, intense battle royale.",
            "stop_fit": "Commit to full matches."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "mobile-legends-bang-bang",
        "title": "Mobile Legends: Bang Bang",
        "platforms": ["mobile"],
        "release_year": 2016,
        "genre_tags": ["moba", "competitive", "action"],
        "time_tags": [15, 30],
        "energy_level": "high",
        "mood_tags": ["competitive", "fast-paced"],
        "play_style": ["action", "strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "commitment",
        "multiplayer_modes": ["competitive", "online_coop"],
        "description_short": "5v5 MOBA with fast matches designed for mobile.",
        "fun_fact": "Extremely popular in Southeast Asia with major esports tournaments.",
        "explanation_templates": {
            "time_fit": "Matches last 10-15 minutes.",
            "mood_fit": "Fast competitive MOBA action.",
            "stop_fit": "Commit to full matches."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "roblox-mobile",
        "title": "Roblox",
        "platforms": ["pc", "xbox", "mobile"],
        "release_year": 2006,
        "genre_tags": ["sandbox", "social", "creative", "multiplayer"],
        "time_tags": [15, 30, 60],
        "energy_level": "low",
        "mood_tags": ["creative", "social", "fun"],
        "play_style": ["sandbox_creative"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop", "competitive"],
        "description_short": "Platform with millions of user-created games and experiences.",
        "fun_fact": "Has more monthly active users than Minecraft and Fortnite combined.",
        "explanation_templates": {
            "time_fit": "Play any experience for any length.",
            "mood_fit": "Endless variety of games.",
            "stop_fit": "Leave any game anytime."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "fifa-mobile",
        "title": "EA Sports FC Mobile",
        "platforms": ["mobile"],
        "release_year": 2016,
        "genre_tags": ["sports", "soccer", "simulation"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["competitive", "sports"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "competitive"],
        "description_short": "Build your ultimate football team on mobile.",
        "fun_fact": "Rebranded from FIFA Mobile after EA lost the FIFA license.",
        "explanation_templates": {
            "time_fit": "Matches take 5-10 minutes.",
            "mood_fit": "Quick football action.",
            "stop_fit": "Complete matches then stop."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "cooking-fever",
        "title": "Cooking Fever",
        "platforms": ["mobile"],
        "release_year": 2014,
        "genre_tags": ["simulation", "time-management", "casual"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["fun", "hectic"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Run restaurants and serve customers in a cooking frenzy.",
        "fun_fact": "Features over 40 unique restaurant types to unlock.",
        "explanation_templates": {
            "time_fit": "Levels take 2-3 minutes.",
            "mood_fit": "Satisfying time-management gameplay.",
            "stop_fit": "Stop after any level."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "hay-day",
        "title": "Hay Day",
        "platforms": ["mobile"],
        "release_year": 2012,
        "genre_tags": ["simulation", "farming", "casual"],
        "time_tags": [15, 30, 60],
        "energy_level": "low",
        "mood_tags": ["relaxing", "casual"],
        "play_style": ["sandbox_creative"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop"],
        "description_short": "Build and manage your own farm.",
        "fun_fact": "Made by Supercell before they created Clash of Clans.",
        "explanation_templates": {
            "time_fit": "Check in whenever you want.",
            "mood_fit": "Relaxing farm management.",
            "stop_fit": "Crops grow while you're away."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "simcity-buildit",
        "title": "SimCity BuildIt",
        "platforms": ["mobile"],
        "release_year": 2014,
        "genre_tags": ["simulation", "city-builder", "strategy"],
        "time_tags": [15, 30, 60],
        "energy_level": "low",
        "mood_tags": ["creative", "strategic"],
        "play_style": ["strategy", "sandbox_creative"],
        "time_to_fun": "medium",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "competitive"],
        "description_short": "Design and build your dream city on mobile.",
        "fun_fact": "Cities can grow to populations of millions.",
        "explanation_templates": {
            "time_fit": "Build at your own pace.",
            "mood_fit": "Creative city planning.",
            "stop_fit": "City runs itself while away."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "township",
        "title": "Township",
        "platforms": ["mobile"],
        "release_year": 2013,
        "genre_tags": ["simulation", "farming", "city-builder", "casual"],
        "time_tags": [15, 30, 60],
        "energy_level": "low",
        "mood_tags": ["relaxing", "creative"],
        "play_style": ["sandbox_creative"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop"],
        "description_short": "Build a town and farm while trading with other players.",
        "fun_fact": "Combines farming and city-building into one relaxing experience.",
        "explanation_templates": {
            "time_fit": "Quick sessions or longer play.",
            "mood_fit": "Relaxing building and farming.",
            "stop_fit": "Progress continues offline."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "jetpack-joyride",
        "title": "Jetpack Joyride",
        "platforms": ["mobile"],
        "release_year": 2011,
        "genre_tags": ["endless-runner", "arcade", "action"],
        "time_tags": [15],
        "energy_level": "medium",
        "mood_tags": ["fun", "exciting"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Fly through a lab with a bullet-powered jetpack.",
        "fun_fact": "From the creators of Fruit Ninja.",
        "explanation_templates": {
            "time_fit": "Quick runs for any break.",
            "mood_fit": "Fun arcade action.",
            "stop_fit": "Each run is self-contained."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "dragon-ball-legends",
        "title": "Dragon Ball Legends",
        "platforms": ["mobile"],
        "release_year": 2018,
        "genre_tags": ["fighting", "action", "gacha", "anime"],
        "time_tags": [15, 30],
        "energy_level": "high",
        "mood_tags": ["action-packed", "exciting"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "competitive"],
        "description_short": "Card-action fighting with Dragon Ball characters.",
        "fun_fact": "Features characters from across all Dragon Ball series.",
        "explanation_templates": {
            "time_fit": "Battles take a few minutes.",
            "mood_fit": "Exciting anime battles.",
            "stop_fit": "Stop between battles."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "state-of-survival",
        "title": "State of Survival",
        "platforms": ["mobile"],
        "release_year": 2019,
        "genre_tags": ["strategy", "survival", "zombie", "base-building"],
        "time_tags": [15, 30, 60],
        "energy_level": "medium",
        "mood_tags": ["strategic", "tense"],
        "play_style": ["strategy"],
        "time_to_fun": "medium",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop"],
        "description_short": "Build a settlement and survive the zombie apocalypse.",
        "fun_fact": "One of the top-grossing strategy games on mobile.",
        "explanation_templates": {
            "time_fit": "Set tasks and check back.",
            "mood_fit": "Strategic survival planning.",
            "stop_fit": "Building continues offline."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "episode",
        "title": "Episode - Choose Your Story",
        "platforms": ["mobile"],
        "release_year": 2014,
        "genre_tags": ["interactive-fiction", "story", "romance"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["story-driven", "romantic"],
        "play_style": ["narrative"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Interactive stories where your choices shape the plot.",
        "fun_fact": "Has over 100,000 stories created by users.",
        "explanation_templates": {
            "time_fit": "Episodes take 10-15 minutes.",
            "mood_fit": "Engaging interactive stories.",
            "stop_fit": "Stop after any chapter."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "choices",
        "title": "Choices: Stories You Play",
        "platforms": ["mobile"],
        "release_year": 2016,
        "genre_tags": ["interactive-fiction", "story", "romance", "drama"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["story-driven", "emotional"],
        "play_style": ["narrative"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Play through interactive stories across many genres.",
        "fun_fact": "Stories range from romance to horror to fantasy.",
        "explanation_templates": {
            "time_fit": "Chapters take 10-15 minutes.",
            "mood_fit": "Immersive story experiences.",
            "stop_fit": "Stop between chapters."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "cookie-run-kingdom",
        "title": "Cookie Run: Kingdom",
        "platforms": ["mobile"],
        "release_year": 2021,
        "genre_tags": ["rpg", "gacha", "base-building", "action"],
        "time_tags": [15, 30, 60],
        "energy_level": "medium",
        "mood_tags": ["fun", "colorful"],
        "play_style": ["strategy", "action"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop"],
        "description_short": "Build a cookie kingdom and battle in sweet adventures.",
        "fun_fact": "Features adorable cookie characters with unique abilities.",
        "explanation_templates": {
            "time_fit": "Battles and building in short bursts.",
            "mood_fit": "Charming and colorful gameplay.",
            "stop_fit": "Kingdom builds while away."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "lords-mobile",
        "title": "Lords Mobile",
        "platforms": ["mobile"],
        "release_year": 2016,
        "genre_tags": ["strategy", "mmo", "war", "base-building"],
        "time_tags": [15, 30, 60],
        "energy_level": "medium",
        "mood_tags": ["strategic", "competitive"],
        "play_style": ["strategy"],
        "time_to_fun": "medium",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop", "competitive"],
        "description_short": "Build an empire and wage war in this MMO strategy.",
        "fun_fact": "Won Google Play's Best Competitive Game.",
        "explanation_templates": {
            "time_fit": "Set upgrades and battles.",
            "mood_fit": "Epic strategy warfare.",
            "stop_fit": "Progress continues offline."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "merge-mansion",
        "title": "Merge Mansion",
        "platforms": ["mobile"],
        "release_year": 2020,
        "genre_tags": ["puzzle", "merge", "mystery", "casual"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["relaxing", "mysterious"],
        "play_style": ["puzzle"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Merge items to renovate a mansion and uncover its secrets.",
        "fun_fact": "Features an intriguing mystery storyline with grandma Ursula.",
        "explanation_templates": {
            "time_fit": "Merge at your own pace.",
            "mood_fit": "Relaxing with a mystery twist.",
            "stop_fit": "Stop anytime."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "my-singing-monsters",
        "title": "My Singing Monsters",
        "platforms": ["mobile"],
        "release_year": 2012,
        "genre_tags": ["simulation", "music", "collecting", "casual"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["creative", "fun"],
        "play_style": ["sandbox_creative"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Collect monsters that sing together to create music.",
        "fun_fact": "Each island creates its own unique musical composition.",
        "explanation_templates": {
            "time_fit": "Check in to collect coins and breed.",
            "mood_fit": "Creative musical collecting.",
            "stop_fit": "Monsters sing while away."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "trivia-crack",
        "title": "Trivia Crack",
        "platforms": ["mobile"],
        "release_year": 2013,
        "genre_tags": ["trivia", "quiz", "casual", "social"],
        "time_tags": [15],
        "energy_level": "low",
        "mood_tags": ["fun", "social", "educational"],
        "play_style": ["puzzle"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["competitive"],
        "description_short": "Answer trivia questions and challenge friends.",
        "fun_fact": "Questions are user-submitted with millions in the database.",
        "explanation_templates": {
            "time_fit": "Quick trivia rounds.",
            "mood_fit": "Fun brain exercise.",
            "stop_fit": "Play turns at your pace."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "head-ball-2",
        "title": "Head Ball 2",
        "platforms": ["mobile"],
        "release_year": 2018,
        "genre_tags": ["sports", "soccer", "arcade", "competitive"],
        "time_tags": [15],
        "energy_level": "medium",
        "mood_tags": ["competitive", "fun"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["competitive"],
        "description_short": "1v1 soccer with big-headed characters.",
        "fun_fact": "Matches last just 90 seconds for quick competitive fun.",
        "explanation_templates": {
            "time_fit": "Matches are 90 seconds.",
            "mood_fit": "Quick competitive soccer.",
            "stop_fit": "Complete matches in under 2 minutes."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "duolingo",
        "title": "Duolingo",
        "platforms": ["mobile"],
        "release_year": 2012,
        "genre_tags": ["education", "language", "casual"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["educational", "rewarding"],
        "play_style": ["puzzle"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Learn languages through gamified lessons.",
        "fun_fact": "The owl mascot's persistent notifications became a famous meme.",
        "explanation_templates": {
            "time_fit": "Lessons take 5-10 minutes.",
            "mood_fit": "Productive learning in a game format.",
            "stop_fit": "Stop after any lesson."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "shadow-fight-3",
        "title": "Shadow Fight 3",
        "platforms": ["mobile"],
        "release_year": 2017,
        "genre_tags": ["fighting", "action", "rpg"],
        "time_tags": [15, 30],
        "energy_level": "high",
        "mood_tags": ["action-packed", "competitive"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "competitive"],
        "description_short": "Martial arts fighting RPG with stunning graphics.",
        "fun_fact": "Evolved from silhouette fighters to fully rendered 3D characters.",
        "explanation_templates": {
            "time_fit": "Fights take a few minutes.",
            "mood_fit": "Intense martial arts combat.",
            "stop_fit": "Stop between fights."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "wordle",
        "title": "Wordle",
        "platforms": ["mobile"],
        "release_year": 2021,
        "genre_tags": ["word", "puzzle", "daily"],
        "time_tags": [15],
        "energy_level": "low",
        "mood_tags": ["brain-teasing", "satisfying"],
        "play_style": ["puzzle"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Guess the five-letter word in six tries.",
        "fun_fact": "Became a viral sensation and was acquired by The New York Times.",
        "explanation_templates": {
            "time_fit": "One puzzle per day, takes minutes.",
            "mood_fit": "Satisfying daily brain teaser.",
            "stop_fit": "One puzzle, then done."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "sudoku",
        "title": "Sudoku.com",
        "platforms": ["mobile"],
        "release_year": 2017,
        "genre_tags": ["puzzle", "logic", "casual"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["relaxing", "brain-teasing"],
        "play_style": ["puzzle"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Classic number puzzles with daily challenges.",
        "fun_fact": "Sudoku originated in the US but became popular through Japan.",
        "explanation_templates": {
            "time_fit": "Puzzles take 5-20 minutes.",
            "mood_fit": "Relaxing logical thinking.",
            "stop_fit": "Save and resume anytime."
        },
        "subscription_services": [],
        "store_links": {}
    }
]

MOBILE_GAMES = [
    {
        "game_id": "candy-crush-saga",
        "title": "Candy Crush Saga",
        "platforms": ["mobile"],
        "release_year": 2012,
        "genre_tags": ["puzzle", "casual", "match-3"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["relaxing", "casual"],
        "play_style": ["puzzle"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Match colorful candies in this addictive puzzle game.",
        "fun_fact": "Over 2.7 billion downloads make it one of the most downloaded games ever.",
        "explanation_templates": {
            "time_fit": "Quick levels - perfect for short bursts.",
            "mood_fit": "Relaxing puzzle gameplay.",
            "stop_fit": "Stop after any level."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "clash-royale",
        "title": "Clash Royale",
        "platforms": ["mobile"],
        "release_year": 2016,
        "genre_tags": ["strategy", "card", "pvp", "competitive"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["competitive", "strategic"],
        "play_style": ["strategy", "card_game"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["competitive", "online_coop"],
        "description_short": "Real-time PvP card battler with tower defense mechanics.",
        "fun_fact": "Matches last just 3 minutes, making it perfect for quick sessions.",
        "explanation_templates": {
            "time_fit": "3-minute matches fit any schedule.",
            "mood_fit": "Strategic but fast-paced action.",
            "stop_fit": "Complete matches in under 5 minutes."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "genshin-impact",
        "title": "Genshin Impact",
        "platforms": ["pc", "playstation", "mobile"],
        "release_year": 2020,
        "genre_tags": ["rpg", "action", "open-world", "gacha", "adventure"],
        "time_tags": [30, 60, 90],
        "energy_level": "medium",
        "mood_tags": ["immersive", "exploration"],
        "play_style": ["action", "narrative"],
        "time_to_fun": "medium",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "online_coop"],
        "description_short": "Open-world action RPG with stunning visuals and gacha mechanics.",
        "fun_fact": "Cost over $100 million to develop, more than most AAA console games.",
        "explanation_templates": {
            "time_fit": "Daily commissions take about 20 minutes.",
            "mood_fit": "Beautiful world to explore at your pace.",
            "stop_fit": "Pause anytime in the open world."
        },
        "subscription_services": [],
        "store_links": {"steam": "https://store.steampowered.com/app/2567870/Genshin_Impact/"}
    },
    {
        "game_id": "pokemon-go",
        "title": "Pokemon GO",
        "platforms": ["mobile"],
        "release_year": 2016,
        "genre_tags": ["ar", "adventure", "collecting", "fitness"],
        "time_tags": [15, 30, 60],
        "energy_level": "low",
        "mood_tags": ["exploration", "casual", "social"],
        "play_style": ["sandbox_creative"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop"],
        "description_short": "Catch Pokemon in the real world using augmented reality.",
        "fun_fact": "Generated over $6 billion in revenue and encouraged millions to walk more.",
        "explanation_templates": {
            "time_fit": "Catch Pokemon on any walk.",
            "mood_fit": "Relaxing outdoor exploration.",
            "stop_fit": "Play as much or little as you want."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "subway-surfers",
        "title": "Subway Surfers",
        "platforms": ["mobile"],
        "release_year": 2012,
        "genre_tags": ["endless-runner", "arcade", "casual"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["exciting", "casual"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Dash through subway tracks while dodging trains and obstacles.",
        "fun_fact": "First game to reach 1 billion downloads on Google Play.",
        "explanation_templates": {
            "time_fit": "Quick runs lasting a few minutes.",
            "mood_fit": "Fast-paced but easy to pick up.",
            "stop_fit": "Each run is self-contained."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "call-of-duty-mobile",
        "title": "Call of Duty: Mobile",
        "platforms": ["mobile"],
        "release_year": 2019,
        "genre_tags": ["fps", "shooter", "battle-royale", "competitive"],
        "time_tags": [15, 30, 60],
        "energy_level": "high",
        "mood_tags": ["intense", "competitive"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["competitive", "online_coop"],
        "description_short": "Console-quality FPS action on mobile with multiplayer and battle royale.",
        "fun_fact": "Had 100 million downloads in its first week of release.",
        "explanation_templates": {
            "time_fit": "Matches run 5-15 minutes.",
            "mood_fit": "High-intensity competitive action.",
            "stop_fit": "Complete matches then stop."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "clash-of-clans",
        "title": "Clash of Clans",
        "platforms": ["mobile"],
        "release_year": 2012,
        "genre_tags": ["strategy", "base-building", "pvp"],
        "time_tags": [15, 30, 60],
        "energy_level": "low",
        "mood_tags": ["strategic", "casual"],
        "play_style": ["strategy"],
        "time_to_fun": "medium",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop", "competitive"],
        "description_short": "Build your village, train troops, and battle other players.",
        "fun_fact": "Still earning over $1 billion annually, over a decade after release.",
        "explanation_templates": {
            "time_fit": "Check in for a few minutes or play longer.",
            "mood_fit": "Relaxed base-building with strategic battles.",
            "stop_fit": "Set upgrades and come back later."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "brawl-stars",
        "title": "Brawl Stars",
        "platforms": ["mobile"],
        "release_year": 2018,
        "genre_tags": ["action", "shooter", "moba", "competitive"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["competitive", "fun"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["competitive", "online_coop"],
        "description_short": "Fast-paced 3v3 multiplayer battles with unique brawlers.",
        "fun_fact": "Made by Supercell, the same studio behind Clash of Clans.",
        "explanation_templates": {
            "time_fit": "Matches last just 2-3 minutes.",
            "mood_fit": "Quick, competitive fun.",
            "stop_fit": "Complete matches in under 5 minutes."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "angry-birds-2",
        "title": "Angry Birds 2",
        "platforms": ["mobile"],
        "release_year": 2015,
        "genre_tags": ["puzzle", "physics", "casual"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["casual", "fun"],
        "play_style": ["puzzle"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Fling birds at pig structures in this physics-based puzzler.",
        "fun_fact": "The original Angry Birds was rejected by multiple publishers before becoming a hit.",
        "explanation_templates": {
            "time_fit": "Quick levels for short sessions.",
            "mood_fit": "Satisfying physics puzzles.",
            "stop_fit": "Stop after any level."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "fruit-ninja",
        "title": "Fruit Ninja",
        "platforms": ["mobile"],
        "release_year": 2010,
        "genre_tags": ["arcade", "casual", "action"],
        "time_tags": [15],
        "energy_level": "low",
        "mood_tags": ["casual", "satisfying"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Slice fruit with your finger in this satisfying arcade game.",
        "fun_fact": "One of the first games to truly showcase touchscreen gaming potential.",
        "explanation_templates": {
            "time_fit": "Perfect for 5-minute breaks.",
            "mood_fit": "Simple, satisfying gameplay.",
            "stop_fit": "Each round is self-contained."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "plants-vs-zombies",
        "title": "Plants vs. Zombies",
        "platforms": ["pc", "mobile"],
        "release_year": 2009,
        "genre_tags": ["tower-defense", "strategy", "casual"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["fun", "strategic", "casual"],
        "play_style": ["strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Defend your lawn from zombies with an army of plants.",
        "fun_fact": "Created by PopCap, the game was so addictive EA bought the company for $750 million.",
        "explanation_templates": {
            "time_fit": "Levels take 5-10 minutes each.",
            "mood_fit": "Charming tower defense fun.",
            "stop_fit": "Save after each level."
        },
        "subscription_services": [],
        "store_links": {"steam": "https://store.steampowered.com/app/3590/Plants_vs_Zombies_GOTY_Edition/"}
    },
    {
        "game_id": "temple-run-2",
        "title": "Temple Run 2",
        "platforms": ["mobile"],
        "release_year": 2013,
        "genre_tags": ["endless-runner", "arcade", "casual"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["exciting", "casual"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Escape the temple while dodging obstacles in this endless runner.",
        "fun_fact": "Downloaded 50 million times in its first two weeks.",
        "explanation_templates": {
            "time_fit": "Quick runs for short breaks.",
            "mood_fit": "Exciting but simple gameplay.",
            "stop_fit": "Each run is self-contained."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "crossy-road",
        "title": "Crossy Road",
        "platforms": ["mobile"],
        "release_year": 2014,
        "genre_tags": ["arcade", "casual", "endless"],
        "time_tags": [15],
        "energy_level": "low",
        "mood_tags": ["casual", "fun"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Why did the chicken cross the road? To get a high score!",
        "fun_fact": "Inspired by Frogger, it earned $10 million in 90 days with no paid ads.",
        "explanation_templates": {
            "time_fit": "Perfect for 2-minute sessions.",
            "mood_fit": "Simple arcade fun.",
            "stop_fit": "Stop after any attempt."
        },
        "subscription_services": ["apple_arcade"],
        "store_links": {}
    },
    {
        "game_id": "asphalt-9",
        "title": "Asphalt 9: Legends",
        "platforms": ["pc", "switch", "mobile"],
        "release_year": 2018,
        "genre_tags": ["racing", "arcade", "action"],
        "time_tags": [15, 30],
        "energy_level": "high",
        "mood_tags": ["exciting", "thrilling"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "competitive"],
        "description_short": "High-octane arcade racing with stunning graphics.",
        "fun_fact": "Features real hypercars from Ferrari, Porsche, and Lamborghini.",
        "explanation_templates": {
            "time_fit": "Races take 2-3 minutes.",
            "mood_fit": "Thrilling arcade racing action.",
            "stop_fit": "Complete races then stop."
        },
        "subscription_services": [],
        "store_links": {"steam": "https://store.steampowered.com/app/1215520/Asphalt_9_Legends/"}
    },
    {
        "game_id": "pubg-mobile",
        "title": "PUBG Mobile",
        "platforms": ["mobile"],
        "release_year": 2018,
        "genre_tags": ["battle-royale", "shooter", "survival", "competitive"],
        "time_tags": [30, 60],
        "energy_level": "high",
        "mood_tags": ["intense", "competitive", "tactical"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "commitment",
        "multiplayer_modes": ["competitive", "online_coop"],
        "description_short": "100-player battle royale on mobile with realistic gunplay.",
        "fun_fact": "Has over 1 billion downloads and hosts major esports tournaments.",
        "explanation_templates": {
            "time_fit": "Matches run 20-30 minutes.",
            "mood_fit": "Intense tactical survival.",
            "stop_fit": "Commit to full matches."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "honkai-star-rail",
        "title": "Honkai: Star Rail",
        "platforms": ["pc", "mobile"],
        "release_year": 2023,
        "genre_tags": ["rpg", "turn-based", "gacha", "sci-fi"],
        "time_tags": [30, 60, 90],
        "energy_level": "low",
        "mood_tags": ["story-driven", "strategic"],
        "play_style": ["narrative", "strategy"],
        "time_to_fun": "medium",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Turn-based RPG set across the stars from the Genshin Impact creators.",
        "fun_fact": "Made by HoYoverse, the same team behind Genshin Impact.",
        "explanation_templates": {
            "time_fit": "Daily tasks take 20-30 minutes.",
            "mood_fit": "Strategic turn-based combat with great story.",
            "stop_fit": "Save between battles."
        },
        "subscription_services": [],
        "store_links": {"steam": "https://store.steampowered.com/app/1899640/Honkai_Star_Rail/"}
    },
    {
        "game_id": "stumble-guys",
        "title": "Stumble Guys",
        "platforms": ["pc", "playstation", "xbox", "switch", "mobile"],
        "release_year": 2021,
        "genre_tags": ["party", "battle-royale", "casual"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["fun", "chaotic", "social"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["competitive"],
        "description_short": "Knockout party game where 32 players compete through obstacle courses.",
        "fun_fact": "A mobile-first take on the Fall Guys formula that found massive success.",
        "explanation_templates": {
            "time_fit": "Rounds take just a few minutes.",
            "mood_fit": "Chaotic party game fun.",
            "stop_fit": "Stop after any round."
        },
        "subscription_services": [],
        "store_links": {"steam": "https://store.steampowered.com/app/1677740/Stumble_Guys/"}
    },
    {
        "game_id": "cut-the-rope",
        "title": "Cut the Rope",
        "platforms": ["mobile"],
        "release_year": 2010,
        "genre_tags": ["puzzle", "physics", "casual"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["relaxing", "clever"],
        "play_style": ["puzzle"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Cut ropes to feed candy to the adorable Om Nom.",
        "fun_fact": "Won Apple's Game of the Year and spawned a whole franchise including a cartoon.",
        "explanation_templates": {
            "time_fit": "Quick puzzles for short sessions.",
            "mood_fit": "Relaxing brain teasers.",
            "stop_fit": "Stop after any level."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "wordscapes",
        "title": "Wordscapes",
        "platforms": ["mobile"],
        "release_year": 2017,
        "genre_tags": ["word", "puzzle", "casual"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["relaxing", "mentally-stimulating"],
        "play_style": ["puzzle"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Connect letters to form words in beautiful landscapes.",
        "fun_fact": "One of the top-grossing word games with over 10 million daily players.",
        "explanation_templates": {
            "time_fit": "Perfect for short mental breaks.",
            "mood_fit": "Relaxing word puzzles.",
            "stop_fit": "Stop after any puzzle."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "archero",
        "title": "Archero",
        "platforms": ["mobile"],
        "release_year": 2019,
        "genre_tags": ["action", "roguelike", "shooter"],
        "time_tags": [15, 30],
        "energy_level": "medium",
        "mood_tags": ["action-packed", "addictive"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Shoot your way through dungeons in this roguelike archer game.",
        "fun_fact": "Popularized the 'survivor-like' genre on mobile before Vampire Survivors.",
        "explanation_templates": {
            "time_fit": "Runs take 10-15 minutes.",
            "mood_fit": "Action-packed dungeon runs.",
            "stop_fit": "Progress saves between stages."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "two-dots",
        "title": "Two Dots",
        "platforms": ["mobile"],
        "release_year": 2014,
        "genre_tags": ["puzzle", "casual", "minimalist"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["relaxing", "meditative"],
        "play_style": ["puzzle"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Connect dots of the same color in this minimalist puzzler.",
        "fun_fact": "Features beautiful art inspired by real locations around the world.",
        "explanation_templates": {
            "time_fit": "Quick levels for short breaks.",
            "mood_fit": "Meditative puzzle gameplay.",
            "stop_fit": "Stop after any level."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "homescapes",
        "title": "Homescapes",
        "platforms": ["mobile"],
        "release_year": 2017,
        "genre_tags": ["puzzle", "match-3", "casual", "story"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["relaxing", "story-driven"],
        "play_style": ["puzzle", "narrative"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Solve match-3 puzzles to renovate a mansion and uncover its story.",
        "fun_fact": "Made by Playrix, whose games are played by over 100 million people monthly.",
        "explanation_templates": {
            "time_fit": "Quick puzzles for short sessions.",
            "mood_fit": "Relaxing with a story to follow.",
            "stop_fit": "Stop after any level."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "royal-match",
        "title": "Royal Match",
        "platforms": ["mobile"],
        "release_year": 2021,
        "genre_tags": ["puzzle", "match-3", "casual"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["relaxing", "casual"],
        "play_style": ["puzzle"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Match-3 puzzles to help King Robert restore his castle.",
        "fun_fact": "Became one of the top 10 grossing games faster than any other match-3 game.",
        "explanation_templates": {
            "time_fit": "Quick puzzles fit any schedule.",
            "mood_fit": "Relaxing match-3 gameplay.",
            "stop_fit": "Stop after any level."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "gardenscapes",
        "title": "Gardenscapes",
        "platforms": ["mobile"],
        "release_year": 2016,
        "genre_tags": ["puzzle", "match-3", "casual", "story"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["relaxing", "story-driven"],
        "play_style": ["puzzle", "narrative"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Solve match-3 puzzles to restore a beautiful garden.",
        "fun_fact": "Features Austin the butler, who became an internet meme due to misleading ads.",
        "explanation_templates": {
            "time_fit": "Quick puzzles for short sessions.",
            "mood_fit": "Relaxing with garden building.",
            "stop_fit": "Stop after any level."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "mini-metro-mobile",
        "title": "Mini Metro",
        "platforms": ["pc", "switch", "mobile"],
        "release_year": 2015,
        "genre_tags": ["puzzle", "strategy", "minimalist", "simulation"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["relaxing", "strategic"],
        "play_style": ["puzzle", "strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Design subway networks for growing cities.",
        "fun_fact": "Based on real city metro maps from London, Paris, New York and more.",
        "explanation_templates": {
            "time_fit": "Sessions last 10-20 minutes.",
            "mood_fit": "Zen-like strategic planning.",
            "stop_fit": "Pause or end anytime."
        },
        "subscription_services": [],
        "store_links": {"steam": "https://store.steampowered.com/app/287980/Mini_Metro/"}
    },
    {
        "game_id": "bad-piggies",
        "title": "Bad Piggies",
        "platforms": ["mobile"],
        "release_year": 2012,
        "genre_tags": ["puzzle", "physics", "building"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["creative", "fun"],
        "play_style": ["puzzle", "sandbox_creative"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Build contraptions to help the pigs reach their goal.",
        "fun_fact": "A spin-off from Angry Birds where you play as the pigs.",
        "explanation_templates": {
            "time_fit": "Quick levels for short breaks.",
            "mood_fit": "Creative vehicle building.",
            "stop_fit": "Stop after any level."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "flappy-bird",
        "title": "Flappy Bird",
        "platforms": ["mobile"],
        "release_year": 2013,
        "genre_tags": ["arcade", "casual", "difficult"],
        "time_tags": [15],
        "energy_level": "medium",
        "mood_tags": ["challenging", "addictive"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Tap to fly through pipes in this notoriously difficult game.",
        "fun_fact": "The creator removed it from stores at peak popularity due to its addictive nature.",
        "explanation_templates": {
            "time_fit": "Quick attempts lasting seconds.",
            "mood_fit": "Challenging one-more-try gameplay.",
            "stop_fit": "Stop after any attempt."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "hill-climb-racing",
        "title": "Hill Climb Racing",
        "platforms": ["mobile"],
        "release_year": 2012,
        "genre_tags": ["racing", "physics", "casual"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["fun", "casual"],
        "play_style": ["action"],
        "time_to_fun": "short",
        "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Drive uphill while managing fuel and physics.",
        "fun_fact": "Made by a one-person Finnish studio and has over 1 billion downloads.",
        "explanation_templates": {
            "time_fit": "Quick runs for short breaks.",
            "mood_fit": "Fun physics-based driving.",
            "stop_fit": "Stop after any run."
        },
        "subscription_services": [],
        "store_links": {}
    },
    {
        "game_id": "8-ball-pool",
        "title": "8 Ball Pool",
        "platforms": ["mobile"],
        "release_year": 2010,
        "genre_tags": ["sports", "casual", "pvp"],
        "time_tags": [15, 30],
        "energy_level": "low",
        "mood_tags": ["competitive", "relaxing"],
        "play_style": ["strategy"],
        "time_to_fun": "short",
        "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["competitive"],
        "description_short": "Play pool against players worldwide in this realistic simulation.",
        "fun_fact": "Has over 500 million downloads and is one of the most played mobile games.",
        "explanation_templates": {
            "time_fit": "Matches take 5-10 minutes.",
            "mood_fit": "Relaxing competitive pool.",
            "stop_fit": "Complete matches then stop."
        },
        "subscription_services": [],
        "store_links": {}
    }
]

def add_games():
    added = 0
    skipped = 0
    updated = 0

    # Process all batches
    all_games = MOBILE_GAMES + MOBILE_GAMES_BATCH_2 + MOBILE_GAMES_BATCH_3 + MOBILE_GAMES_BATCH_4

    for game in all_games:
        game_id = game["game_id"]

        # Check if game already exists
        existing = games_ref.document(game_id).get()
        if existing.exists:
            # Check if it needs mobile platform added
            existing_data = existing.to_dict()
            existing_platforms = existing_data.get('platforms', [])
            if 'mobile' not in existing_platforms and 'mobile' in game['platforms']:
                # Add mobile to existing game
                new_platforms = existing_platforms + ['mobile']
                games_ref.document(game_id).update({'platforms': new_platforms})
                print(f"Updated {game['title']} - added mobile platform")
                updated += 1
            else:
                print(f"Skipping {game['title']} - already exists")
                skipped += 1
            continue

        # Add timestamps
        game["created_at"] = datetime.utcnow()
        game["updated_at"] = datetime.utcnow()

        # Add to Firestore
        games_ref.document(game_id).set(game)
        print(f"Added: {game['title']}")
        added += 1

    print(f"\nDone! Added {added} games, updated {updated} games, skipped {skipped} existing")

if __name__ == "__main__":
    add_games()
