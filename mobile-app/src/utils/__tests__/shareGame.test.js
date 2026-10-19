/**
 * Share links point at the playnxt.io /pick landing page (spec §4 v2),
 * carrying session context so the page can render "40 min · Wind Down".
 */
import { buildPickLink, buildShareLink, buildShareMessage } from '../shareGame';

const game = { game_id: 'hades', title: 'Hades' };

describe('buildPickLink', () => {
  it('links to the /pick page with utm attribution', () => {
    expect(buildPickLink(game)).toBe('https://playnxt.io/pick/hades?utm_source=share_card');
  });

  it('carries time and mood context params', () => {
    const link = buildPickLink(game, { timeAvailable: 40, energyMood: 'wind_down' });
    const url = new URL(link);
    expect(url.pathname).toBe('/pick/hades');
    expect(url.searchParams.get('t')).toBe('40');
    expect(url.searchParams.get('m')).toBe('wind_down');
    expect(url.searchParams.get('utm_source')).toBe('share_card');
  });

  it('drops unknown mood values instead of sending junk', () => {
    const link = buildPickLink(game, { timeAvailable: 40, energyMood: 'sideways' });
    expect(new URL(link).searchParams.get('m')).toBeNull();
  });

  it('falls back to the home page when the game has no id', () => {
    expect(buildPickLink({ title: 'Mystery' })).toBe('https://playnxt.io/?utm_source=share_card');
  });

  it('encodes unusual game ids safely', () => {
    const link = buildPickLink({ game_id: 'game with spaces' });
    expect(link).toContain('/pick/game%20with%20spaces');
  });
});

describe('buildShareLink', () => {
  it('links to the /s share page with share attribution', () => {
    expect(buildShareLink('aK3m9Qp2Rb')).toBe(
      'https://playnxt.io/s/aK3m9Qp2Rb?utm_source=share&utm_medium=app'
    );
  });

  it('encodes unusual share ids safely', () => {
    expect(buildShareLink('a b')).toContain('/s/a%20b?');
  });
});

describe('buildShareMessage', () => {
  it('includes the context sentence and pick link', () => {
    const { title, message } = buildShareMessage(game, { timeAvailable: 40, energyMood: 'wind_down' });
    expect(title).toBe('Playing Hades tonight');
    expect(message).toContain('PlayNxt said: Hades for a 40-minute Wind Down session.');
    expect(message).toContain('https://playnxt.io/pick/hades?');
  });

  it('works without context', () => {
    const { message } = buildShareMessage(game);
    expect(message).toContain('PlayNxt said: Hades.');
    expect(message).toContain('https://playnxt.io/pick/hades?utm_source=share_card');
  });

  it('uses the share page link when one is given', () => {
    const { message } = buildShareMessage(
      game,
      { timeAvailable: 40, energyMood: 'wind_down' },
      'https://playnxt.io/s/aK3m9Qp2Rb?utm_source=share&utm_medium=app'
    );
    expect(message).toContain('/s/aK3m9Qp2Rb');
    expect(message).not.toContain('/pick/');
  });
});
