const fs = require('fs');
const path = require('path');
const dataDir = path.join(__dirname, 'games_data');

const counts = { puzzle: 0, strategy: 0, tactics: 0, card_game: 0, narrative: 0, action: 0, sandbox_creative: 0 };

fs.readdirSync(dataDir).forEach(filename => {
    if (filename.endsWith('.json')) {
        const games = JSON.parse(fs.readFileSync(path.join(dataDir, filename), 'utf8'));
        games.forEach(game => {
            (game.play_style || []).forEach(style => {
                if (counts[style] !== undefined) counts[style]++;
            });
        });
    }
});

console.log('Play Style Distribution:');
Object.entries(counts).sort((a,b) => b[1] - a[1]).forEach(([style, count]) => {
    console.log(`  ${style}: ${count}`);
});
