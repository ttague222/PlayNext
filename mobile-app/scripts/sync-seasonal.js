/**
 * Copy the API's seasonal content verbatim into the app's bundled fallback.
 * The API file is the source of truth; the fallback is what an offline
 * first launch (or a failed fetch with no cache) renders. A test fails if the
 * two ever drift, so run `npm run sync-seasonal` after editing the API file.
 */
const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '../../api-service/src/content/seasonal.json');
const target = path.resolve(__dirname, '../src/config/seasonal.fallback.json');

fs.copyFileSync(source, target);
console.log(`Copied ${path.relative(process.cwd(), source)} -> ${path.relative(process.cwd(), target)}`);
