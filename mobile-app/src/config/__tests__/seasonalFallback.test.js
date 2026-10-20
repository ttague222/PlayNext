/**
 * The bundled fallback must be byte-for-byte the API's seasonal content.
 * If this fails, run `npm run sync-seasonal` in mobile-app.
 */
describe('seasonal.fallback.json', () => {
  it('deep-equals the API content file', () => {
    const fallback = require('../seasonal.fallback.json');
    const apiContent = require('../../../../api-service/src/content/seasonal.json');
    expect(fallback).toEqual(apiContent);
  });
});
