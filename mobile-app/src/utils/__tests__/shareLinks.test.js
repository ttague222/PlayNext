/**
 * Incoming playnxt.io/s/<share-id> links (Universal Links / App Links).
 * Only a well-formed share id counts — everything else on the domain keeps
 * its browser behavior.
 */
import { parseShareLink } from '../shareLinks';

describe('parseShareLink', () => {
  it('reads the share id from a share landing link', () => {
    expect(parseShareLink('https://playnxt.io/s/aK3m9Qp2Rb')).toBe('aK3m9Qp2Rb');
  });

  it('ignores utm params and trailing slashes', () => {
    expect(
      parseShareLink('https://playnxt.io/s/aK3m9Qp2Rb/?utm_source=share&utm_medium=app')
    ).toBe('aK3m9Qp2Rb');
  });

  it('accepts the custom scheme form too', () => {
    expect(parseShareLink('playnxt://playnxt.io/s/aK3m9Qp2Rb')).toBe('aK3m9Qp2Rb');
  });

  it('returns null for other pages on the domain', () => {
    expect(parseShareLink('https://playnxt.io/pick/hades')).toBeNull();
    expect(parseShareLink('https://playnxt.io/')).toBeNull();
    expect(parseShareLink('https://playnxt.io/sitemap.xml')).toBeNull();
  });

  it('returns null for other hosts', () => {
    expect(parseShareLink('https://evil.example/s/aK3m9Qp2Rb')).toBeNull();
  });

  it('returns null for a malformed share id', () => {
    expect(parseShareLink('https://playnxt.io/s/')).toBeNull();
    expect(parseShareLink('https://playnxt.io/s/<script>')).toBeNull();
    expect(parseShareLink(`https://playnxt.io/s/${'a'.repeat(64)}`)).toBeNull();
  });

  it('returns null for junk input', () => {
    expect(parseShareLink(null)).toBeNull();
    expect(parseShareLink('')).toBeNull();
    expect(parseShareLink('not a url')).toBeNull();
  });
});
