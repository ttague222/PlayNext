/**
 * Pins the native deep-link config for playnxt.io/s/* share links. These
 * settings only take effect in a native build, so a silent regression here
 * would not surface until store review — the test makes it loud.
 */
import appConfig from '../../../app.config';

const { expo } = appConfig;

describe('app.config.js deep-link setup', () => {
  it('declares the iOS associated domain for Universal Links', () => {
    expect(expo.ios.associatedDomains).toEqual(['applinks:playnxt.io']);
  });

  it('declares a verified Android App Links intent filter for /s/', () => {
    const shareFilter = expo.android.intentFilters.find((filter) =>
      (filter.data || []).some((d) => d.scheme === 'https' && d.host === 'playnxt.io')
    );

    expect(shareFilter).toBeTruthy();
    expect(shareFilter.autoVerify).toBe(true);
    expect(shareFilter.data).toEqual([
      { scheme: 'https', host: 'playnxt.io', pathPrefix: '/s/' },
    ]);
    expect(shareFilter.category).toEqual(expect.arrayContaining(['BROWSABLE', 'DEFAULT']));
  });

  it('keeps the OAuth intent filter intact', () => {
    const oauthFilter = expo.android.intentFilters.find((filter) =>
      (filter.data || []).some((d) => d.scheme === 'playnxt' && d.pathPrefix === '/oauth')
    );

    expect(oauthFilter).toBeTruthy();
  });
});
