const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'games_data');

// Games that need specific fixes (using correct IDs from the JSON files)
const fixes = {
    // Strategy games incorrectly marked as puzzle
    'civilization-6': ['strategy'],
    'age-of-empires-4': ['strategy'],
    'hearts-of-iron-4': ['strategy'],
    'starcraft-2': ['strategy', 'action'],
    'total-war-warhammer-3': ['strategy', 'action'],
    'crusader-kings-3': ['strategy', 'narrative'],
    'europa-universalis-4': ['strategy'],
    'shapez': ['strategy'],  // Shapez 2 - automation game, not puzzle
    'shapez-2': ['strategy'],
    'age-of-mythology-retold': ['strategy'],

    // Tactics games incorrectly marked as puzzle
    'advance-wars-reboot': ['tactics'],
    'advance-wars-1-2': ['tactics'],

    // Sports/action games incorrectly marked as puzzle
    'madden-25': ['action'],
    'madden-nfl-25': ['action'],

    // RPGs that should be narrative, not puzzle
    'octopath-2': ['narrative'],
    'octopath-traveler-2': ['narrative'],
    'divinity-os2': ['narrative'],  // Correct ID
    'divinity-os-2': ['narrative'],
    'divinity-original-sin-2': ['narrative'],
    'pillars-2': ['narrative'],
    'pillars-of-eternity-2': ['narrative'],
    'pathfinder-wotr': ['narrative'],
    'smt-5': ['narrative'],
    'smt-5-vengeance': ['narrative'],
    'shin-megami-tensei-5': ['narrative'],

    // Games that should be strategy not puzzle
    'niche': ['strategy'],
};

let totalFixes = 0;

fs.readdirSync(dataDir).forEach(filename => {
    if (!filename.endsWith('.json')) return;

    const filepath = path.join(dataDir, filename);
    const games = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    let changed = false;

    games.forEach(game => {
        if (fixes[game.id]) {
            const oldStyle = [...(game.play_style || [])];
            game.play_style = fixes[game.id];
            console.log(`${game.title}: [${oldStyle.join(', ')}] -> [${game.play_style.join(', ')}]`);
            changed = true;
            totalFixes++;
        }
    });

    if (changed) {
        fs.writeFileSync(filepath, JSON.stringify(games, null, 2));
    }
});

console.log(`\nFixed ${totalFixes} games`);
