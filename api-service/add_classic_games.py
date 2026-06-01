"""
Add timeless classics and notable catalog gaps (pre-2015 canon + zero-coverage
mega-franchises + missing live-service/MOBA titles).

The catalog skewed heavily to 2015+ (0 games before 2000, ~10 in the 2000s).
These fill that "classic / nostalgic" lane plus franchises that had no entries
at all (Grand Theft Auto, Half-Life, BioShock) and missing MOBAs.

Platforms reflect where each game is reasonably PLAYABLE TODAY (remasters,
ports, subscription services), so recommendations are actionable. Release_year
is the original release year. Valid enum values only (see src/models/game.py).
store_links left empty to avoid unverified URLs.

Usage:  python add_classic_games.py
"""

import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {'projectId': 'playnxt-1a2c6'})

db = firestore.client()
games_ref = db.collection('games')

CLASSIC_GAMES = [
    # ===================== TIMELESS SINGLE-PLAYER CLASSICS =====================
    {
        "game_id": "half-life-2", "title": "Half-Life 2", "platforms": ["pc"],
        "release_year": 2004, "genre_tags": ["fps", "shooter", "sci-fi", "narrative"],
        "time_tags": [60, 90], "energy_level": "high", "mood_tags": ["immersive", "tense", "atmospheric"],
        "play_style": ["action", "narrative"], "time_to_fun": "short", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "A genre-defining first-person shooter through the dystopian City 17.",
        "fun_fact": "Pioneered physics-based gameplay with its Gravity Gun.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "half-life-1", "title": "Half-Life", "platforms": ["pc"],
        "release_year": 1998, "genre_tags": ["fps", "shooter", "sci-fi"],
        "time_tags": [60, 90], "energy_level": "high", "mood_tags": ["tense", "atmospheric", "immersive"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "The seminal shooter that put story and atmosphere into the FPS.",
        "fun_fact": "You play silent physicist Gordon Freeman, who never speaks a line.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "bioshock", "title": "BioShock", "platforms": ["pc", "playstation", "xbox", "switch"],
        "release_year": 2007, "genre_tags": ["fps", "shooter", "horror", "narrative"],
        "time_tags": [60, 90], "energy_level": "high", "mood_tags": ["atmospheric", "tense", "thought-provoking"],
        "play_style": ["action", "narrative"], "time_to_fun": "medium", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Explore the fallen underwater city of Rapture in this atmospheric shooter.",
        "fun_fact": "Its 'Would you kindly?' twist is one of gaming's most famous moments.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "bioshock-infinite", "title": "BioShock Infinite", "platforms": ["pc", "playstation", "xbox", "switch"],
        "release_year": 2013, "genre_tags": ["fps", "shooter", "narrative", "sci-fi"],
        "time_tags": [60, 90], "energy_level": "high", "mood_tags": ["immersive", "thought-provoking", "stylish"],
        "play_style": ["action", "narrative"], "time_to_fun": "medium", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Rescue a mysterious woman from the floating city of Columbia.",
        "fun_fact": "Its mind-bending ending sparked years of fan theories.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "ocarina-of-time", "title": "The Legend of Zelda: Ocarina of Time", "platforms": ["switch"],
        "release_year": 1998, "genre_tags": ["action-adventure", "rpg", "fantasy"],
        "time_tags": [60, 90], "energy_level": "medium", "mood_tags": ["adventurous", "nostalgic", "immersive"],
        "play_style": ["action", "narrative"], "time_to_fun": "medium", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "The 3D Zelda adventure that defined action-adventure gaming.",
        "fun_fact": "Often cited as the highest-rated game of all time.",
        "explanation_templates": {}, "subscription_services": ["nintendo_switch_online"], "store_links": {}
    },
    {
        "game_id": "shadow-of-the-colossus", "title": "Shadow of the Colossus", "platforms": ["playstation"],
        "release_year": 2005, "genre_tags": ["action-adventure", "artistic", "fantasy"],
        "time_tags": [30, 60], "energy_level": "medium", "mood_tags": ["beautiful", "melancholic", "epic"],
        "play_style": ["action"], "time_to_fun": "medium", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Topple sixteen towering colossi in a hauntingly beautiful world.",
        "fun_fact": "There are no regular enemies — every fight is a boss.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "metal-gear-solid", "title": "Metal Gear Solid", "platforms": ["pc", "playstation", "xbox", "switch"],
        "release_year": 1998, "genre_tags": ["action", "stealth", "narrative"],
        "time_tags": [60, 90], "energy_level": "medium", "mood_tags": ["cinematic", "tense", "immersive"],
        "play_style": ["action", "narrative"], "time_to_fun": "medium", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "The stealth-action classic that brought cinematic storytelling to games.",
        "fun_fact": "A boss could 'read your memory card' to mess with you.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "dark-souls-remastered", "title": "Dark Souls Remastered", "platforms": ["pc", "playstation", "xbox", "switch"],
        "release_year": 2011, "genre_tags": ["action-rpg", "souls-like", "fantasy", "dark-fantasy"],
        "time_tags": [60, 90], "energy_level": "high", "mood_tags": ["challenging", "atmospheric", "rewarding"],
        "play_style": ["action"], "time_to_fun": "long", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "online_coop"],
        "description_short": "The brutally difficult action-RPG that launched the souls-like genre.",
        "fun_fact": "Its interconnected world map is considered a design masterpiece.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "chrono-trigger", "title": "Chrono Trigger", "platforms": ["pc", "mobile"],
        "release_year": 1995, "genre_tags": ["rpg", "jrpg", "turn-based", "time-travel"],
        "time_tags": [30, 60], "energy_level": "low", "mood_tags": ["nostalgic", "story-driven", "adventurous"],
        "play_style": ["narrative", "strategy"], "time_to_fun": "medium", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "The legendary time-travel JRPG with multiple endings.",
        "fun_fact": "Created by a 'Dream Team' including the makers of Final Fantasy and Dragon Quest.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "bastion", "title": "Bastion", "platforms": ["pc", "playstation", "xbox", "switch", "mobile"],
        "release_year": 2011, "genre_tags": ["action-rpg", "indie", "narrative"],
        "time_tags": [30, 60], "energy_level": "medium", "mood_tags": ["artistic", "atmospheric", "charming"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "An action-RPG narrated in real time as you rebuild a shattered world.",
        "fun_fact": "Supergiant Games' debut, before Hades.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "uncharted-4", "title": "Uncharted 4: A Thief's End", "platforms": ["pc", "playstation"],
        "release_year": 2016, "genre_tags": ["action-adventure", "narrative", "cinematic"],
        "time_tags": [60, 90], "energy_level": "medium", "mood_tags": ["cinematic", "adventurous", "story-driven"],
        "play_style": ["action", "narrative"], "time_to_fun": "short", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Nathan Drake's globe-trotting treasure-hunting finale.",
        "fun_fact": "Its set-pieces rival Hollywood blockbusters.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "kingdom-hearts-3", "title": "Kingdom Hearts III", "platforms": ["pc", "playstation", "xbox"],
        "release_year": 2019, "genre_tags": ["action-rpg", "jrpg", "fantasy"],
        "time_tags": [60, 90], "energy_level": "medium", "mood_tags": ["adventurous", "emotional", "whimsical"],
        "play_style": ["action", "narrative"], "time_to_fun": "medium", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Disney and Final Fantasy collide in this action-RPG adventure.",
        "fun_fact": "Visit worlds from Toy Story, Frozen, and more.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "okami-hd", "title": "Okami HD", "platforms": ["pc", "playstation", "xbox", "switch"],
        "release_year": 2006, "genre_tags": ["action-adventure", "artistic", "fantasy"],
        "time_tags": [60, 90], "energy_level": "medium", "mood_tags": ["beautiful", "relaxing", "adventurous"],
        "play_style": ["action"], "time_to_fun": "medium", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Play a sun goddess wolf in a world painted like Japanese ink art.",
        "fun_fact": "You use a 'Celestial Brush' to paint actions into the world.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "final-fantasy-7", "title": "Final Fantasy VII", "platforms": ["pc", "playstation", "xbox", "switch", "mobile"],
        "release_year": 1997, "genre_tags": ["rpg", "jrpg", "turn-based", "sci-fi"],
        "time_tags": [60, 90], "energy_level": "low", "mood_tags": ["story-driven", "nostalgic", "epic"],
        "play_style": ["narrative", "strategy"], "time_to_fun": "long", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "The genre-defining JRPG that brought Cloud and Sephiroth to the world.",
        "fun_fact": "Its release made the PlayStation a must-own console.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },

    # ===================== ZERO-COVERAGE MEGA-FRANCHISES =====================
    {
        "game_id": "gta-5", "title": "Grand Theft Auto V", "platforms": ["pc", "playstation", "xbox"],
        "release_year": 2013, "genre_tags": ["action", "open-world", "crime", "shooter"],
        "time_tags": [60, 90], "energy_level": "high", "mood_tags": ["chaotic", "immersive", "fun"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop", "competitive"],
        "description_short": "Three criminals, one sprawling open world, endless mayhem.",
        "fun_fact": "One of the best-selling games of all time, with 190M+ copies sold.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "gta-san-andreas", "title": "Grand Theft Auto: San Andreas", "platforms": ["pc", "playstation", "xbox", "switch", "mobile"],
        "release_year": 2004, "genre_tags": ["action", "open-world", "crime"],
        "time_tags": [60, 90], "energy_level": "high", "mood_tags": ["nostalgic", "chaotic", "fun"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "CJ returns to the streets of San Andreas in this open-world classic.",
        "fun_fact": "Its huge map spanned three cities and the countryside between them.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "tomb-raider-2013", "title": "Tomb Raider", "platforms": ["pc", "playstation", "xbox"],
        "release_year": 2013, "genre_tags": ["action-adventure", "survival", "narrative"],
        "time_tags": [60, 90], "energy_level": "medium", "mood_tags": ["adventurous", "tense", "cinematic"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "A gritty origin story for a young Lara Croft.",
        "fun_fact": "Rebooted the franchise into a survival-action series.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "assassins-creed-black-flag", "title": "Assassin's Creed IV: Black Flag", "platforms": ["pc", "playstation", "xbox"],
        "release_year": 2013, "genre_tags": ["action", "open-world", "pirates", "stealth"],
        "time_tags": [60, 90], "energy_level": "medium", "mood_tags": ["adventurous", "immersive", "fun"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Sail the Caribbean as a pirate in the beloved Assassin's Creed entry.",
        "fun_fact": "Its naval combat and sea shanties became fan favorites.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "assassins-creed-2", "title": "Assassin's Creed II", "platforms": ["pc", "playstation", "xbox"],
        "release_year": 2009, "genre_tags": ["action", "open-world", "stealth", "historical"],
        "time_tags": [60, 90], "energy_level": "medium", "mood_tags": ["adventurous", "immersive", "story-driven"],
        "play_style": ["action", "narrative"], "time_to_fun": "medium", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Become Ezio in Renaissance Italy in the series' breakout hit.",
        "fun_fact": "Ezio became the franchise's most beloved protagonist.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "call-of-duty-modern-warfare", "title": "Call of Duty: Modern Warfare", "platforms": ["pc", "playstation", "xbox"],
        "release_year": 2019, "genre_tags": ["fps", "shooter", "military", "multiplayer"],
        "time_tags": [15, 30, 60], "energy_level": "high", "mood_tags": ["intense", "competitive", "action-packed"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "online_coop", "competitive"],
        "description_short": "A gritty reboot of the iconic military shooter franchise.",
        "fun_fact": "Relaunched the 'Modern Warfare' sub-series and Warzone.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "halo-mcc", "title": "Halo: The Master Chief Collection", "platforms": ["pc", "xbox"],
        "release_year": 2014, "genre_tags": ["fps", "shooter", "sci-fi", "multiplayer"],
        "time_tags": [30, 60], "energy_level": "high", "mood_tags": ["epic", "nostalgic", "competitive"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "local_coop", "online_coop", "competitive"],
        "description_short": "Six classic Halo campaigns and their multiplayer in one package.",
        "fun_fact": "Bundles the games that defined console shooters.",
        "explanation_templates": {}, "subscription_services": ["game_pass"], "store_links": {}
    },
    {
        "game_id": "gears-of-war", "title": "Gears of War: Ultimate Edition", "platforms": ["pc", "xbox"],
        "release_year": 2006, "genre_tags": ["shooter", "third-person-shooter", "sci-fi", "co-op"],
        "time_tags": [30, 60], "energy_level": "high", "mood_tags": ["intense", "action-packed", "gritty"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "local_coop", "online_coop", "competitive"],
        "description_short": "Cover-based third-person shooting against the Locust Horde.",
        "fun_fact": "Popularized the cover-shooter mechanic for a generation.",
        "explanation_templates": {}, "subscription_services": ["game_pass"], "store_links": {}
    },
    {
        "game_id": "far-cry-3", "title": "Far Cry 3", "platforms": ["pc", "playstation", "xbox"],
        "release_year": 2012, "genre_tags": ["fps", "open-world", "action"],
        "time_tags": [60, 90], "energy_level": "high", "mood_tags": ["immersive", "tense", "adventurous"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop"],
        "description_short": "Survive a lawless island ruled by the unforgettable villain Vaas.",
        "fun_fact": "Defined the modern open-world Far Cry formula.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "borderlands-2", "title": "Borderlands 2", "platforms": ["pc", "playstation", "xbox", "switch"],
        "release_year": 2012, "genre_tags": ["fps", "looter-shooter", "rpg", "co-op"],
        "time_tags": [30, 60, 90], "energy_level": "high", "mood_tags": ["humorous", "cooperative", "action-packed"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "online_coop", "local_coop"],
        "description_short": "The beloved looter-shooter with Handsome Jack as the antagonist.",
        "fun_fact": "Widely regarded as the series' high point.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "fallout-new-vegas", "title": "Fallout: New Vegas", "platforms": ["pc", "playstation", "xbox"],
        "release_year": 2010, "genre_tags": ["rpg", "fps", "open-world", "post-apocalyptic"],
        "time_tags": [60, 90], "energy_level": "medium", "mood_tags": ["immersive", "story-driven", "atmospheric"],
        "play_style": ["narrative", "action"], "time_to_fun": "medium", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Branching choices and factions in the Mojave wasteland.",
        "fun_fact": "Made by Obsidian in just 18 months, yet a fan favorite.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },

    # ===================== ACTION / FPS CLASSICS =====================
    {
        "game_id": "dishonored", "title": "Dishonored", "platforms": ["pc", "playstation", "xbox"],
        "release_year": 2012, "genre_tags": ["action", "stealth", "immersive-sim"],
        "time_tags": [60, 90], "energy_level": "medium", "mood_tags": ["atmospheric", "stylish", "tense"],
        "play_style": ["action"], "time_to_fun": "medium", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Supernatural stealth assassination in the plague city of Dunwall.",
        "fun_fact": "You can finish the game without killing anyone.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "max-payne-3", "title": "Max Payne 3", "platforms": ["pc", "playstation", "xbox"],
        "release_year": 2012, "genre_tags": ["action", "shooter", "third-person-shooter", "narrative"],
        "time_tags": [30, 60], "energy_level": "high", "mood_tags": ["gritty", "cinematic", "intense"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Slow-motion gunfights and noir storytelling in São Paulo.",
        "fun_fact": "Its bullet-time shootdowns are a series signature.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "doom-1993", "title": "DOOM (1993)", "platforms": ["pc", "playstation", "xbox", "switch"],
        "release_year": 1993, "genre_tags": ["fps", "shooter", "retro", "demons"],
        "time_tags": [15, 30], "energy_level": "high", "mood_tags": ["intense", "nostalgic", "action-packed"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "online_coop", "competitive"],
        "description_short": "The original demon-blasting shooter that birthed the genre.",
        "fun_fact": "It's been ported to nearly every device imaginable.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },

    # ===================== RACING CLASSICS =====================
    {
        "game_id": "burnout-paradise", "title": "Burnout Paradise Remastered", "platforms": ["pc", "playstation", "xbox", "switch"],
        "release_year": 2008, "genre_tags": ["racing", "open-world", "arcade", "destruction"],
        "time_tags": [15, 30], "energy_level": "high", "mood_tags": ["exciting", "fun", "chaotic"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop", "competitive"],
        "description_short": "High-speed open-world arcade racing and spectacular crashes.",
        "fun_fact": "Famous for its satisfying slow-motion 'takedowns'.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "forza-horizon-4", "title": "Forza Horizon 4", "platforms": ["pc", "xbox"],
        "release_year": 2018, "genre_tags": ["racing", "open-world", "simulation"],
        "time_tags": [30, 60], "energy_level": "medium", "mood_tags": ["relaxing", "exciting", "adventurous"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop", "competitive"],
        "description_short": "Open-world racing across a beautiful Britain with changing seasons.",
        "fun_fact": "The map's seasons changed for every player at once each week.",
        "explanation_templates": {}, "subscription_services": ["game_pass"], "store_links": {}
    },
    {
        "game_id": "trackmania", "title": "Trackmania", "platforms": ["pc"],
        "release_year": 2020, "genre_tags": ["racing", "arcade", "competitive", "time-trial"],
        "time_tags": [15, 30], "energy_level": "high", "mood_tags": ["competitive", "addictive", "fun"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "competitive"],
        "description_short": "Precision time-trial racing on wild stunt tracks.",
        "fun_fact": "A staple of the speedrunning and esports scenes.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },

    # ===================== STRATEGY / SIM CLASSICS =====================
    {
        "game_id": "age-of-empires-2-de", "title": "Age of Empires II: Definitive Edition", "platforms": ["pc", "xbox"],
        "release_year": 1999, "genre_tags": ["strategy", "rts", "historical"],
        "time_tags": [30, 60, 90], "energy_level": "medium", "mood_tags": ["strategic", "competitive", "focused"],
        "play_style": ["strategy"], "time_to_fun": "medium", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "online_coop", "competitive"],
        "description_short": "The definitive real-time strategy classic, still updated today.",
        "fun_fact": "Its competitive scene is thriving over two decades later.",
        "explanation_templates": {}, "subscription_services": ["game_pass"], "store_links": {}
    },
    {
        "game_id": "the-sims-4", "title": "The Sims 4", "platforms": ["pc", "playstation", "xbox"],
        "release_year": 2014, "genre_tags": ["simulation", "life-sim", "sandbox"],
        "time_tags": [30, 60, 90], "energy_level": "low", "mood_tags": ["relaxing", "creative", "cozy"],
        "play_style": ["sandbox_creative"], "time_to_fun": "short", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "Create people, build homes, and shape their lives.",
        "fun_fact": "Went free-to-play in 2022.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "diablo-2-resurrected", "title": "Diablo II: Resurrected", "platforms": ["pc", "playstation", "xbox", "switch"],
        "release_year": 2021, "genre_tags": ["action-rpg", "arpg", "loot", "dark-fantasy"],
        "time_tags": [30, 60], "energy_level": "medium", "mood_tags": ["addictive", "dark", "rewarding"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "online_coop"],
        "description_short": "A faithful remaster of the genre-defining loot ARPG.",
        "fun_fact": "The original's loot-grind set the template for the genre.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },

    # ===================== PLATFORMER / RETRO CLASSICS =====================
    {
        "game_id": "super-mario-64", "title": "Super Mario 64", "platforms": ["switch"],
        "release_year": 1996, "genre_tags": ["platformer", "3d", "retro"],
        "time_tags": [30, 60], "energy_level": "medium", "mood_tags": ["nostalgic", "joyful", "adventurous"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "The 3D platformer that defined how to move in three dimensions.",
        "fun_fact": "Launched alongside the Nintendo 64 in 1996.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "super-mario-bros-3", "title": "Super Mario Bros. 3", "platforms": ["switch"],
        "release_year": 1988, "genre_tags": ["platformer", "2d", "retro"],
        "time_tags": [15, 30], "energy_level": "medium", "mood_tags": ["nostalgic", "fun", "joyful"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "local_coop"],
        "description_short": "One of the greatest 2D platformers ever made.",
        "fun_fact": "Introduced the iconic Tanooki Suit.",
        "explanation_templates": {}, "subscription_services": ["nintendo_switch_online"], "store_links": {}
    },
    {
        "game_id": "banjo-kazooie", "title": "Banjo-Kazooie", "platforms": ["xbox", "switch"],
        "release_year": 1998, "genre_tags": ["platformer", "3d", "collectathon", "retro"],
        "time_tags": [30, 60], "energy_level": "medium", "mood_tags": ["charming", "nostalgic", "fun"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "A bear and bird duo in a beloved collect-a-thon platformer.",
        "fun_fact": "A high point of the Nintendo 64's golden age of platformers.",
        "explanation_templates": {}, "subscription_services": ["game_pass"], "store_links": {}
    },
    {
        "game_id": "sonic-mania", "title": "Sonic Mania", "platforms": ["pc", "playstation", "xbox", "switch"],
        "release_year": 2017, "genre_tags": ["platformer", "2d", "retro", "arcade"],
        "time_tags": [15, 30], "energy_level": "medium", "mood_tags": ["nostalgic", "fast-paced", "fun"],
        "play_style": ["action"], "time_to_fun": "short", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo", "local_coop"],
        "description_short": "A love letter to classic 2D Sonic, made by fans.",
        "fun_fact": "Widely hailed as the best Sonic game in decades.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },

    # ===================== LIVE-SERVICE / MOBA / MOBILE HOLES =====================
    {
        "game_id": "league-of-legends", "title": "League of Legends", "platforms": ["pc"],
        "release_year": 2009, "genre_tags": ["moba", "strategy", "competitive", "multiplayer"],
        "time_tags": [30, 60], "energy_level": "high", "mood_tags": ["competitive", "strategic", "team-based"],
        "play_style": ["strategy", "action"], "time_to_fun": "medium", "stop_friendliness": "commitment",
        "multiplayer_modes": ["competitive", "online_coop"],
        "description_short": "The world's biggest MOBA — 5v5 team battles.",
        "fun_fact": "Its World Championship fills arenas worldwide.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "dota-2", "title": "Dota 2", "platforms": ["pc"],
        "release_year": 2013, "genre_tags": ["moba", "strategy", "competitive", "multiplayer"],
        "time_tags": [30, 60], "energy_level": "high", "mood_tags": ["competitive", "strategic", "intense"],
        "play_style": ["strategy", "action"], "time_to_fun": "long", "stop_friendliness": "commitment",
        "multiplayer_modes": ["competitive", "online_coop"],
        "description_short": "Valve's deep, demanding 5v5 MOBA.",
        "fun_fact": "Its tournament The International has had the largest esports prize pools.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "smite", "title": "Smite", "platforms": ["pc", "playstation", "xbox", "switch"],
        "release_year": 2014, "genre_tags": ["moba", "action", "competitive", "mythology"],
        "time_tags": [30, 60], "energy_level": "high", "mood_tags": ["competitive", "team-based", "action-packed"],
        "play_style": ["action", "strategy"], "time_to_fun": "medium", "stop_friendliness": "commitment",
        "multiplayer_modes": ["competitive", "online_coop"],
        "description_short": "A third-person MOBA where you play mythological gods.",
        "fun_fact": "Its over-the-shoulder camera sets it apart from other MOBAs.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "old-school-runescape", "title": "Old School RuneScape", "platforms": ["pc", "mobile"],
        "release_year": 2013, "genre_tags": ["mmo", "rpg", "fantasy", "grind"],
        "time_tags": [30, 60, 90], "energy_level": "low", "mood_tags": ["relaxing", "nostalgic", "social"],
        "play_style": ["narrative", "strategy"], "time_to_fun": "long", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo", "online_coop"],
        "description_short": "The beloved point-and-click MMORPG, faithful to its 2007 roots.",
        "fun_fact": "Updates are decided by player polls.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },

    # ===================== MORE CLASSIC RPGs / HORROR =====================
    {
        "game_id": "final-fantasy-10", "title": "Final Fantasy X/X-2 HD Remaster", "platforms": ["pc", "playstation", "xbox", "switch"],
        "release_year": 2001, "genre_tags": ["rpg", "jrpg", "turn-based", "fantasy"],
        "time_tags": [60, 90], "energy_level": "low", "mood_tags": ["emotional", "story-driven", "epic"],
        "play_style": ["narrative", "strategy"], "time_to_fun": "medium", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Tidus and Yuna's emotional journey across Spira.",
        "fun_fact": "The first Final Fantasy with full voice acting.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "kotor", "title": "Star Wars: Knights of the Old Republic", "platforms": ["pc", "xbox", "switch", "mobile"],
        "release_year": 2003, "genre_tags": ["rpg", "sci-fi", "star-wars", "narrative"],
        "time_tags": [60, 90], "energy_level": "low", "mood_tags": ["story-driven", "immersive", "epic"],
        "play_style": ["narrative", "strategy"], "time_to_fun": "medium", "stop_friendliness": "anytime",
        "multiplayer_modes": ["solo"],
        "description_short": "A landmark Star Wars RPG set millennia before the films.",
        "fun_fact": "Famous for one of gaming's best plot twists.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
    {
        "game_id": "catherine-full-body", "title": "Catherine: Full Body", "platforms": ["pc", "playstation", "switch"],
        "release_year": 2019, "genre_tags": ["puzzle", "narrative", "anime"],
        "time_tags": [30, 60], "energy_level": "medium", "mood_tags": ["stylish", "surreal", "tense"],
        "play_style": ["puzzle", "narrative"], "time_to_fun": "short", "stop_friendliness": "checkpoints",
        "multiplayer_modes": ["solo"],
        "description_short": "Block-climbing puzzles wrapped in an adult relationship drama.",
        "fun_fact": "From the team behind the Persona series.",
        "explanation_templates": {}, "subscription_services": [], "store_links": {}
    },
]


def add_games():
    added = 0
    skipped = 0

    for game in CLASSIC_GAMES:
        game_id = game["game_id"]

        existing = games_ref.document(game_id).get()
        if existing.exists:
            print(f"Skipping {game['title']} - already exists")
            skipped += 1
            continue

        game["created_at"] = datetime.now(timezone.utc)
        game["updated_at"] = datetime.now(timezone.utc)

        games_ref.document(game_id).set(game)
        print(f"Added: {game['title']} ({game['release_year']})")
        added += 1

    print(f"\nDone! Added {added} games, skipped {skipped} existing")


if __name__ == "__main__":
    add_games()
