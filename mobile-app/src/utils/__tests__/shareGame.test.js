/**
 * Share links point at the playnxt.io /pick landing page (spec §4 v2),
 * carrying session context so the page can render "40 min · Wind Down".
 */
import { buildPickLink, buildShareMessage } from '../shareGame';

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
});
