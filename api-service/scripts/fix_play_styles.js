const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'games_data');

// Games that should be STRATEGY (RTS, 4X, grand strategy)
const strategyGames = [
    'age-of-empires-iv', 'age-of-mythology-retold', 'civilization-vi', 'company-of-heroes-3',
    'crusader-kings-iii', 'europa-universalis-iv', 'hearts-of-iron-iv', 'homeworld-3',
    'starcraft-ii', 'stellaris', 'total-war-warhammer-iii', 'victoria-3', 'frostpunk',
    'frostpunk-2', 'oxygen-not-included', 'factorio', 'mindustry', 'shapez-2',
    // Additional strategy games
    'niche', 'plateup'
];

// Games that should be TACTICS (turn-based tactics, SRPGs)
const tacticsGames = [
    'advance-wars-1-2', 'fire-emblem-engage', 'fire-emblem-three-houses', 'into-the-breach',
    'mario-rabbids-sparks', 'symphony-of-war', 'tactics-ogre-reborn', 'triangle-strategy',
    'wargroove-2', 'gloomhaven', 'solasta', 'wildermyth', 'pikmin-4'
];

// Games that should be CARD_GAME
const cardGames = [
    'gwent', 'hearthstone', 'legends-of-runeterra', 'magic-arena', 'marvel-snap',
    'pokemon-tcg-live', 'yu-gi-oh-master-duel', 'slay-the-spire', 'inscryption',
    'monster-train', 'balatro', 'dicey-dungeons', 'one-step-from-eden', 'backpack-hero'
];

// Games that should be ACTION only (shooters, sports that aren't puzzle)
const actionOnlyGames = [
    'payday-3', 'rainbow-six-siege', 'ready-or-not', 'zero-hour', 'phasmophobia',
    'labyrinthine', 'world-of-tanks', 'world-of-warships', 'madden-nfl-25', 'among-us',
    // JRPGs that should be narrative, not puzzle
    'octopath-traveler-ii', 'divinity-original-sin-2', 'pillars-of-eternity-ii',
    'pathfinder-wrath', 'shin-megami-tensei-v'
];

// Games that should be NARRATIVE + RPG style (JRPGs, CRPGs)
const narrativeRpgGames = [
    'baldurs-gate-3', 'divinity-original-sin-2', 'pillars-of-eternity-ii',
    'pathfinder-wrath', 'wasteland-3', 'persona-3-reload', 'persona-4-golden',
    'persona-5-royal', 'shin-megami-tensei-v', 'yakuza-like-a-dragon',
    'like-a-dragon-infinite-wealth', 'chained-echoes', 'sea-of-stars',
    'octopath-traveler-ii', 'live-a-live'
];

// Loop Hero and FTL are roguelike strategy
const roguelikeStrategyGames = [
    'loop-hero', 'ftl'
];

let totalChanges = 0;

fs.readdirSync(dataDir).forEach(filename => {
    if (!filename.endsWith('.json')) return;

    const filepath = path.join(dataDir, filename);
    const games = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    let fileChanges = 0;

    games.forEach(game => {
        const id = game.id;
        const oldStyle = [...(game.play_style || [])];

        // Skip if no play_style
        if (!game.play_style) {
            game.play_style = [];
        }

        // Check if this game had puzzle_strategy
        const hadPuzzleStrategy = game.play_style.includes('puzzle_strategy');

        // Remove puzzle_strategy from all games
        game.play_style = game.play_style.filter(s => s !== 'puzzle_strategy');

        // Add correct categorization based on game ID
        if (strategyGames.includes(id)) {
            if (!game.play_style.includes('strategy')) {
                game.play_style.push('strategy');
            }
        } else if (tacticsGames.includes(id)) {
            if (!game.play_style.includes('tactics')) {
                game.play_style.push('tactics');
            }
        } else if (cardGames.includes(id)) {
            if (!game.play_style.includes('card_game')) {
                game.play_style.push('card_game');
            }
        } else if (actionOnlyGames.includes(id)) {
            // These are action games, not puzzle
            if (!game.play_style.includes('action')) {
                game.play_style.push('action');
            }
        } else if (narrativeRpgGames.includes(id)) {
            // RPGs get narrative
            if (!game.play_style.includes('narrative')) {
                game.play_style.push('narrative');
            }
        } else if (roguelikeStrategyGames.includes(id)) {
            if (!game.play_style.includes('strategy')) {
                game.play_style.push('strategy');
            }
        } else if (hadPuzzleStrategy) {
            // Games that had puzzle_strategy and aren't in above lists
            // Check if they have puzzle in genres - those are true puzzles
            if (game.genres && game.genres.includes('puzzle')) {
                if (!game.play_style.includes('puzzle')) {
                    game.play_style.push('puzzle');
                }
            } else if (game.genres && (
                game.genres.includes('roguelike') ||
                game.genres.includes('deck-builder')
            )) {
                // Roguelikes/deck-builders that aren't card games
                if (!game.play_style.includes('strategy')) {
                    game.play_style.push('strategy');
                }
            } else {
                // Default: give them puzzle if unclear
                if (!game.play_style.includes('puzzle')) {
                    game.play_style.push('puzzle');
                }
            }
        }

        // Check if changed
        const newStyle = [...game.play_style].sort();
        const oldSorted = [...oldStyle].sort();
        if (JSON.stringify(oldSorted) !== JSON.stringify(newStyle)) {
            console.log(`${game.title}: [${oldStyle.join(', ')}] -> [${game.play_style.join(', ')}]`);
            fileChanges++;
        }
    });

    if (fileChanges > 0) {
        fs.writeFileSync(filepath, JSON.stringify(games, null, 2));
        console.log(`\nUpdated ${filename} (${fileChanges} changes)\n`);
        totalChanges += fileChanges;
    }
});

console.log(`\nTotal changes: ${totalChanges}`);
